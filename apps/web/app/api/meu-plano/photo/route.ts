import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // Auth
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const anon = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } },
    );
    const { data: { user }, error: authErr } = await anon.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    // Read multipart
    const form = await req.formData();
    const file = form.get('photo');
    if (!file || typeof file === 'string') return NextResponse.json({ error: 'Foto não enviada' }, { status: 400 });

    const f = file as File;
    if (f.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Foto muito grande (máx. 10 MB)' }, { status: 400 });
    if (!f.type.startsWith('image/')) return NextResponse.json({ error: 'Arquivo precisa ser uma imagem' }, { status: 400 });

    const supabase = await createServiceClient();
    const ext = f.type === 'image/png' ? 'png' : f.type === 'image/webp' ? 'webp' : 'jpg';
    const fileName = `${user.id}/${Date.now()}.${ext}`;

    const arrayBuf = await f.arrayBuffer();
    const buffer = new Uint8Array(arrayBuf);

    // Upload to storage
    const { error: upErr } = await supabase.storage.from('hair-photos').upload(fileName, buffer, {
      contentType: f.type,
      upsert: false,
    });
    if (upErr) {
      console.error('[photo] upload error', upErr);
      return NextResponse.json({ error: 'Falha ao salvar foto' }, { status: 500 });
    }

    const { data: pub } = supabase.storage.from('hair-photos').getPublicUrl(fileName);
    const photoUrl = pub.publicUrl;

    // Optional: Claude Vision analysis (only if key configured)
    let analysis = {
      brilho_score: null as number | null,
      hidratacao_score: null as number | null,
      frizz_score: null as number | null,
      pontas_score: null as number | null,
      crescimento_estimado_cm: null as number | null,
      avaliacao_texto: null as string | null,
      raw: null as unknown,
    };

    if (process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY.startsWith('X')) {
      try {
        const visionRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 1024,
            messages: [{
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: { type: 'url', url: photoUrl },
                },
                {
                  type: 'text',
                  text: `Analise esta foto de cabelo e retorne APENAS JSON válido com este formato:
{
  "brilho_score": 0-5,
  "hidratacao_score": 0-5,
  "frizz_score": 0-5,
  "pontas_score": 0-5,
  "crescimento_estimado_cm": número (estimativa relativa em cm de comprimento total visível),
  "avaliacao_texto": "parágrafo curto descritivo em PT-BR"
}`,
                },
              ],
            }],
          }),
        });
        if (visionRes.ok) {
          const j = await visionRes.json();
          const text: string = j.content?.[0]?.text ?? '';
          const m = text.match(/\{[\s\S]*\}/);
          if (m) {
            const parsed = JSON.parse(m[0]);
            analysis = {
              brilho_score:     parsed.brilho_score ?? null,
              hidratacao_score: parsed.hidratacao_score ?? null,
              frizz_score:      parsed.frizz_score ?? null,
              pontas_score:     parsed.pontas_score ?? null,
              crescimento_estimado_cm: parsed.crescimento_estimado_cm ?? null,
              avaliacao_texto:  parsed.avaliacao_texto ?? null,
              raw: j,
            };
          }
        }
      } catch (e) {
        console.error('[photo] vision error', e);
      }
    }

    // Insert photo_analyses row
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('photo_analyses').insert({
      user_id: user.id,
      photo_url: photoUrl,
      analyzed_at: new Date().toISOString(),
      ...analysis,
    });

    // Atualiza profile com a foto mais recente (usada por /api/plan/generate)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase.from('profiles') as any)
      .select('email, plan_status, photo_url')
      .eq('id', user.id)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('profiles') as any)
      .update({
        photo_url: photoUrl,
        photo_taken_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    // Se é a 1ª foto E o plano ainda está pendente, dispara geração
    // Falha graciosamente — não bloqueia a response (cliente vê foto OK; plano vem depois)
    let planTriggered = false;
    if (profile?.plan_status === 'pending_photo' && !profile.photo_url && profile.email) {
      try {
        const apiKey = process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY;
        const hasRealKey = !!apiKey && !apiKey.startsWith('X');
        if (hasRealKey) {
          // Atualiza status pra "processing" antes de chamar IA
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('profiles') as any)
            .update({ plan_status: 'processing', plan_requested_at: new Date().toISOString() })
            .eq('id', user.id);

          // Chama plan/generate (assíncrono — fire-and-forget já que demora ~30s)
          const origin = req.nextUrl.origin;
          void fetch(`${origin}/api/plan/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: profile.email,
              photo_base64: Buffer.from(buffer).toString('base64'),
              photo_mime_type: f.type,
            }),
          }).catch(e => console.error('[photo→plan trigger]', e));
          planTriggered = true;
        }
      } catch (e) {
        console.error('[photo→plan check]', e);
      }
    }

    return NextResponse.json({ ok: true, photo_url: photoUrl, analysis, plan_triggered: planTriggered });
  } catch (err) {
    console.error('[api/meu-plano/photo]', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
