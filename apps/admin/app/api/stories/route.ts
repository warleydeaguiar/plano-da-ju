import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '../../../lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY ?? '';

// ─── YouTube helpers ───────────────────────────────────────────────
function parseYouTubeId(url: string): string | null {
  try {
    const u = new URL(url.trim())
    // youtu.be/VIDEO_ID
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0] || null
    // youtube.com/watch?v=VIDEO_ID
    const v = u.searchParams.get('v')
    if (v) return v
    // youtube.com/shorts/VIDEO_ID  or  /embed/VIDEO_ID  or  /v/VIDEO_ID
    const m = u.pathname.match(/\/(shorts|embed|v)\/([^/?&]+)/)
    if (m?.[2]) return m[2]
  } catch { /* invalid URL */ }
  return null
}

function buildEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`
}

function buildThumbnailUrl(videoId: string): string {
  // maxresdefault is 1280×720, but may not exist for all videos → hqdefault is 480×360 and always present
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
}

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
    if (!res.ok) return {};
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: views } = await (supabase as any).from('story_views').select('story_id');
    const countsByStory: Record<string, number> = {};
    ((views ?? []) as { story_id: string }[]).forEach(v => {
      countsByStory[v.story_id] = (countsByStory[v.story_id] ?? 0) + 1;
    });

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

// ─── POST: create story from YouTube link ──────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title,
      description,
      youtube_url,
      priority = 0,
      ai_assist = true,
      target_hair_types,
      target_problems,
      target_porosity,
      target_chemicals,
      trigger_phase,
      trigger_day_min,
      trigger_day_max,
    } = body;

    if (!title?.trim() || !description?.trim() || !youtube_url?.trim()) {
      return NextResponse.json({ error: 'Título, descrição e link do YouTube são obrigatórios' }, { status: 400 });
    }

    const videoId = parseYouTubeId(youtube_url);
    if (!videoId) {
      return NextResponse.json({ error: 'Link do YouTube inválido. Tente: youtube.com/watch?v=... ou youtu.be/...' }, { status: 400 });
    }

    const mediaUrl   = buildEmbedUrl(videoId);
    const coverUrl   = buildThumbnailUrl(videoId);

    // Optional AI targeting
    let targeting: Partial<ExtractedTargeting> = {};
    if (ai_assist) {
      targeting = await extractTargeting(title, description);
    }

    const parseArr = (v: unknown): string[] => {
      if (Array.isArray(v)) return v.filter(Boolean)
      if (typeof v === 'string' && v.trim()) return v.split(',').map((s: string) => s.trim()).filter(Boolean)
      return []
    }

    const manualHair      = parseArr(target_hair_types)
    const manualProblems  = parseArr(target_problems)
    const manualPorosity  = parseArr(target_porosity)
    const manualChemicals = parseArr(target_chemicals)

    const supabase = createAdminClient();
    const id = crypto.randomUUID();

    const row = {
      id,
      title: title.trim(),
      description: description.trim(),
      media_type: 'video',
      media_url: mediaUrl,
      cover_image_url: coverUrl,
      youtube_video_id: videoId,
      priority: parseInt(String(priority), 10) || 0,
      active: true,
      target_hair_types: manualHair.length  ? manualHair      : (targeting.target_hair_types ?? []),
      target_problems:   manualProblems.length ? manualProblems : (targeting.target_problems   ?? []),
      target_porosity:   manualPorosity.length ? manualPorosity : (targeting.target_porosity   ?? []),
      target_chemicals:  manualChemicals.length ? manualChemicals : (targeting.target_chemicals ?? []),
      trigger_phase:     trigger_phase || targeting.trigger_phase || 'any',
      trigger_day_min:   trigger_day_min != null ? Number(trigger_day_min) : (targeting.trigger_day_min ?? 0),
      trigger_day_max:   trigger_day_max != null ? Number(trigger_day_max) : (targeting.trigger_day_max ?? null),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertErr } = await (supabase.from('juliane_stories') as any).insert(row);
    if (insertErr) {
      console.error('[stories POST] insert', insertErr);
      // youtube_video_id column might not exist yet — retry without it
      const { youtube_video_id: _drop, ...rowFallback } = row;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insertErr2 } = await (supabase.from('juliane_stories') as any).insert(rowFallback);
      if (insertErr2) {
        console.error('[stories POST] insert fallback', insertErr2);
        return NextResponse.json({ error: 'Falha ao salvar story' }, { status: 500 });
      }
      return NextResponse.json({ ok: true, story: { ...rowFallback, view_count: 0 }, ai_targeting: ai_assist ? targeting : null });
    }

    return NextResponse.json({ ok: true, story: { ...row, view_count: 0 }, ai_targeting: ai_assist ? targeting : null });
  } catch (err) {
    console.error('[stories POST]', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// ─── PATCH: toggle active ──────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const { id, active } = await req.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const supabase = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('juliane_stories') as any).update({ active }).eq('id', id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[stories PATCH]', err);
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
