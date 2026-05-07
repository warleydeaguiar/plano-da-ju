import { createAdminClient } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'

export const revalidate = 60
export const metadata = { title: 'Analytics — Admin Plano da Ju' }

const accent = '#C4607A'
const green  = '#34C759'
const orange = '#FF9500'
const gray   = '#8A8A8E'

function StatCard({ label, value, sub, color, icon }: {
  label: string; value: string | number; sub?: string; color?: string; icon?: string
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid rgba(0,0,0,0.06)' }}>
      {icon && <div style={{ fontSize: 20, marginBottom: 8 }}>{icon}</div>}
      <div style={{ fontSize: 12, color: gray, fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color ?? '#2D1B2E', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: gray, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

export default async function AnalyticsPage() {
  const sb = createAdminClient()
  const now = new Date()
  const day30ago = new Date(now.getTime() - 30 * 86400000).toISOString()
  const day7ago  = new Date(now.getTime() -  7 * 86400000).toISOString()
  const todayStart = new Date(now); todayStart.setHours(0,0,0,0)

  const [
    totalUsers,
    activeUsers,
    newLast30,
    newLast7,
    checkInsToday,
    checkInsLast7,
    checkInsLast30,
    totalPlans,
    pendingPlans,
    totalClicks,
    clicksToday,
    clicksLast7,
  ] = await Promise.all([
    (sb.from('profiles') as any).select('*', { count: 'exact', head: true }),
    (sb.from('profiles') as any).select('*', { count: 'exact', head: true }).eq('subscription_status', 'active'),
    (sb.from('profiles') as any).select('*', { count: 'exact', head: true }).gte('created_at', day30ago),
    (sb.from('profiles') as any).select('*', { count: 'exact', head: true }).gte('created_at', day7ago),
    (sb.from('check_ins') as any).select('*', { count: 'exact', head: true }).gte('checked_at', todayStart.toISOString()),
    (sb.from('check_ins') as any).select('*', { count: 'exact', head: true }).gte('checked_at', day7ago),
    (sb.from('check_ins') as any).select('*', { count: 'exact', head: true }).gte('checked_at', day30ago),
    (sb.from('hair_plans') as any).select('*', { count: 'exact', head: true }).eq('week_number', 1),
    (sb.from('hair_plans') as any).select('*', { count: 'exact', head: true }).eq('week_number', 1).eq('approved_by_juliane', false),
    (sb.from('wg_redirect_clicks') as any).select('*', { count: 'exact', head: true }),
    (sb.from('wg_redirect_clicks') as any).select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
    (sb.from('wg_redirect_clicks') as any).select('*', { count: 'exact', head: true }).gte('created_at', day7ago),
  ])

  // Check-in engagement rate (7d): check-ins per active user per week
  const avgCheckIns7d = activeUsers.count && activeUsers.count > 0
    ? (checkInsLast7.count! / activeUsers.count).toFixed(1)
    : '0'

  // New users per day (last 14 days) for mini chart
  const { data: recentSignups } = await (sb.from('profiles') as any)
    .select('created_at')
    .gte('created_at', new Date(now.getTime() - 14 * 86400000).toISOString())
    .order('created_at', { ascending: true })

  const dayBuckets: Record<string, number> = {}
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000)
    const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    dayBuckets[key] = 0
  }
  ;(recentSignups ?? []).forEach((r: any) => {
    const key = new Date(r.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    if (key in dayBuckets) dayBuckets[key]++
  })
  const chartData = Object.entries(dayBuckets)
  const maxVal = Math.max(1, ...chartData.map(([, v]) => v))

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: '#F5F5F7', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
    }}>
      <Sidebar />
      <main style={{ marginLeft: 220, flex: 1, height: '100vh', overflowY: 'auto', padding: '32px 40px' }}>

        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#2D1B2E' }}>Analytics</div>
          <div style={{ fontSize: 13, color: gray, marginTop: 4 }}>
            {now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        </div>

        {/* Top KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          <StatCard icon="👥" label="Total usuárias" value={(totalUsers.count ?? 0).toLocaleString('pt-BR')} sub="cadastradas" />
          <StatCard icon="✅" label="Assinantes ativas" value={(activeUsers.count ?? 0).toLocaleString('pt-BR')} color={green} sub={`${((activeUsers.count ?? 0) / Math.max(1, totalUsers.count ?? 1) * 100).toFixed(0)}% do total`} />
          <StatCard icon="🆕" label="Novas esta semana" value={newLast7.count ?? 0} color={accent} sub={`${newLast30.count ?? 0} no mês`} />
          <StatCard icon="📝" label="Planos pendentes" value={pendingPlans.count ?? 0} color={pendingPlans.count ? orange : '#2D1B2E'} sub={`de ${totalPlans.count ?? 0} total`} />
        </div>

        {/* Chart + Engajamento */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 28 }}>
          {/* Mini bar chart */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 24px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#2D1B2E', marginBottom: 20 }}>
              Novas usuárias — últimos 14 dias
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
              {chartData.map(([day, count], i) => {
                const isToday = i === chartData.length - 1
                const h = count > 0 ? Math.max(6, (count / maxVal) * 70) : 3
                return (
                  <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    {count > 0 && <div style={{ fontSize: 9, fontWeight: 700, color: isToday ? accent : '#2D1B2E' }}>{count}</div>}
                    <div style={{
                      width: '100%', height: h, borderRadius: '3px 3px 0 0',
                      background: count === 0 ? '#F2F2F7' : isToday ? 'rgba(196,96,122,0.4)' : accent,
                      opacity: count === 0 ? 0.4 : 0.85,
                    }} />
                    {i % 2 === 0 && <div style={{ fontSize: 9, color: isToday ? accent : gray, fontWeight: isToday ? 700 : 400, whiteSpace: 'nowrap' }}>{day}</div>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Engajamento check-ins */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 24px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#2D1B2E', marginBottom: 16 }}>Check-ins</div>
            {[
              { label: 'Hoje',       value: checkInsToday.count ?? 0, color: accent },
              { label: 'Últimos 7d', value: checkInsLast7.count ?? 0, color: '#007AFF' },
              { label: 'Últimos 30d',value: checkInsLast30.count ?? 0, color: green },
              { label: 'Média/usuária/semana', value: avgCheckIns7d, color: orange },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F5F5F7' }}>
                <div style={{ fontSize: 13, color: gray }}>{label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Grupos de Promoções clicks */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#2D1B2E', marginBottom: 16 }}>
            Grupos de Promoções — cliques no link
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { label: 'Hoje',        value: clicksToday.count ?? 0 },
              { label: 'Últimos 7d',  value: clicksLast7.count ?? 0 },
              { label: 'Total',       value: totalClicks.count ?? 0 },
            ].map(({ label, value }) => (
              <div key={label} style={{ textAlign: 'center', padding: '16px', background: '#F9F9FC', borderRadius: 10 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: accent }}>{value.toLocaleString('pt-BR')}</div>
                <div style={{ fontSize: 12, color: gray, marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  )
}
