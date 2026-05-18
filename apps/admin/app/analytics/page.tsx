import { createAdminClient } from '../../lib/supabase'
import { getQuizAdSpend } from '../../lib/meta-ads-quiz'
import Sidebar from '../components/Sidebar'

export const revalidate = 60
export const metadata = { title: 'Analytics — Admin Plano da Ju' }

const accent = '#C4607A'
const green  = '#34C759'
const orange = '#FF9500'
const red    = '#FF3B30'
const blue   = '#007AFF'
const gray   = '#8A8A8E'

function brl(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

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
  const yesterday  = new Date(now); yesterday.setDate(yesterday.getDate() - 1); yesterday.setHours(0,0,0,0)
  const yesterdayEnd = new Date(now); yesterdayEnd.setHours(0,0,0,0)

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
    // Funil do quiz
    quizViewsToday,
    quizViewsYesterday,
    quizViewsMonth,
    leadsToday,
    leadsYesterday,
    leadsMonth,
    offerViewsToday,
    offerViewsYesterday,
    checkoutToday,
    checkoutYesterday,
    // Meta Ads
    metaAds,
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
    // Funil
    (sb.from('wg_quiz_views') as any).select('*', { count: 'exact', head: true }).eq('quiz_slug', 'plano-capilar').gte('created_at', todayStart.toISOString()),
    (sb.from('wg_quiz_views') as any).select('*', { count: 'exact', head: true }).eq('quiz_slug', 'plano-capilar').gte('created_at', yesterday.toISOString()).lt('created_at', yesterdayEnd.toISOString()),
    (sb.from('wg_quiz_views') as any).select('*', { count: 'exact', head: true }).eq('quiz_slug', 'plano-capilar').gte('created_at', day30ago),
    (sb.from('wg_quiz_leads') as any).select('*', { count: 'exact', head: true }).eq('quiz_slug', 'plano-capilar').gte('created_at', todayStart.toISOString()),
    (sb.from('wg_quiz_leads') as any).select('*', { count: 'exact', head: true }).eq('quiz_slug', 'plano-capilar').gte('created_at', yesterday.toISOString()).lt('created_at', yesterdayEnd.toISOString()),
    (sb.from('wg_quiz_leads') as any).select('*', { count: 'exact', head: true }).eq('quiz_slug', 'plano-capilar').gte('created_at', day30ago),
    (sb.from('checkout_events') as any).select('*', { count: 'exact', head: true }).eq('event_type', 'offer_viewed').gte('created_at', todayStart.toISOString()),
    (sb.from('checkout_events') as any).select('*', { count: 'exact', head: true }).eq('event_type', 'offer_viewed').gte('created_at', yesterday.toISOString()).lt('created_at', yesterdayEnd.toISOString()),
    (sb.from('checkout_events') as any).select('*', { count: 'exact', head: true }).eq('event_type', 'checkout_initiated').gte('created_at', todayStart.toISOString()),
    (sb.from('checkout_events') as any).select('*', { count: 'exact', head: true }).eq('event_type', 'checkout_initiated').gte('created_at', yesterday.toISOString()).lt('created_at', yesterdayEnd.toISOString()),
    getQuizAdSpend(),
  ])

  // New users chart (last 14d)
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

  // Funil helpers
  const qToday = quizViewsToday.count ?? 0
  const qYest  = quizViewsYesterday.count ?? 0
  const lToday = leadsToday.count ?? 0
  const lYest  = leadsYesterday.count ?? 0
  const oToday = offerViewsToday.count ?? 0
  const oYest  = offerViewsYesterday.count ?? 0
  const cToday = checkoutToday.count ?? 0
  const cYest  = checkoutYesterday.count ?? 0

  function pct(a: number, b: number) {
    if (!b) return '—'
    return `${Math.round((a / b) * 100)}%`
  }

  // Meta Ads daily chart
  const maxSpend = Math.max(1, ...metaAds.daily.map(d => d.spend))

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

        {/* ── Meta Ads ─────────────────────────────────────────── */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: gray, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            📡 Meta Ads — Investimento
            {metaAds.status === 'ok' && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: green + '18', color: green }}>
                ● ao vivo
              </span>
            )}
            {metaAds.status === 'not_configured' && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: orange + '18', color: orange }}>
                ⚠️ Token não configurado
              </span>
            )}
            {metaAds.status === 'error' && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: red + '18', color: red }}>
                ✗ Erro na API
              </span>
            )}
          </div>
        </div>

        {metaAds.status === 'not_configured' && (
          <div style={{
            background: '#fff', borderRadius: 14, border: `1px solid ${orange}30`,
            padding: '18px 24px', marginBottom: 24,
            display: 'flex', alignItems: 'flex-start', gap: 14,
          }}>
            <div style={{ fontSize: 28, flexShrink: 0 }}>📱</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#2D1B2E', marginBottom: 6 }}>
                Conectar Meta Ads — Plano da Ju
              </div>
              <div style={{ fontSize: 12.5, color: gray, lineHeight: 1.7 }}>
                Para ativar, adicione estas variáveis de ambiente no Vercel (Admin → Settings → Environment Variables):
              </div>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { key: 'META_ADS_QUIZ_TOKEN', desc: 'Token do usuário de sistema (ads_read + read_insights)' },
                  { key: 'META_ADS_QUIZ_ACCOUNT', desc: 'act_306090736984417  (DIN - decisões inteligentes)' },
                ].map(({ key, desc }) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <code style={{ background: '#F5F5F7', padding: '3px 8px', borderRadius: 5, fontSize: 12, fontFamily: 'monospace', color: '#2D1B2E' }}>{key}</code>
                    <span style={{ fontSize: 11.5, color: gray }}>{desc}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11.5, color: gray, marginTop: 10 }}>
                Gere o token em:{' '}
                <strong style={{ color: '#2D1B2E' }}>
                  business.facebook.com → Configurações → Usuários do sistema → Gerar token
                </strong>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
          <StatCard icon="💸" label="Hoje" value={metaAds.status === 'ok' ? brl(metaAds.today) : '—'} color={blue} sub="investido hoje" />
          <StatCard icon="📅" label="Ontem" value={metaAds.status === 'ok' ? brl(metaAds.yesterday) : '—'} color={blue} />
          <StatCard icon="📆" label="Mês atual" value={metaAds.status === 'ok' ? brl(metaAds.thisMonth) : '—'} color={accent} sub={metaAds.status === 'ok' ? `${brl(metaAds.lastMonth)} mês passado` : undefined} />
          <StatCard icon="📣" label="Campanhas ativas" value={metaAds.status === 'ok' ? metaAds.campaigns.filter(c => c.spend > 0).length : '—'} color="#2D1B2E" sub="com gasto este mês" />
        </div>

        {/* Meta Ads — gráfico diário + tabela de campanhas */}
        {metaAds.status === 'ok' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>

            {/* Gráfico 7 dias */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 24px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#2D1B2E', marginBottom: 20 }}>
                Investimento — últimos 7 dias
              </div>
              {metaAds.daily.length === 0 ? (
                <div style={{ fontSize: 13, color: gray, textAlign: 'center', padding: '24px 0' }}>Sem dados</div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 90 }}>
                  {metaAds.daily.map((d, i) => {
                    const isLast = i === metaAds.daily.length - 1
                    const h = d.spend > 0 ? Math.max(6, (d.spend / maxSpend) * 78) : 3
                    return (
                      <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        {d.spend > 0 && (
                          <div style={{ fontSize: 8.5, fontWeight: 700, color: isLast ? blue : '#2D1B2E', whiteSpace: 'nowrap' }}>
                            R${d.spend.toFixed(0)}
                          </div>
                        )}
                        <div style={{
                          width: '100%', height: h, borderRadius: '3px 3px 0 0',
                          background: d.spend === 0 ? '#F2F2F7' : isLast ? 'rgba(0,122,255,0.4)' : blue,
                          opacity: d.spend === 0 ? 0.4 : 0.85,
                        }} />
                        <div style={{ fontSize: 9, color: isLast ? blue : gray, fontWeight: isLast ? 700 : 400, whiteSpace: 'nowrap' }}>
                          {d.label}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Campanhas */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 24px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#2D1B2E', marginBottom: 16 }}>
                Campanhas — mês atual
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                {metaAds.campaigns.length === 0 && (
                  <div style={{ fontSize: 13, color: gray }}>Nenhuma campanha com gasto</div>
                )}
                {metaAds.campaigns.map((c, i) => (
                  <div key={c.campaign_id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    padding: '8px 10px', borderRadius: 8,
                    background: i % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent',
                  }}>
                    <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#2D1B2E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.campaign_name}
                      </div>
                      <div style={{ fontSize: 10.5, color: gray, marginTop: 2 }}>
                        {c.impressions.toLocaleString('pt-BR')} imp · {c.clicks.toLocaleString('pt-BR')} cliques
                        {c.ctr != null && ` · CTR ${c.ctr.toFixed(2)}%`}
                        {c.cpc != null && ` · CPC R$${c.cpc.toFixed(2)}`}
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: blue, flexShrink: 0 }}>
                      {brl(c.spend)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Funil do Quiz ─────────────────────────────────────── */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: gray, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
            🎯 Funil — Quiz Plano Capilar
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', marginBottom: 28, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #F0F0F5' }}>
                {['Etapa', 'Hoje', 'Conv.', 'Ontem', 'Conv.', 'Mês'].map((h, i) => (
                  <th key={i} style={{
                    padding: '11px 20px', textAlign: i === 0 ? 'left' : 'right',
                    fontSize: 11, color: gray, fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: 0.4,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { icon: '🔵', label: 'Entrou no quiz',    today: qToday, yest: qYest,  month: quizViewsMonth.count ?? 0,  convToday: null,              convYest: null },
                { icon: '📋', label: 'Completou (lead)',  today: lToday, yest: lYest,  month: leadsMonth.count ?? 0,      convToday: pct(lToday, qToday), convYest: pct(lYest, qYest) },
                { icon: '🛒', label: 'Viu a oferta',      today: oToday, yest: oYest,  month: null,                        convToday: pct(oToday, lToday), convYest: pct(oYest, lYest) },
                { icon: '💳', label: 'Iniciou checkout',  today: cToday, yest: cYest,  month: null,                        convToday: pct(cToday, oToday), convYest: pct(cYest, oYest) },
              ].map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F9F9FC' }}>
                  <td style={{ padding: '12px 20px', fontSize: 13, color: '#2D1B2E', fontWeight: 600 }}>
                    <span style={{ marginRight: 6 }}>{row.icon}</span>{row.label}
                  </td>
                  <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: 14, fontWeight: 700, color: accent }}>{row.today}</td>
                  <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: 12, color: row.convToday === '—' ? gray : green, fontWeight: 600 }}>{row.convToday ?? '—'}</td>
                  <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: 14, fontWeight: 700, color: '#2D1B2E' }}>{row.yest}</td>
                  <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: 12, color: row.convYest === '—' ? gray : green, fontWeight: 600 }}>{row.convYest ?? '—'}</td>
                  <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: 13, color: gray }}>{row.month ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Usuárias & App ─────────────────────────────────────── */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: gray, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
            👥 Usuárias & App
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          <StatCard icon="👥" label="Total usuárias" value={(totalUsers.count ?? 0).toLocaleString('pt-BR')} sub="cadastradas" />
          <StatCard icon="✅" label="Assinantes ativas" value={(activeUsers.count ?? 0).toLocaleString('pt-BR')} color={green} sub={`${((activeUsers.count ?? 0) / Math.max(1, totalUsers.count ?? 1) * 100).toFixed(0)}% do total`} />
          <StatCard icon="🆕" label="Novas esta semana" value={newLast7.count ?? 0} color={accent} sub={`${newLast30.count ?? 0} no mês`} />
          <StatCard icon="📝" label="Planos pendentes" value={pendingPlans.count ?? 0} color={pendingPlans.count ? orange : '#2D1B2E'} sub={`de ${totalPlans.count ?? 0} total`} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 28 }}>
          {/* Mini bar chart — novas usuárias */}
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

          {/* Check-ins */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 24px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#2D1B2E', marginBottom: 16 }}>Check-ins</div>
            {[
              { label: 'Hoje',        value: checkInsToday.count ?? 0,  color: accent },
              { label: 'Últimos 7d',  value: checkInsLast7.count ?? 0,  color: blue },
              { label: 'Últimos 30d', value: checkInsLast30.count ?? 0, color: green },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F5F5F7' }}>
                <div style={{ fontSize: 13, color: gray }}>{label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Grupos clicks */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#2D1B2E', marginBottom: 16 }}>
            Grupos de Promoções — cliques no link
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { label: 'Hoje',       value: clicksToday.count ?? 0 },
              { label: 'Últimos 7d', value: clicksLast7.count ?? 0 },
              { label: 'Total',      value: totalClicks.count ?? 0 },
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
