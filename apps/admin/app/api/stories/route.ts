import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '../../../lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY ?? '';

// ─── Targeting extraction via Claude ───────────────────────────────
type ExtractedTargeting = {
  target_hair_types: string[];
  target_problems: string[];
  target_porosity: string[];
  target_chemicals: string[];
  trigger_phase: 'plan_delivery' | 'ongoing' | 'milestone' | 'any';
  trigger_day_min: number;
  trigger_day_max: number | null;
};

async function extractTargeting(title: string, description: string): Promise<Partial<ExtractedTargeting>> {
  if (!ANTHROPIC_KEY || ANTHROPIC_KEY.startsWith('X')) return {};
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: `Você é assistente da Juliane Cost (especialista capilar). Ela está cadastrando uma story (vídeo ou áudio) para clientes do app dela.

Analise o título e descrição abaixo e retorne APENAS um JSON válido com os campos de segmentação inferidos. Use os valores exatos das listas abaixo. Se um campo não estiver claro, retorne lista vazia.

TÍTULO: ${title}
DESCRIÇÃO: ${description}

Valores válidos:
- target_hair_types: subset de ["liso","ondulado","cacheado","crespo"]
- target_problems: subset de ["queda","frizz","ressecamento","oleosidade","pontas","crescimento","brilho","quimica","caspa"]
- target_porosity: subset de ["baixa","media","alta"]
- target_chemicals: subset de ["nenhuma","coloracao","mechas","progressiva","relaxamento"]
- trigger_phase: "plan_delivery" (entrega do plano), "ongoing" (durante uso), "milestone" (após X dias seguindo), "any" (qualquer fase)
- trigger_day_min: número de dias mínimo desde plan_released_at (0 se não houver)
- trigger_day_max: número de dias máximo (null se sem limite)

Exemplos:
"Para mulheres sofrendo queda nas primeiras 4 semanas" → { "target_problems":["queda"], "trigger_phase":"ongoing", "trigger_day_min":0, "trigger_day_max":28 }
"Dica para hidratar cabelo cacheado alta porosidade" → { "target_hair_types":["cacheado"], "target_porosity":["alta"], "target_problems":["ressecamento"], "trigger_phase":"any", "trigger_day_min":0, "trigger_day_max":null }
"Boas-vindas: como começar bem o plano" → { "trigger_phase":"plan_delivery", "trigger_day_min":0, "trigger_day_max":3 }

Retorne APENAS o JSON, sem markdown.`,
        }],
      }),
    });
    if (!res.ok) {
      console.error('[stories targeting] anthropic failed', res.status);
      return {};
    }
    const j = await res.json();
    const text: string = j.content?.[0]?.text ?? '';
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return {};
    return JSON.parse(m[0]);
  } catch (err) {
    console.error('[stories targeting] error', err);
    return {};
  }
}

