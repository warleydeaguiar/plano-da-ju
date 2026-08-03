import { createAdminClient } from '@/lib/supabase'
import Link from 'next/link'
import FashionGoldClient from './FashionGoldClient'
import { getQuizAdSpend } from '@/lib/meta-ads-quiz'

export const dynamic = 'force-dynamic'

async function getData() {
  const sb = createAdminClient()
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today.getTime() - 86400_000)
  const since30 = new Date(Date.now() - 30 * 86400_000).toISOString()
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const L = (b?: (q: any) => any) => { let q = (sb.from('wg_quiz_leads' as any) as any).select('id', { count: 'exact', head: true }).eq('quiz_slug', 'fashion-gold'); if (b) q = b(q); return q }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const V = (b?: (q: any) => any) => { let q = (sb.from('wg_quiz_views' as any) as any).select('id', { count: 'exact', head: true }).eq('quiz_slug', 'fashion-gold'); if (b) q = b(q); return q }

  const [
    allLeads, todayLeads, weekLeads, viewsAll, viewsMonth, dailyLeads, utmData, leadsList,
    leadsYest, leads30, viewsToday, viewsYest,
  ] = await Promise.all([
    L(),
    L(q => q.gte('created_at', today.toISOString())),
    L(q => q.gte('created_at', weekAgo)),
    V(),
    V(q => q.gte('created_at', since30)),
    sb.from('wg_quiz_leads' as any).select('created_at').eq('quiz_slug', 'fashion-gold').gte('created_at', since30).order('created_at', { ascending: true }),
    sb.from('wg_quiz_leads' as any).select('utm_source, utm_campaign, utm_medium').eq('quiz_slug', 'fashion-gold'),
    sb.from('wg_quiz_leads' as any).select('*').eq('quiz_slug', 'fashion-gold').order('created_at', { ascending: false }).limit(100),
    L(q => q.gte('created_at', yesterday.toISOString()).lt('created_at', today.toISOString())),
    L(q => q.gte('created_at', since30)),
    V(q => q.gte('created_at', today.toISOString())),
    V(q => q.gte('created_at', yesterday.toISOString()).lt('created_at', today.toISOString())),
  ])

  // Meta ads — o tráfego do fashion-gold roda nas campanhas de "grupos" (Ybera VIP)
  const metaAds = await getQuizAdSpend().catch(() => null)
  const fg = metaAds?.grupos ?? null

  // Funil por ETAPA (viewed) — sessões únicas por step_index, por período.
  // (Dado só existe a partir de 03/08, quando o quiz passou a emitir eventos.)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stepSessions = async (gte?: string, lt?: string): Promise<Record<number, number>> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (sb.from('wg_quiz_step_events' as any) as any).select('session_id, step_index').eq('quiz_slug', 'fashion-gold').eq('event_type', 'viewed').limit(50000)
    if (gte) q = q.gte('created_at', gte)
    if (lt) q = q.lt('created_at', lt)
    const { data } = await q
    const bySt: Record<number, Set<string>> = {}
    for (const r of ((data ?? []) as any[])) { const i = r.step_index as number; if (!bySt[i]) bySt[i] = new Set(); if (r.session_id) bySt[i].add(r.session_id) }
    const out: Record<number, number> = {}
    for (const k of Object.keys(bySt)) out[+k] = bySt[+k].size
    return out
  }
  const [stToday, stYest, st30] = await Promise.all([
    stepSessions(today.toISOString()),
    stepSessions(yesterday.toISOString(), today.toISOString()),
    stepSessions(since30),
  ])

  // Funil ordenado: Cliques (Meta) → Visualização → Acessos → Etapa 1..6 → Lead
  const STEP_META = [
    { i: 1, label: 'Etapa 1 · Oferta', sub: 'viu a progressiva' },
    { i: 2, label: 'Etapa 2 · Como funciona', sub: 'entendeu o grupo' },
    { i: 3, label: 'Etapa 3 · Sorteios', sub: 'viu os prêmios' },
    { i: 4, label: 'Etapa 4 · Depoimentos', sub: 'prova social' },
    { i: 5, label: 'Etapa 5 · Telefone', sub: 'informou o WhatsApp' },
    { i: 6, label: 'Etapa 6 · Nome + e-mail', sub: 'reta final' },
  ]
  const funnelSteps = [
    { key: 'cliques', label: 'Cliques no link (Meta)', sub: 'clicou no anúncio', source: 'meta', today: fg?.funnelToday.link_clicks ?? 0, yesterday: fg?.funnelYesterday.link_clicks ?? 0, d30: fg?.funnel30d.link_clicks ?? 0 },
    { key: 'lpv', label: 'Visualização de página (Meta)', sub: 'abriu a landing', source: 'meta', today: fg?.funnelToday.landing_page_views ?? 0, yesterday: fg?.funnelYesterday.landing_page_views ?? 0, d30: fg?.funnel30d.landing_page_views ?? 0 },
    { key: 'acessos', label: 'Acessos ao quiz', sub: 'carregou a página', source: 'quiz', today: viewsToday.count ?? 0, yesterday: viewsYest.count ?? 0, d30: viewsMonth.count ?? 0 },
    ...STEP_META.map(s => ({ key: `s${s.i}`, label: s.label, sub: s.sub, source: 'step', today: stToday[s.i] ?? 0, yesterday: stYest[s.i] ?? 0, d30: st30[s.i] ?? 0 })),
    { key: 'lead', label: 'Completou (Lead)', sub: 'deixou nome + contato', source: 'lead', main: true, today: todayLeads.count ?? 0, yesterday: leadsYest.count ?? 0, d30: leads30.count ?? 0 },
  ]
  const metaOk = metaAds?.status === 'ok'

  // Série diária
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * 86400_000)
    return d.toISOString().slice(0, 10)
  })
  const dayMap: Record<string, number> = {}
  days.forEach(d => { dayMap[d] = 0 })
  for (const row of (dailyLeads.data ?? []) as any[]) {
    const k = (row.created_at as string).slice(0, 10)
    if (k in dayMap) dayMap[k]++
  }
  const dailySeries = days.map(d => {
    const date = new Date(d + 'T12:00:00')
    return { date: d, label: `${date.getDate()}/${date.getMonth() + 1}`, leads: dayMap[d] }
  })

  // UTM breakdown
  const utmMap: Record<string, number> = {}
  for (const row of (utmData.data ?? []) as any[]) {
    const src = row.utm_source?.toLowerCase() ?? 'direto'
    utmMap[src] = (utmMap[src] ?? 0) + 1
  }
  // Direto (sem utm)
  const noUtm = (allLeads.count ?? 0) - (utmData.data?.length ?? 0)
  if (noUtm > 0) utmMap['direto'] = (utmMap['direto'] ?? 0) + noUtm
  const utmBreakdown = Object.entries(utmMap).sort(([, a], [, b]) => b - a).map(([source, count]) => ({ source, count }))

  const total = allLeads.count ?? 0
  const views = viewsAll.count ?? 0

  return {
    kpis: {
      total,
      today:      todayLeads.count ?? 0,
      week:       weekLeads.count ?? 0,
      views,
      viewsMonth: viewsMonth.count ?? 0,
      conversion: views > 0 ? Math.round((total / views) * 100) : null,
    },
    funnelSteps,
    metaOk,
    dailySeries,
    utmBreakdown,
    leads: (leadsList.data ?? []) as any[],
  }
}

export default async function FashionGoldPage() {
  const data = await getData()
  return <FashionGoldClient data={data} />
}
