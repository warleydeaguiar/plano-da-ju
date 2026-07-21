import { NextRequest, NextResponse, after } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';
import { logServerError } from '@/lib/server-log';

export const runtime = 'nodejs';
// Upload + análise da Claude Vision podem passar de 30s; sem isto a função
// serverless corta em ~10-15s e o usuário vê "Erro ao enviar foto" mesmo com
// a foto já salva.
export const maxDuration = 60;

const parseLen = (v: unknown): number | null => {
  if (typeof v === 'string' || typeof v === 'number') {
    const n = parseFloat(String(v).replace(',', '.'));
    if (!isNaN(n) && n > 0 && n < 200) return n;
  }
  return null;
};
const parseW = (v: unknown): number | null => {
  if (typeof v === 'string' || typeof v === 'number') {
    const w = parseFloat(String(v).replace(',', '.'));
    if (!isNaN(w) && w >= 30 && w <= 300) return w;
  }
  return null;
};

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

    const supabase = await createServiceClient();

    // ── Entrada: JSON (fotos já subiram DIRETO pro Storage via URL assinada) OU
    //    multipart/form-data (legado — progresso/home). O caminho JSON evita o
    //    limite de ~4,5MB de corpo da serverless que causava "Request Entity Too
    //    Large" (erro "Unexpected token R … is not valid JSON") no onboarding.
    const isJson = (req.headers.get('content-type') ?? '').includes('application/json');

    let photoUrl = '';
    let photoBackUrl: string | null = null;
    let photoRootUrl: string | null = null;
    let videoUrl: string | null = null;
    let hairLengthCm: number | null = null;
    let weightKg: number | null = null;
    let frontBuffer = new Uint8Array(0);
    let frontMime = 'image/jpeg';

    if (isJson) {
      const body = await req.json().catch(() => ({}));
      photoUrl = typeof body.photo_url === 'string' ? body.photo_url : '';
      if (!photoUrl.startsWith('http')) return NextResponse.json({ error: 'Foto não enviada' }, { status: 400 });
      photoBackUrl = typeof body.photo_back_url === 'string' && body.photo_back_url.startsWith('http') ? body.photo_back_url : null;
      photoRootUrl = typeof body.photo_root_url === 'string' && body.photo_root_url.startsWith('http') ? body.photo_root_url : null;
      videoUrl = typeof body.video_url === 'string' && body.video_url.startsWith('http') ? body.video_url : null;
      hairLengthCm = parseLen(body.hair_length_cm);
      weightKg = parseW(body.weight_kg);
      // Baixa a foto de frente (do Storage) só pra disparar a geração do plano em
      // base64. Se falhar, o cron recover-stuck-plans regenera pela URL do perfil.
      try {
        const r = await fetch(photoUrl);
        if (r.ok) {
          frontBuffer = new Uint8Array(await r.arrayBuffer());
          frontMime = r.headers.get('content-type') || 'image/jpeg';
        }
      } catch { /* segue — a rede de segurança do cron cobre */ }
    } else {
      // Caminho LEGADO (multipart): fotos vêm no corpo. Usado por progresso/home.
      const form = await req.formData();
      const file = form.get('photo');
      if (!file || typeof file === 'string') return NextResponse.json({ error: 'Foto não enviada' }, { status: 400 });
      const f = file as File;
      if (f.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Foto muito grande (máx. 10 MB)' }, { status: 400 });
      if (!f.type.startsWith('image/')) return NextResponse.json({ error: 'Arquivo precisa ser uma imagem' }, { status: 400 });

      const backFile = form.get('photo_back');
      const backF = backFile && typeof backFile !== 'string' ? (backFile as File) : null;
      const rootFile = form.get('photo_root');
      const rootF = rootFile && typeof rootFile !== 'string' ? (rootFile as File) : null;
      const videoUrlRaw = form.get('video_url');
      videoUrl = typeof videoUrlRaw === 'string' && videoUrlRaw.startsWith('http') ? videoUrlRaw : null;
      hairLengthCm = parseLen(form.get('hair_length_cm'));
      weightKg = parseW(form.get('weight_kg'));

      const ext = f.type === 'image/png' ? 'png' : f.type === 'image/webp' ? 'webp' : 'jpg';
      const fileName = `${user.id}/${Date.now()}.${ext}`;
      frontBuffer = new Uint8Array(await f.arrayBuffer());
      frontMime = f.type;
      const { error: upErr } = await supabase.storage.from('hair-photos').upload(fileName, frontBuffer, { contentType: f.type, upsert: false });
      if (upErr) { console.error('[photo] upload error', upErr); return NextResponse.json({ error: 'Falha ao salvar foto' }, { status: 500 }); }
      photoUrl = supabase.storage.from('hair-photos').getPublicUrl(fileName).data.publicUrl;

      if (backF && backF.type.startsWith('image/') && backF.size <= 10 * 1024 * 1024) {
        const backName = `${user.id}/${Date.now()}-costas.jpg`;
        const { error: e } = await supabase.storage.from('hair-photos').upload(backName, new Uint8Array(await backF.arrayBuffer()), { contentType: backF.type, upsert: false });
        if (!e) photoBackUrl = supabase.storage.from('hair-photos').getPublicUrl(backName).data.publicUrl;
        else console.error('[photo] back upload error', e);
      }
      if (rootF && rootF.type.startsWith('image/') && rootF.size <= 10 * 1024 * 1024) {
        const rootName = `${user.id}/${Date.now()}-raiz.jpg`;
        const { error: e } = await supabase.storage.from('hair-photos').upload(rootName, new Uint8Array(await rootF.arrayBuffer()), { contentType: rootF.type, upsert: false });
        if (!e) photoRootUrl = supabase.storage.from('hair-photos').getPublicUrl(rootName).data.publicUrl;
        else console.error('[photo] root upload error', e);
      }
    }

    // Peso → meta diária de água (35ml × kg). Editável depois no perfil.
    const waterGoalMl = weightKg !== null ? Math.round((weightKg * 35) / 50) * 50 : null;

    // Esta foto vai DISPARAR a geração do plano? (1ª foto do onboarding). Se sim,
    // NÃO analisamos a imagem aqui — o gerador do plano já faz a análise da foto e
    // salva os scores (analise_foto). Evita pagar 2x a mesma análise de imagem.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase.from('profiles') as any)
      .select('email, plan_status, photo_url, plan_without_photo')
      .eq('id', user.id)
      .single();
    const planKey = process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY;
    const willGeneratePlan =
      (profile?.plan_status === 'pending_photo' || !!profile?.plan_without_photo)
      && !profile?.photo_url && !!profile?.email
      && !!planKey && !planKey.startsWith('X');

    // Análise de visão SÓ pra fotos de PROGRESSO (no onboarding o plano analisa).
    let analysis = {
      brilho_score: null as number | null,
      hidratacao_score: null as number | null,
      frizz_score: null as number | null,
      pontas_score: null as number | null,
      crescimento_estimado_cm: null as number | null,
      avaliacao_texto: null as string | null,
      raw_response: null as unknown,
    };

    if (!willGeneratePlan && process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY.startsWith('X')) {
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
                { type: 'image', source: { type: 'url', url: photoUrl } },
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
              raw_response: j,
            };
          }
        }
      } catch (e) {
        console.error('[photo] vision error', e);
      }
    }

    // Insert photo_analyses row — só quando NÃO vamos gerar plano agora (progresso).
    if (!willGeneratePlan) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: paErr } = await (supabase as any).from('photo_analyses').insert({
        user_id: user.id,
        photo_url: photoUrl,
        analyzed_at: new Date().toISOString(),
        ...analysis,
      });
      if (paErr) {
        console.error('[photo] photo_analyses insert error', paErr);
        return NextResponse.json({ error: 'Falha ao salvar a foto. Tente de novo.' }, { status: 500 });
      }
    }

    // Atualiza profile com a foto mais recente (usada por /api/plan/generate)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('profiles') as any)
      .update({
        photo_url: photoUrl,
        photo_taken_at: new Date().toISOString(),
        ...(photoBackUrl ? { photo_back_url: photoBackUrl } : {}),
        ...(photoRootUrl ? { photo_root_url: photoRootUrl } : {}),
        ...(videoUrl ? { video_url: videoUrl } : {}),
        ...(hairLengthCm !== null ? { hair_length_cm: hairLengthCm } : {}),
        ...(weightKg !== null ? { weight_kg: weightKg, water_goal_ml: waterGoalMl } : {}),
      })
      .eq('id', user.id);

    // Se é a 1ª foto E o plano ainda está pendente, dispara geração.
    let planTriggered = false;
    if ((profile?.plan_status === 'pending_photo' || profile?.plan_without_photo) && !profile.photo_url && profile.email) {
      try {
        const apiKey = process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY;
        const hasRealKey = !!apiKey && !apiKey.startsWith('X');
        if (hasRealKey) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('profiles') as any)
            .update({ plan_status: 'processing', plan_requested_at: new Date().toISOString(), plan_without_photo: false })
            .eq('id', user.id);

          const origin = req.nextUrl.origin;
          // Se conseguimos os bytes da foto, mandamos base64; senão o generate usa
          // a photo_url que acabamos de salvar no perfil (e o cron cobre falhas).
          const planBody = JSON.stringify({
            email: profile.email,
            ...(frontBuffer.length ? { photo_base64: Buffer.from(frontBuffer).toString('base64'), photo_mime_type: frontMime } : { photo_url: photoUrl }),
          });
          after(async () => {
            try {
              const r = await fetch(`${origin}/api/plan/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: planBody,
              });
              if (!r.ok) console.error('[photo→plan trigger] status', r.status);
            } catch (e) {
              console.error('[photo→plan trigger]', e);
            }
          });
          planTriggered = true;
        }
      } catch (e) {
        console.error('[photo→plan check]', e);
      }
    }

    return NextResponse.json({ ok: true, photo_url: photoUrl, analysis, plan_triggered: planTriggered });
  } catch (err) {
    await logServerError({ route: 'meu-plano/photo', err, severity: 'error', context: { impact: 'cliente não conseguiu enviar foto de progresso/onboarding' } });
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