// ─── GET: list all stories with view counts ────────────────────────
export async function GET() {
  try {
    const supabase = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: stories } = await (supabase as any).from('juliane_stories')
      .select('*')
      .order('created_at', { ascending: false });

    // Counts of views per story
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: viewCounts } = await (supabase as any)
      .rpc('story_view_counts')
      .select('*') // optional RPC; fall back to manual aggregate
      .catch(() => ({ data: null }));

    let countsByStory: Record<string, number> = {};
    if (!viewCounts) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: views } = await (supabase as any).from('story_views').select('story_id');
      if (views) {
        countsByStory = (views as { story_id: string }[]).reduce((acc, v) => {
          acc[v.story_id] = (acc[v.story_id] ?? 0) + 1;
          return acc;
        }, {} as Record<string, number>);
      }
    }

    return NextResponse.json({
      stories: (stories ?? []).map((s: { id: string } & Record<string, unknown>) => ({
        ...s,
        view_count: countsByStory[s.id] ?? 0,
      })),
    });
  } catch (err) {
    console.error('[stories GET]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ─── POST: upload story media + insert row ─────────────────────────
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('media') as File | null;
    const cover = form.get('cover') as File | null;
    const title = form.get('title') as string;
    const description = form.get('description') as string;
    const mediaType = form.get('media_type') as 'video' | 'audio';
    const priority = parseInt((form.get('priority') as string) ?? '0', 10);
    const aiAssist = form.get('ai_assist') === 'true';

    if (!file || !title || !description || !mediaType) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 });
    }
    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json({ error: 'Arquivo muito grande (máx. 100 MB)' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const id = crypto.randomUUID();

    // Upload media
    const ext = file.name.split('.').pop() ?? (mediaType === 'video' ? 'mp4' : 'mp3');
    const path = `${id}/media.${ext}`;
    const buffer = new Uint8Array(await file.arrayBuffer());
    const { error: upErr } = await supabase.storage.from('juliane-stories').upload(path, buffer, {
      contentType: file.type, upsert: true,
    });
    if (upErr) {
      console.error('[stories POST] upload', upErr);
      return NextResponse.json({ error: 'Falha ao salvar mídia' }, { status: 500 });
    }
    const { data: pub } = supabase.storage.from('juliane-stories').getPublicUrl(path);
    const mediaUrl = pub.publicUrl;

    // Upload cover (optional, video only)
    let coverUrl: string | null = null;
    if (cover) {
      const coverPath = `${id}/cover.${cover.name.split('.').pop() ?? 'jpg'}`;
      const coverBuf = new Uint8Array(await cover.arrayBuffer());
      const { error: coverErr } = await supabase.storage.from('juliane-stories').upload(coverPath, coverBuf, {
        contentType: cover.type, upsert: true,
      });
      if (!coverErr) {
        coverUrl = supabase.storage.from('juliane-stories').getPublicUrl(coverPath).data.publicUrl;
      }
    }

    // Optional AI targeting
    let targeting: Partial<ExtractedTargeting> = {};
    if (aiAssist) {
      targeting = await extractTargeting(title, description);
    }

    // Manual targeting from form (override AI if provided)
    const parseArr = (key: string): string[] => {
      const v = form.get(key);
      if (typeof v !== 'string' || !v.trim()) return [];
      return v.split(',').map(s => s.trim()).filter(Boolean);
    };
    const manualHair = parseArr('target_hair_types');
    const manualProblems = parseArr('target_problems');
    const manualPorosity = parseArr('target_porosity');
    const manualChemicals = parseArr('target_chemicals');
    const manualPhase = (form.get('trigger_phase') as string) || null;
    const manualDayMin = form.get('trigger_day_min');
    const manualDayMax = form.get('trigger_day_max');

    const row = {
      id,
      title,
      description,
      media_type: mediaType,
      media_url: mediaUrl,
      cover_image_url: coverUrl,
      priority,
      active: true,
      target_hair_types: manualHair.length ? manualHair : (targeting.target_hair_types ?? []),
      target_problems:   manualProblems.length ? manualProblems : (targeting.target_problems ?? []),
      target_porosity:   manualPorosity.length ? manualPorosity : (targeting.target_porosity ?? []),
      target_chemicals:  manualChemicals.length ? manualChemicals : (targeting.target_chemicals ?? []),
      trigger_phase:     manualPhase || targeting.trigger_phase || 'any',
      trigger_day_min:   manualDayMin ? parseInt(manualDayMin as string, 10) : (targeting.trigger_day_min ?? 0),
      trigger_day_max:   manualDayMax ? parseInt(manualDayMax as string, 10) : (targeting.trigger_day_max ?? null),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertErr } = await (supabase.from('juliane_stories') as any).insert(row);
    if (insertErr) {
      console.error('[stories POST] insert', insertErr);
      return NextResponse.json({ error: 'Falha ao salvar story' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, story: row, ai_targeting: aiAssist ? targeting : null });
  } catch (err) {
    console.error('[stories POST]', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// ─── DELETE: remove a story ────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('juliane_stories') as any).delete().eq('id', id);
  return NextResponse.json({ ok: true });
}
