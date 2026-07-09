import { createAdminClient } from '@/lib/supabase'
import { getPlanoClicksDaily } from '@/lib/meta-ads-quiz'
import Sidebar from '../../components/Sidebar'
import { T, fonts } from '../../theme'
import ConversaoClient from './ConversaoClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Conversão — Admin Plano da Ju' }

const SINCE = '2026-05-01' // início do plano capilar

// Dia (BR, UTC-3) de um timestamp.
function brDay(iso: string): string {
  return new Date(new Date(iso).getTime() - 3 * 3600_000).toISOString().slice(0, 10)
}

export default async function ConversaoPage() {
  const untilBR = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10)

  // 1) Cliques do Meta (campanhas do plano) por dia
  const clicksByDay = await getPlanoClicksDaily(SINCE, untilBR)

  // 2) Vendas pagas por dia (dedup por cliente/dia — igual ao relatório de lucro)
  const sb = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: evs } = await (sb.from('checkout_events') as any)
    .select('email, order_id, amount_cents, created_at')
    .eq('event_type', 'payment_confirmed')
    .gte('created_at', `${SINCE}T00:00:00`)
    .limit(20000)

  const seen = new Set<string>()
  const salesByDay: Record<string, { n: number; rev: number }> = {}
  for (const e of evs ?? []) {
    const day = brDay(e.created_at)
    const key = `${String(e.email ?? e.order_id ?? Math.random()).toLowerCase()}_${day}`
    if (seen.has(key)) continue
    seen.add(key)
    const s = salesByDay[day] ?? { n: 0, rev: 0 }
    s.n += 1
    s.rev += (Number(e.amount_cents) || 0) / 100
    salesByDay[day] = s
  }

  // 3) Série diária contínua de SINCE até hoje
  const days: Array<{ date: string; clicks: number; sales: number; revenue: number }> = []
  const cur = new Date(SINCE + 'T12:00:00')
  const end = new Date(untilBR + 'T12:00:00')
  while (cur <= end) {
    const date = cur.toISOString().slice(0, 10)
    days.push({
      date,
      clicks: clicksByDay[date] ?? 0,
      sales: salesByDay[date]?.n ?? 0,
      revenue: salesByDay[date]?.rev ?? 0,
    })
    cur.setDate(cur.getDate() + 1)
  }

  const metaOk = Object.keys(clicksByDay).length > 0

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: T.bg, fontFamily: fonts.ui, color: T.ink }}>
      <Sidebar />
      <main className="dash-main" style={{ marginLeft: 234, flex: 1, height: '100vh', overflowY: 'auto', padding: 32 }}>
        <ConversaoClient days={days} metaOk={metaOk} />
      </main>
    </div>
  )
}
