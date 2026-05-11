import { createAdminClient } from '@/lib/supabase'
import Link from 'next/link'
import FashionGoldClient from './FashionGoldClient'

export const dynamic = 'force-dynamic'

async function getData() {
  const sb = createAdminClient()
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const since30 = new Date(Date.now() - 30 * 86400_000).toISOString()
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString()

  const [allLeads, todayLeads, weekLeads, viewsAll, viewsMonth, dailyLeads, utmData, leadsList] = await Promise.all([
    sb.from('wg_quiz_leads' as any).select('id', { count: 'exact', head: true }).eq('quiz_slug', 'fashion-gold'),
    sb.from('wg_quiz_leads' as any).select('id', { count: 'exact', head: true }).eq('quiz_slug', 'fashion-gold').gte('created_at', today.toISOString()),
    sb.from('wg_quiz_leads' as any).select('id', { count: 'exact', head: true }).eq('quiz_slug', 'fashion-gold').gte('created_at', weekAgo),
    sb.from('wg_quiz_views' as any).select('id', { count: 'exact', head: true }).eq('quiz_slug', 'fashion-gold'),
    sb.from('wg_quiz_views' as any).select('id', { count: 'exact', head: true }).eq('quiz_slug', 'fashion-gold').gte('created_at', since30),
    sb.from('wg_quiz_leads' as any).select('created_at').eq('quiz_slug', 'fashion-gold').gte('created_at', since30).order('created_at', { ascending: true }),
    sb.from('wg_quiz_leads' as any).select('utm_source, utm_campaign, utm_medium').eq('quiz_slug', 'fashion-gold'),
    sb.from('wg_quiz_leads' as any).select('*').eq('quiz_slug', 'fashion-gold').order('created_at', { ascending: false }).limit(100),
  ])

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
    dailySeries,
    utmBreakdown,
    leads: (leadsList.data ?? []) as any[],
  }
}

export default async function FashionGoldPage() {
  const data = await getData()
  return <FashionGoldClient data={data} />
}
