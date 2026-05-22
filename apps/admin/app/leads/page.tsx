import { createAdminClient } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'
import LeadsClient from './LeadsClient'

export const revalidate = 30
export const metadata = { title: 'Leads — Admin Plano da Ju' }

export default async function LeadsPage() {
  const sb = createAdminClient()

  // ── Janelas em horário de Brasília ────────────────────────────
  const now = new Date()
  const brasiliaOffsetMs = 3 * 60 * 60 * 1000
  const brasiliaNow = new Date(now.getTime() - brasiliaOffsetMs)
  const yyyy = brasiliaNow.getUTCFullYear()
  const mm   = String(brasiliaNow.getUTCMonth() + 1).padStart(2, '0')
  const dd   = String(brasiliaNow.getUTCDate()).padStart(2, '0')
  const todayStartBR     = new Date(`${yyyy}-${mm}-${dd}T03:00:00.000Z`)
  const day7agoBR        = new Date(todayStartBR.getTime() -  7 * 86400_000)
  const day30agoBR       = new Date(todayStartBR.getTime() - 30 * 86400_000)

  // ── Funil completo: views → starts → leads → customers ────────
  // Cada degrau em 3 janelas: hoje, 7d, 30d
  const slugIn = ['plano-capilar', 'fashion-gold']

  const [
    viewsToday,    viewsLast7,    viewsLast30,
    startsTodayRaw,startsLast7Raw,startsLast30Raw,
    leadsToday,    leadsLast7,    leadsLast30,
    salesToday,    salesLast7,    salesLast30,
    quizLeads,
    checkoutAbandoned,
    activeProfiles,
  ] = await Promise.all([
    // Views por slug do quiz (entrou no quiz)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_views') as any).select('*', { count: 'exact', head: true }).in('quiz_slug', slugIn).gte('created_at', todayStartBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_views') as any).select('*', { count: 'exact', head: true }).in('quiz_slug', slugIn).gte('created_at', day7agoBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_views') as any).select('*', { count: 'exact', head: true }).in('quiz_slug', slugIn).gte('created_at', day30agoBR.toISOString()),

    // Starts = sessões únicas que interagiram (passaram do step 0)
    // Aproximação: distinct session_id em wg_quiz_step_events. Como Supabase JS
    // não tem distinct count nativo, lemos session_ids e contamos.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_step_events') as any).select('session_id').gte('created_at', todayStartBR.toISOString()).limit(5000),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_step_events') as any).select('session_id').gte('created_at', day7agoBR.toISOString()).limit(20000),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_step_events') as any).select('session_id').gte('created_at', day30agoBR.toISOString()).limit(50000),

    // Leads (completou quiz com nome/email)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_leads') as any).select('*', { count: 'exact', head: true }).in('quiz_slug', slugIn).gte('created_at', todayStartBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_leads') as any).select('*', { count: 'exact', head: true }).in('quiz_slug', slugIn).gte('created_at', day7agoBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_leads') as any).select('*', { count: 'exact', head: true }).in('quiz_slug', slugIn).gte('created_at', day30agoBR.toISOString()),

    // Sales = profiles ativos no período
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('profiles') as any).select('*', { count: 'exact', head: true }).eq('subscription_status', 'active').gte('subscription_activated_at', todayStartBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('profiles') as any).select('*', { count: 'exact', head: true }).eq('subscription_status', 'active').gte('subscription_activated_at', day7agoBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('profiles') as any).select('*', { count: 'exact', head: true }).eq('subscription_status', 'active').gte('subscription_activated_at', day30agoBR.toISOString()),

    // Leads detalhados (tabela)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_leads') as any)
      .select('id,name,email,phone,quiz_slug,utm_source,utm_campaign,created_at')
      .in('quiz_slug', slugIn)
      .order('created_at', { ascending: false })
      .limit(500),

    // Checkout abandonado
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('profiles') as any)
      .select('id,full_name,email,subscription_status,quiz_answers,created_at,updated_at')
      .eq('subscription_status', 'pending')
      .order('created_at', { ascending: false }),

    // Ativos pra cross-reference
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('profiles') as any)
      .select('email,subscription_status')
      .eq('subscription_status', 'active'),
  ])

  // Conta sessions únicas (starts) em cada janela
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uniqueSessions = (rows: any) => {
    if (!rows?.data) return 0
    const s = new Set<string>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of rows.data as any[]) if (r.session_id) s.add(r.session_id)
    return s.size
  }
  const startsToday  = uniqueSessions(startsTodayRaw)
  const startsLast7  = uniqueSessions(startsLast7Raw)
  const startsLast30 = uniqueSessions(startsLast30Raw)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeEmails = new Set((activeProfiles?.data ?? []).map((p: any) => p.email?.toLowerCase()))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leads = (quizLeads?.data ?? []).map((l: any) => ({
    ...l,
    isCliente: l.email ? activeEmails.has(l.email?.toLowerCase()) : false,
  }))

  const funnel = {
    today: {
      views: viewsToday.count ?? 0,
      starts: startsToday,
      leads: leadsToday.count ?? 0,
      sales: salesToday.count ?? 0,
    },
    last7: {
      views: viewsLast7.count ?? 0,
      starts: startsLast7,
      leads: leadsLast7.count ?? 0,
      sales: salesLast7.count ?? 0,
    },
    last30: {
      views: viewsLast30.count ?? 0,
      starts: startsLast30,
      leads: leadsLast30.count ?? 0,
      sales: salesLast30.count ?? 0,
    },
  }

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: '#FFFAF5', fontFamily: 'Plus Jakarta Sans, -apple-system, system-ui, sans-serif',
    }}>
      <Sidebar />
      <main style={{ marginLeft: 234, flex: 1, height: '100vh', overflowY: 'auto' }}>
        <LeadsClient
          leads={leads}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          checkoutAbandoned={(checkoutAbandoned?.data ?? []) as any[]}
          funnel={funnel}
        />
      </main>
    </div>
  )
}
