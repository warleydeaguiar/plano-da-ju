import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { buildHtml } from '@/lib/plan-pdf-template';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/plan-pdf?user=<id|email>&k=<PLAN_PREVIEW_SECRET>
 *
 * Devolve o PLANO da cliente como uma página HTML pronta pra imprimir (o mesmo
 * layout do PDF reformulado). Abre a caixa de impressão sozinha → o operador
 * salva como PDF. Sem servidor de render (Chrome headless) — o próprio navegador
 * gera o PDF. Read-only, protegido pelo mesmo segredo do preview.
 */
const JU = 'https://db.planodaju.julianecost.com/storage/v1/object/public/ju-assets';

function retornoDate(baseISO?: string | null) {
  const base = baseISO ? new Date(baseISO) : new Date();
  const d = new Date(base.getTime() + 90 * 86400000);
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', ...o }).format(d);
  return { formatada: fmt({ day: '2-digit', month: 'long', year: 'numeric' }), diaSemana: fmt({ weekday: 'long' }) };
}
const ytId = (u?: string | null) => { const m = String(u || '').match(/(?:shorts\/|watch\?v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/); return m ? m[1] : null; };
const normCouro = (v?: string | null) => (v === 'seca' ? 'seco' : v === 'oleosa' ? 'oleoso' : (v || 'normal'));

export async function GET(req: NextRequest) {
  const secret = process.env.PLAN_PREVIEW_SECRET;
  const k = req.nextUrl.searchParams.get('k');
  if (!secret || k !== secret) return new NextResponse('unauthorized', { status: 401 });
  const userParam = (req.nextUrl.searchParams.get('user') ?? '').trim();
  if (!userParam) return new NextResponse('missing user', { status: 400 });

  const sb = await createServiceClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userParam);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pq = (sb.from('profiles') as any)
    .select('id,full_name,quiz_answers,recommended_products,daily_rituals,carta_ju,plan_released_at,photo_url,photo_back_url,photo_root_url');
  const { data: profile } = isUuid
    ? await pq.eq('id', userParam).maybeSingle()
    : await pq.eq('email', userParam.toLowerCase()).maybeSingle();
  if (!profile) return new NextResponse('cliente não encontrado', { status: 404 });
  const uid = profile.id;

  const [plansRes, paRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('hair_plans') as any).select('week_number,focus,tasks,products,tips,juliane_notes').eq('user_id', uid).order('week_number'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('photo_analyses') as any).select('brilho_score,hidratacao_score,frizz_score,pontas_score,avaliacao_texto,raw_response').eq('user_id', uid).order('analyzed_at', { ascending: true }).limit(1),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plans = (plansRes.data ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pa = ((paRes.data ?? []) as any[])[0];

  // ── Produtos indicados (âncora + alternativa aninhada) ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rec: any[] = Array.isArray(profile.recommended_products) ? profile.recommended_products : [];
  const ids = [...new Set(rec.flatMap(r => [r?.produto_id, r?.alternativa_id]).filter(Boolean))] as string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prods = ids.length ? ((await (sb.from('products') as any).select('id,name,brand,image_url,affiliate_url,video_url').in('id', ids)).data ?? []) : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byId = new Map<string, any>((prods as any[]).map(p => [p.id, p]));
  const produtos = rec.map(r => {
    const pr = byId.get(r?.produto_id); if (!pr) return null;
    const alt = r?.alternativa_id ? byId.get(r.alternativa_id) : null;
    const vid = ytId(pr.video_url);
    return {
      motivo: r?.motivo || '',
      principal: {
        name: pr.name, brand: pr.brand || 'Ybera', image: pr.image_url || '',
        url: pr.affiliate_url || null, videoUrl: pr.video_url || null,
        videoThumb: vid ? `https://img.youtube.com/vi/${vid}/hqdefault.jpg` : null,
      },
      alternativa: alt ? { name: alt.name } : null,
      combos: [],
    };
  }).filter(Boolean);

  // ── Scores da foto (1–5 → 0–100 pras barras) ──
  const af = pa?.raw_response?.analise_foto || {};
  const sc = (v: unknown) => (v == null ? undefined : Math.round(Number(v) * 20));
  const scores = pa ? {
    frizz: sc(pa.frizz_score), brilho: sc(pa.brilho_score), hidratacao: sc(pa.hidratacao_score),
    pontas: sc(pa.pontas_score), porosidade: af.porosidade_aparente || null,
  } : null;

  const fotosCliente = ([['Frente', profile.photo_url], ['Costas', profile.photo_back_url], ['Raiz', profile.photo_root_url]] as [string, string | null][])
    .filter(f => !!f[1]).map(([label, url]) => ({ label, src: url }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quiz = (profile.quiz_answers ?? {}) as any;
  const data = {
    nome: profile.full_name,
    carta: profile.carta_ju || '',
    diagnostico: pa?.avaliacao_texto || '',
    scores, fotosCliente, produtos,
    semanas: plans.map(w => ({ n: w.week_number, foco: w.focus, tasks: w.tasks || [], tips: w.tips || [] })),
    ritualDiario: profile.daily_rituals || [],
    couro: normCouro(quiz.oleosidade),
    dataRetorno: retornoDate(profile.plan_released_at),
    wa: '553171260408',
    ju: {
      cover: `${JU}/ju-1.jpg`, carta: `${JU}/ju-2.jpg`, prodDivider: `${JU}/ju-3.jpg`,
      cronoDivider: `${JU}/ju-5.jpg`, footer: `${JU}/ju-4.jpg`,
    },
  };

  let html = buildHtml(data);
  // Abre a caixa de impressão sozinha (o operador escolhe "Salvar como PDF").
  html = html.replace('</body>', '<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},700);});</script></body>');
  return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
