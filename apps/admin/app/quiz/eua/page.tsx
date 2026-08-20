import { createAdminClient } from '@/lib/supabase'
import EuaClient from './EuaClient'

export const dynamic = 'force-dynamic'

const SLUG = 'plano-capilar-usa'

async function getData() {
  const sb = createAdminClient()
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today.getTime() - 86400_000)
  const since30 = new Date(Date.now() - 30 * 86400_000).toISOString()
  const week = new Date(Date.now() - 7 * 86400_000).toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const count = (table: string, b?: (q: any) => any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (sb.from(table as any) as any).select('id', { count: 'exact', head: true }).eq('quiz_slug', SLUG)
    if (b) q = b(q); return q
  }

  const [
    viewsAll, viewsToday, viewsYest, views30,
    leadsAll, leadsToday, leadsWeek, leads30,
    leadsList, dailyLeadsRaw, stepRaw, vendas,
  ] = await Promise.all([
    count('wg_quiz_views'),
    count('wg_quiz_views', q => q.gte('created_at', today.toISOString())),
    count('wg_quiz_views', q => q.gte('created_at', yesterday.toISOString()).lt('created_at', today.toISOString())),
    count('wg_quiz_views', q => q.gte('created_at', since30)),
    count('wg_quiz_leads'),
    count('wg_quiz_leads', q => q.gte('created_at', today.toISOString())),
    count('wg_quiz_leads', q => q.gte('created_at', week)),
    count('wg_quiz_leads', q => q.gte('created_at', since30)),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_leads' as any) as any).select('*').eq('quiz_slug', SLUG).order('created_at', { ascending: false }).limit(50),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_leads' as any) as any).select('created_at').eq('quiz_slug', SLUG).gte('created_at', since30),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_step_events' as any) as any).select('session_id, step_index, step_id')
      .eq('quiz_slug', SLUG).eq('event_type', 'viewed').gte('created_at', since30).limit(50000),
    // Vendas do mercado EUA (Stripe, em dólar) — marcadas no metadata do webhook.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('checkout_events' as any) as any).select('amount_cents, created_at, metadata')
      .eq('event_type', 'payment_confirmed').gte('created_at', since30).limit(5000),
  ])

  // Funil por etapa (sessões únicas por passo)
  const bySt: Record<number, Set<string>> = {}
  const stepName: Record<number, string> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of ((stepRaw.data ?? []) as any[])) {
    const i = r.step_index as number
    if (!bySt[i]) bySt[i] = new Set()
    if (r.session_id) bySt[i].add(r.session_id)
    if (r.step_id && !stepName[i]) stepName[i] = r.step_id
  }
  const funnel = Object.keys(bySt).map(k => +k).sort((a, b) => a - b)
    .map(i => ({ index: i, id: stepName[i] ?? `etapa ${i}`, sessions: bySt[i].size }))

  // Série diária de leads
  const days = Array.from({ length: 30 }, (_, i) => new Date(Date.now() - (29 - i) * 86400_000).toISOString().slice(0, 10))
  const dayMap: Record<string, number> = {}; days.forEach(d => { dayMap[d] = 0 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of ((dailyLeadsRaw.data ?? []) as any[])) {
    const k = (r.created_at as string).slice(0, 10); if (k in dayMap) dayMap[k]++
  }
  const dailySeries = days.map(d => {
    const dt = new Date(d + 'T12:00:00')
    return { label: `${dt.getDate()}/${dt.getMonth() + 1}`, leads: dayMap[d] }
  })

  // Vendas em USD
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usaSales = ((vendas.data ?? []) as any[]).filter(v => (v.metadata ?? {}).market === 'usa')
  const salesCount = usaSales.length
  const salesUsdCents = usaSales.reduce((s, v) => s + (v.amount_cents ?? 0), 0)

  const views = viewsAll.count ?? 0
  const leads = leadsAll.count ?? 0

  return {
    kpis: {
      views, leads,
      viewsToday: viewsToday.count ?? 0, viewsYest: viewsYest.count ?? 0, views30: views30.count ?? 0,
      leadsToday: leadsToday.count ?? 0, leadsWeek: leadsWeek.count ?? 0, leads30: leads30.count ?? 0,
      convToday: (viewsToday.count ?? 0) > 0 ? Math.round(((leadsToday.count ?? 0) / (viewsToday.count ?? 1)) * 100) : null,
      conv30: (views30.count ?? 0) > 0 ? Math.round(((leads30.count ?? 0) / (views30.count ?? 1)) * 100) : null,
      salesCount, salesUsdCents,
    },
    funnel, dailySeries,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    leadsList: (leadsList.data ?? []) as any[],
  }
}

export default async function QuizEuaAdminPage() {
  const data = await getData()
  return <EuaClient data={data} />
}
