import { createAdminClient } from '../../lib/supabase'
import { getQuizAdSpend, type AdGroupResult } from '../../lib/meta-ads-quiz'
import { fetchYberaOrders, salesOnDateBR, salesTotal, YBERA_COMMISSION_RATE } from '../../lib/ybera-api'
import Sidebar from '../components/Sidebar'

export const revalidate = 60
export const metadata = { title: 'Analytics — Admin Plano da Ju' }

const accent = '#C4607A'
const green  = '#34C759'
const orange = '#FF9500'
const red    = '#FF3B30'
const blue   = '#007AFF'
const gray   = '#8A8A8E'

// Preço do plano (R$34,90 cartão). Usado pra estimar receita do dia
// quando não temos uma coluna `amount_cents` confiável por perfil.
const PLAN_PRICE = 34.90

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

function SectionHeader({ icon, title, subtitle, accentColor }: { icon: string; title: string; subtitle: string; accentColor: string }) {
  return (
    <div style={{
      marginBottom: 16, padding: '14px 18px',
      background: '#fff', borderRadius: 14,
      borderLeft: `4px solid ${accentColor}`,
      border: '1px solid rgba(0,0,0,0.06)',
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 12,
        background: accentColor + '15', color: accentColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, flexShrink: 0,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#2D1B2E' }}>{title}</div>
        <div style={{ fontSize: 12, color: gray, marginTop: 2 }}>{subtitle}</div>
      </div>
    </div>
  )
}

function AdGroupDailyChart({ data, color, label }: { data: AdGroupResult['daily']; color: string; label: string }) {
  if (data.length === 0) {
    return <div style={{ fontSize: 13, color: gray, textAlign: 'center', padding: '24px 0' }}>Sem dados</div>
  }
  const maxSpend = Math.max(1, ...data.map(d => d.spend))
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: gray, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label} — últimos 7 dias
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 90 }}>
        {data.map((d, i) => {
          const isLast = i === data.length - 1
          const h = d.spend > 0 ? Math.max(6, (d.spend / maxSpend) * 78) : 3
          return (
            <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              {d.spend > 0 && (
                <div style={{ fontSize: 8.5, fontWeight: 700, color: isLast ? color : '#2D1B2E', whiteSpace: 'nowrap' }}>
                  R${d.spend.toFixed(0)}
                </div>
              )}
              <div style={{
                width: '100%', height: h, borderRadius: '3px 3px 0 0',
                background: d.spend === 0 ? '#F2F2F7' : color,
                opacity: d.spend === 0 ? 0.4 : isLast ? 1 : 0.85,
              }} />
              <div style={{ fontSize: 9, color: isLast ? color : gray, fontWeight: isLast ? 700 : 400, whiteSpace: 'nowrap' }}>
                {d.label}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CampaignList({ campaigns, color }: { campaigns: AdGroupResult['campaigns']; color: string }) {
  if (campaigns.length === 0) {
    return <div style={{ fontSize: 13, color: gray, padding: '12px 0' }}>Nenhuma campanha com gasto este mês</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
      {campaigns.map((c, i) => (
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
              {c.impressions.toLocaleString('pt-BR')} imp · {c.link_clicks.toLocaleString('pt-BR')} cliques no link
              {c.ctr != null && ` · CTR ${c.ctr.toFixed(2)}%`}
              {c.cpc != null && ` · CPC R$${c.cpc.toFixed(2)}`}
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color, flexShrink: 0 }}>
            {brl(c.spend)}
          </div>
        </div>
      ))}
    </div>
  )
}

export default async function AnalyticsPage() {
  const sb = createAdminClient()
  const now = new Date()

  // ── Janelas em horário de Brasília (UTC-3) ─────────────────────
  // Brasília atual em ISO
  const brasiliaOffsetMs = 3 * 60 * 60 * 1000
  const brasiliaNow = new Date(now.getTime() - brasiliaOffsetMs)
  const yyyy = brasiliaNow.getUTCFullYear()
  const mm   = String(brasiliaNow.getUTCMonth() + 1).padStart(2, '0')
  const dd   = String(brasiliaNow.getUTCDate()).padStart(2, '0')
  // Meia-noite BR = 03:00 UTC do mesmo dia
  const todayStartBR     = new Date(`${yyyy}-${mm}-${dd}T03:00:00.000Z`)
  const yesterdayStartBR = new Date(todayStartBR.getTime() - 86400_000)
  const monthStartBR     = new Date(`${yyyy}-${mm}-01T03:00:00.000Z`)
  const day7agoBR        = new Date(todayStartBR.getTime() -  7 * 86400_000)
  const day30agoBR       = new Date(todayStartBR.getTime() - 30 * 86400_000)

  const [
    // Plano — usuárias / receita
    totalUsers,
    activeUsers,
    activeToday,
    activeYesterday,
    activeMonth,
    newLast7,
    // Funil quiz
    quizViewsToday, quizViewsYesterday, quizViewsMonth,
    leadsToday, leadsYesterday, leadsMonth,
    offerViewsToday, offerViewsYesterday,
    checkoutToday, checkoutYesterday,
    offerViewsMonth, checkoutMonth,
    interactTodayRaw, interactYestRaw, interactMonthRaw,
    // Grupos
    groupJoinsToday,
    groupJoinsYesterday,
    groupJoinsMonth,
    totalClicks,
    clicksToday,
    clicksLast7,
    // App geral
    totalPlans,
    pendingPlans,
    checkInsToday,
    checkInsLast7,
    checkInsLast30,
    // Meta Ads
    metaAds,
    // Ybera orders (pra calcular vendas/comissão dos grupos)
    yberaMonthOrders,
  ] = await Promise.all([
    // Plano
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('profiles') as any).select('*', { count: 'exact', head: true }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('profiles') as any).select('*', { count: 'exact', head: true }).eq('subscription_status', 'active'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('profiles') as any).select('*', { count: 'exact', head: true }).eq('subscription_status', 'active').gte('subscription_activated_at', todayStartBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('profiles') as any).select('*', { count: 'exact', head: true }).eq('subscription_status', 'active').gte('subscription_activated_at', yesterdayStartBR.toISOString()).lt('subscription_activated_at', todayStartBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('profiles') as any).select('*', { count: 'exact', head: true }).eq('subscription_status', 'active').gte('subscription_activated_at', monthStartBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('profiles') as any).select('*', { count: 'exact', head: true }).gte('created_at', day7agoBR.toISOString()),
    // Funil
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_views') as any).select('*', { count: 'exact', head: true }).eq('quiz_slug', 'plano-capilar').gte('created_at', todayStartBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_views') as any).select('*', { count: 'exact', head: true }).eq('quiz_slug', 'plano-capilar').gte('created_at', yesterdayStartBR.toISOString()).lt('created_at', todayStartBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_views') as any).select('*', { count: 'exact', head: true }).eq('quiz_slug', 'plano-capilar').gte('created_at', day30agoBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_leads') as any).select('*', { count: 'exact', head: true }).eq('quiz_slug', 'plano-capilar').gte('created_at', todayStartBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_leads') as any).select('*', { count: 'exact', head: true }).eq('quiz_slug', 'plano-capilar').gte('created_at', yesterdayStartBR.toISOString()).lt('created_at', todayStartBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_leads') as any).select('*', { count: 'exact', head: true }).eq('quiz_slug', 'plano-capilar').gte('created_at', day30agoBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('checkout_events') as any).select('*', { count: 'exact', head: true }).eq('event_type', 'offer_viewed').gte('created_at', todayStartBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('checkout_events') as any).select('*', { count: 'exact', head: true }).eq('event_type', 'offer_viewed').gte('created_at', yesterdayStartBR.toISOString()).lt('created_at', todayStartBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('checkout_events') as any).select('*', { count: 'exact', head: true }).eq('event_type', 'checkout_initiated').gte('created_at', todayStartBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('checkout_events') as any).select('*', { count: 'exact', head: true }).eq('event_type', 'checkout_initiated').gte('created_at', yesterdayStartBR.toISOString()).lt('created_at', todayStartBR.toISOString()),
    // Offer/checkout 30d (pra coluna mês do funil)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('checkout_events') as any).select('*', { count: 'exact', head: true }).eq('event_type', 'offer_viewed').gte('created_at', day30agoBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('checkout_events') as any).select('*', { count: 'exact', head: true }).eq('event_type', 'checkout_initiated').gte('created_at', day30agoBR.toISOString()),
    // "Interagiu" = sessions únicas com step_index=0 answered
    // (clicou em alguma opção da página inicial do quiz)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_step_events') as any).select('session_id').eq('quiz_slug', 'plano-capilar').eq('step_index', 0).eq('event_type', 'answered').gte('created_at', todayStartBR.toISOString()).limit(5000),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_step_events') as any).select('session_id').eq('quiz_slug', 'plano-capilar').eq('step_index', 0).eq('event_type', 'answered').gte('created_at', yesterdayStartBR.toISOString()).lt('created_at', todayStartBR.toISOString()).limit(5000),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_step_events') as any).select('session_id').eq('quiz_slug', 'plano-capilar').eq('step_index', 0).eq('event_type', 'answered').gte('created_at', day30agoBR.toISOString()).limit(20000),
    // Grupos — joins (cadastros novos) e cliques
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_member_events') as any).select('*', { count: 'exact', head: true }).eq('action', 'join').gte('created_at', todayStartBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_member_events') as any).select('*', { count: 'exact', head: true }).eq('action', 'join').gte('created_at', yesterdayStartBR.toISOString()).lt('created_at', todayStartBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_member_events') as any).select('*', { count: 'exact', head: true }).eq('action', 'join').gte('created_at', monthStartBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_redirect_clicks') as any).select('*', { count: 'exact', head: true }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_redirect_clicks') as any).select('*', { count: 'exact', head: true }).gte('created_at', todayStartBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_redirect_clicks') as any).select('*', { count: 'exact', head: true }).gte('created_at', day7agoBR.toISOString()),
    // App
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('hair_plans') as any).select('*', { count: 'exact', head: true }).eq('week_number', 1),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('hair_plans') as any).select('*', { count: 'exact', head: true }).eq('week_number', 1).eq('approved_by_juliane', false),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('check_ins') as any).select('*', { count: 'exact', head: true }).gte('checked_at', todayStartBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('check_ins') as any).select('*', { count: 'exact', head: true }).gte('checked_at', day7agoBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('check_ins') as any).select('*', { count: 'exact', head: true }).gte('checked_at', day30agoBR.toISOString()),
    // Meta Ads
    getQuizAdSpend(),
    // Vendas Ybera do mês até hoje (usado pra cruzar com investimento Grupos)
    // Fetch só uma vez do mês inteiro — distribuímos por dia em JS.
    (async () => {
      const since = `${yyyy}-${mm}-01`
      const until = `${yyyy}-${mm}-${dd}`
      return await fetchYberaOrders(since, until)
    })(),
  ])

  // ── PLANO: KPIs derivados ────────────────────────────────────────
  const planoSpendToday      = metaAds.plano.today
  const planoSpendYesterday  = metaAds.plano.yesterday
  const planoSpendMonth      = metaAds.plano.thisMonth

  const salesToday      = activeToday.count ?? 0
  const salesYesterday  = activeYesterday.count ?? 0
  const salesMonth      = activeMonth.count ?? 0

  const revenueToday      = salesToday      * PLAN_PRICE
  const revenueYesterday  = salesYesterday  * PLAN_PRICE
  const revenueMonth      = salesMonth      * PLAN_PRICE

  const roasToday = planoSpendToday    > 0 ? revenueToday    / planoSpendToday    : null
  const roasMonth = planoSpendMonth    > 0 ? revenueMonth    / planoSpendMonth    : null
  const cpaToday  = salesToday         > 0 ? planoSpendToday / salesToday         : null
  const cpaMonth  = salesMonth         > 0 ? planoSpendMonth / salesMonth         : null

  // Lucro = receita - investimento (não inclui custos operacionais)
  const profitToday = revenueToday - planoSpendToday
  const profitMonth = revenueMonth - planoSpendMonth

  // ── GRUPOS: KPIs ─────────────────────────────────────────────────
  const gruposSpendToday      = metaAds.grupos.today
  const gruposSpendYesterday  = metaAds.grupos.yesterday
  const gruposSpendMonth      = metaAds.grupos.thisMonth

  const joinsToday     = groupJoinsToday.count     ?? 0
  const joinsYesterday = groupJoinsYesterday.count ?? 0
  const joinsMonth     = groupJoinsMonth.count     ?? 0

  const cpjToday = joinsToday > 0 ? gruposSpendToday / joinsToday : null   // custo por cadastro hoje
  const cpjMonth = joinsMonth > 0 ? gruposSpendMonth / joinsMonth : null

  // ── YBERA: vendas + comissão (20%) cruzando com investimento Grupos ─
  const yberaOrders = yberaMonthOrders.orders ?? []
  const yberaStatus = yberaMonthOrders.status
  const todayBR     = `${yyyy}-${mm}-${dd}`
  const ddYest      = String(new Date(todayStartBR.getTime() - 86400_000).getUTCDate()).padStart(2, '0')
  const yesterdayBR = `${yyyy}-${mm}-${ddYest}`  // simplificação — assume mesmo mês (vira do mês precisa ajuste)

  const yberaSalesToday     = salesOnDateBR(yberaOrders, todayBR)
  const yberaSalesYesterday = salesOnDateBR(yberaOrders, yesterdayBR)
  const yberaSalesMonth     = salesTotal(yberaOrders)

  const commissionToday     = yberaSalesToday     * YBERA_COMMISSION_RATE
  const commissionYesterday = yberaSalesYesterday * YBERA_COMMISSION_RATE
  const commissionMonth     = yberaSalesMonth     * YBERA_COMMISSION_RATE

  // Lucro líquido = comissão - investimento (não inclui custos operacionais)
  const gruposProfitToday = commissionToday - gruposSpendToday
  const gruposProfitMonth = commissionMonth - gruposSpendMonth

  // ROAS dos Grupos = comissão / investimento (verde se ≥1x)
  const gruposRoasToday = gruposSpendToday > 0 ? commissionToday / gruposSpendToday : null
  const gruposRoasMonth = gruposSpendMonth > 0 ? commissionMonth / gruposSpendMonth : null

  // Funil — Meta Ads (top of funnel)
  // Importante: usar inline_link_clicks ("Cliques no link"), NÃO clicks (todos).
  // Cliques "todos" inclui CTA, like, share, perfil — não corresponde a tráfego pra LP.
  const adClicksToday = metaAds.plano.funnelToday.link_clicks
  const adClicksYest  = metaAds.plano.funnelYesterday.link_clicks
  const adClicksMonth = metaAds.plano.funnelMonth.link_clicks
  const lpvToday      = metaAds.plano.funnelToday.landing_page_views
  const lpvYest       = metaAds.plano.funnelYesterday.landing_page_views
  const lpvMonth      = metaAds.plano.funnelMonth.landing_page_views

  // Funil — Interagiu com o quiz (clicou em alguma opção da página inicial)
  // Dedupe session_id em JS porque Supabase JS não tem count distinct nativo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uniq = (rows: any): number => {
    if (!rows?.data) return 0
    const s = new Set<string>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of rows.data as any[]) if (r.session_id) s.add(r.session_id)
    return s.size
  }
  const iToday = uniq(interactTodayRaw)
  const iYest  = uniq(interactYestRaw)
  const iMonth = uniq(interactMonthRaw)

  // Funil — quiz interno
  const qToday = quizViewsToday.count ?? 0
  const qYest  = quizViewsYesterday.count ?? 0
  const qMonth = quizViewsMonth.count ?? 0
  const lToday = leadsToday.count ?? 0
  const lYest  = leadsYesterday.count ?? 0
  const lMonth = leadsMonth.count ?? 0
  const oToday = offerViewsToday.count ?? 0
  const oYest  = offerViewsYesterday.count ?? 0
  const oMonth = offerViewsMonth.count ?? 0
  const cToday = checkoutToday.count ?? 0
  const cYest  = checkoutYesterday.count ?? 0
  const cMonth = checkoutMonth.count ?? 0

  function pct(a: number, b: number) {
    if (!b) return '—'
    return `${Math.round((a / b) * 100)}%`
  }

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
            {metaAds.status === 'ok' && (
              <span style={{ marginLeft: 12, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: green + '18', color: green }}>
                ● meta ads ao vivo
              </span>
            )}
            {metaAds.status === 'not_configured' && (
              <span style={{ marginLeft: 12, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: orange + '18', color: orange }}>
                ⚠️ meta ads token não configurado
              </span>
            )}
            {metaAds.status === 'error' && (
              <span style={{ marginLeft: 12, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: red + '18', color: red }}>
                ✗ erro meta ads
              </span>
            )}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* SEÇÃO 1: PLANO CAPILAR                                          */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <SectionHeader
          icon="💇‍♀️"
          title="Plano Capilar — Anúncios com 'Plano' no nome"
          subtitle={`Receita = vendas × R$${PLAN_PRICE.toFixed(2)} (preço cartão). Lucro = receita − investimento.`}
          accentColor={accent}
        />

        {/* KPIs Plano */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
          <StatCard icon="💸" label="Investimento hoje" value={brl(planoSpendToday)} color={blue} sub={`ontem ${brl(planoSpendYesterday)}`} />
          <StatCard icon="💰" label="Receita hoje" value={brl(revenueToday)} color={green} sub={`${salesToday} venda${salesToday !== 1 ? 's' : ''}`} />
          <StatCard
            icon="📊"
            label="ROAS hoje"
            value={roasToday !== null ? `${roasToday.toFixed(2)}x` : '—'}
            color={roasToday !== null && roasToday >= 1 ? green : roasToday !== null ? red : gray}
            sub={roasToday !== null ? (roasToday >= 1 ? 'lucrativo' : 'no prejuízo') : 'sem investimento hoje'}
          />
          <StatCard
            icon={profitToday >= 0 ? '📈' : '📉'}
            label="Lucro hoje"
            value={brl(profitToday)}
            color={profitToday >= 0 ? green : red}
            sub={`R$ ${cpaToday !== null ? cpaToday.toFixed(2) : '—'} custo/venda`}
          />
        </div>

        {/* KPIs mês */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
          <StatCard label="Investimento mês" value={brl(planoSpendMonth)} sub="acumulado" />
          <StatCard label="Receita mês" value={brl(revenueMonth)} color={green} sub={`${salesMonth} venda${salesMonth !== 1 ? 's' : ''}`} />
          <StatCard
            label="ROAS mês"
            value={roasMonth !== null ? `${roasMonth.toFixed(2)}x` : '—'}
            color={roasMonth !== null && roasMonth >= 1 ? green : roasMonth !== null ? red : gray}
            sub={cpaMonth !== null ? `CPA R$${cpaMonth.toFixed(2)}` : undefined}
          />
          <StatCard
            label="Lucro mês"
            value={brl(profitMonth)}
            color={profitMonth >= 0 ? green : red}
          />
        </div>

        {/* Plano — gráfico + campanhas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 24px' }}>
            <AdGroupDailyChart data={metaAds.plano.daily} color={accent} label="Investimento (Plano)" />
          </div>
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 24px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: gray, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Campanhas Plano — mês atual
            </div>
            <CampaignList campaigns={metaAds.plano.campaigns} color={accent} />
          </div>
        </div>

        {/* Funil Plano — completo: Meta Ads → Quiz → Compra */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', marginBottom: 36, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0F0F5', fontSize: 12, fontWeight: 700, color: '#2D1B2E', letterSpacing: 0.2 }}>
            Funil de conversão — Anúncio → Compra
            <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 500, color: gray, textTransform: 'none' }}>
              · Conv. = % que avança da etapa anterior
            </span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #F0F0F5' }}>
                {['Etapa', 'Hoje', 'Conv.', 'Ontem', 'Conv.', '30d', 'Conv. 30d'].map((h, i) => (
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
                // Top of funnel — Meta Ads
                { icon: '🖱️', label: 'Cliques no link (Meta)', today: adClicksToday, yest: adClicksYest, month: adClicksMonth,
                  convToday: null, convYest: null, convMonth: null,
                  source: 'meta', highlight: false },
                { icon: '👁️', label: 'Visualização de página',  today: lpvToday,      yest: lpvYest,      month: lpvMonth,
                  convToday: pct(lpvToday, adClicksToday),
                  convYest:  pct(lpvYest, adClicksYest),
                  convMonth: pct(lpvMonth, adClicksMonth),
                  source: 'meta', highlight: false },
                // Interação com o quiz — métrica chave de qualidade do tráfego
                { icon: '✍️', label: 'Interagiu (clicou na 1ª opção)', today: iToday, yest: iYest, month: iMonth,
                  convToday: pct(iToday, lpvToday || qToday),
                  convYest:  pct(iYest,  lpvYest  || qYest),
                  convMonth: pct(iMonth, lpvMonth || qMonth),
                  source: 'quiz', highlight: true },
                // Mid funnel — quiz interno
                { icon: '📋', label: 'Completou (lead)', today: lToday, yest: lYest, month: lMonth,
                  convToday: pct(lToday, iToday),
                  convYest:  pct(lYest,  iYest),
                  convMonth: pct(lMonth, iMonth),
                  source: 'quiz', highlight: false },
                { icon: '🛒', label: 'Viu a oferta', today: oToday, yest: oYest, month: oMonth,
                  convToday: pct(oToday, lToday),
                  convYest:  pct(oYest,  lYest),
                  convMonth: pct(oMonth, lMonth),
                  source: 'quiz', highlight: false },
                { icon: '💳', label: 'Iniciou checkout', today: cToday, yest: cYest, month: cMonth,
                  convToday: pct(cToday, oToday),
                  convYest:  pct(cYest,  oYest),
                  convMonth: pct(cMonth, oMonth),
                  source: 'quiz', highlight: false },
                { icon: '✅', label: 'Comprou', today: salesToday, yest: salesYesterday, month: salesMonth,
                  convToday: pct(salesToday, cToday),
                  convYest:  pct(salesYesterday, cYest),
                  convMonth: pct(salesMonth,  cMonth),
                  source: 'sale', highlight: true },
              ].map((row, i) => {
                const isMeta = row.source === 'meta'
                const isSale = row.source === 'sale'
                const valueColor = isMeta ? blue : isSale ? green : accent
                return (
                  <tr key={i} style={{
                    borderBottom: '1px solid #F9F9FC',
                    background: row.highlight ? 'rgba(196,96,122,0.04)' : 'transparent',
                  }}>
                    <td style={{ padding: '12px 20px', fontSize: 13, color: '#2D1B2E', fontWeight: 600 }}>
                      <span style={{ marginRight: 6 }}>{row.icon}</span>{row.label}
                      {isMeta && (
                        <span style={{
                          marginLeft: 6, fontSize: 9.5, fontWeight: 700,
                          padding: '2px 6px', borderRadius: 4,
                          background: blue + '15', color: blue,
                          letterSpacing: 0.3,
                        }}>META</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: 14, fontWeight: 700, color: valueColor }}>
                      {row.today.toLocaleString('pt-BR')}
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: 12, color: row.convToday === null || row.convToday === '—' ? gray : green, fontWeight: 600 }}>
                      {row.convToday ?? '—'}
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: 14, fontWeight: 700, color: '#2D1B2E' }}>
                      {row.yest.toLocaleString('pt-BR')}
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: 12, color: row.convYest === null || row.convYest === '—' ? gray : green, fontWeight: 600 }}>
                      {row.convYest ?? '—'}
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: 13, color: '#2D1B2E', fontWeight: 600 }}>
                      {row.month.toLocaleString('pt-BR')}
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: 12, color: row.convMonth === null || row.convMonth === '—' ? gray : green, fontWeight: 600 }}>
                      {row.convMonth ?? '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{
            padding: '11px 20px', borderTop: '1px solid #F0F0F5',
            fontSize: 11, color: gray, lineHeight: 1.55,
          }}>
            💡 <strong>Interagiu</strong> é a taxa de qualidade do tráfego — quem entra e clica na primeira opção do quiz mostra que o anúncio atraiu a pessoa certa. Quanto maior essa taxa, melhor o match anúncio×audiência.
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* SEÇÃO 2: GRUPOS YBERA                                           */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <SectionHeader
          icon="📱"
          title="Grupos Ybera — Anúncios com 'Grupos' no nome"
          subtitle={`Cruzamento: investimento (Meta) × vendas Ybera × comissão (${(YBERA_COMMISSION_RATE * 100).toFixed(0)}%). Comissão é o que recebemos.`}
          accentColor={blue}
        />

        {/* KPIs Grupos — linha 1: investimento + cadastros + custo/cadastro */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 14 }}>
          <StatCard
            icon="💸"
            label="Investimento hoje"
            value={brl(gruposSpendToday)}
            color={blue}
            sub={`ontem ${brl(gruposSpendYesterday)}`}
          />
          <StatCard
            icon="👥"
            label="Cadastros hoje"
            value={joinsToday}
            color={green}
            sub={`ontem ${joinsYesterday}`}
          />
          <StatCard
            icon="🎯"
            label="Custo/cadastro hoje"
            value={cpjToday !== null ? brl(cpjToday) : '—'}
            color={accent}
            sub={cpjToday === null ? (joinsToday === 0 ? 'sem cadastros' : 'sem investimento') : 'CPA do dia'}
          />
          <StatCard
            icon="📅"
            label="Custo/cadastro mês"
            value={cpjMonth !== null ? brl(cpjMonth) : '—'}
            color={accent}
            sub={`${joinsMonth} cadastro${joinsMonth !== 1 ? 's' : ''} · ${brl(gruposSpendMonth)} gasto`}
          />
        </div>

        {/* KPIs Grupos — linha 2: vendas Ybera + comissão (que recebemos) */}
        {yberaStatus === 'ok' ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 14 }}>
              <StatCard
                icon="🛍️"
                label="Vendas Ybera hoje"
                value={brl(yberaSalesToday)}
                color="#2D1B2E"
                sub={`ontem ${brl(yberaSalesYesterday)}`}
              />
              <StatCard
                icon="🤝"
                label="Comissão hoje"
                value={brl(commissionToday)}
                color={green}
                sub={`${(YBERA_COMMISSION_RATE * 100).toFixed(0)}% das vendas`}
              />
              <StatCard
                icon="📊"
                label="ROAS hoje"
                value={gruposRoasToday !== null ? `${gruposRoasToday.toFixed(2)}x` : '—'}
                color={gruposRoasToday !== null && gruposRoasToday >= 1 ? green : gruposRoasToday !== null ? red : gray}
                sub={gruposRoasToday !== null ? (gruposRoasToday >= 1 ? 'lucrativo' : 'no prejuízo') : 'sem investimento hoje'}
              />
              <StatCard
                icon={gruposProfitToday >= 0 ? '📈' : '📉'}
                label="Lucro hoje"
                value={brl(gruposProfitToday)}
                color={gruposProfitToday >= 0 ? green : red}
                sub="comissão − investimento"
              />
            </div>

            {/* Mês — totais consolidados */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
              <StatCard label="Vendas Ybera mês" value={brl(yberaSalesMonth)} color="#2D1B2E" sub={`${yberaOrders.length} pedido${yberaOrders.length !== 1 ? 's' : ''}`} />
              <StatCard label="Comissão mês"     value={brl(commissionMonth)} color={green} />
              <StatCard
                label="ROAS mês"
                value={gruposRoasMonth !== null ? `${gruposRoasMonth.toFixed(2)}x` : '—'}
                color={gruposRoasMonth !== null && gruposRoasMonth >= 1 ? green : gruposRoasMonth !== null ? red : gray}
              />
              <StatCard
                label="Lucro mês"
                value={brl(gruposProfitMonth)}
                color={gruposProfitMonth >= 0 ? green : red}
              />
            </div>
          </>
        ) : (
          <div style={{
            background: '#fff', borderRadius: 14, border: `1px solid ${orange}30`,
            padding: '14px 18px', marginBottom: 20,
            display: 'flex', gap: 12, alignItems: 'center',
          }}>
            <span style={{ fontSize: 22 }}>⚠️</span>
            <div style={{ fontSize: 13, color: gray }}>
              <strong style={{ color: '#2D1B2E' }}>Vendas Ybera indisponíveis</strong> — {
                yberaStatus === 'no_token'
                  ? 'configure YBERA_API_TOKEN no Vercel para ver comissão/lucro.'
                  : 'erro ao chamar API da Ybera. Tente recarregar.'
              }
            </div>
          </div>
        )}

        {/* Grupos — gráfico + campanhas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 24px' }}>
            <AdGroupDailyChart data={metaAds.grupos.daily} color={blue} label="Investimento (Grupos)" />
          </div>
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 24px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: gray, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Campanhas Grupos — mês atual
            </div>
            <CampaignList campaigns={metaAds.grupos.campaigns} color={blue} />
          </div>
        </div>

        {/* Cliques no link dos grupos */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 24px', marginBottom: 36 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#2D1B2E', marginBottom: 16 }}>
            Cliques no link de entrada dos grupos
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { label: 'Hoje',       value: clicksToday.count ?? 0 },
              { label: 'Últimos 7d', value: clicksLast7.count ?? 0 },
              { label: 'Total',      value: totalClicks.count ?? 0 },
            ].map(({ label, value }) => (
              <div key={label} style={{ textAlign: 'center', padding: '16px', background: '#F9F9FC', borderRadius: 10 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: blue }}>{value.toLocaleString('pt-BR')}</div>
                <div style={{ fontSize: 12, color: gray, marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: gray, marginTop: 12 }}>
            ⚠️ Cliques ≠ cadastros. Nem todo quem clica entra no grupo. O CPA acima usa os cadastros confirmados (Evolution webhook).
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* SEÇÃO 3: APP & USUÁRIAS (info geral)                            */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <SectionHeader
          icon="👥"
          title="App & Usuárias"
          subtitle="Visão geral da base de clientes e engajamento no app."
          accentColor="#2D1B2E"
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
          <StatCard icon="👥" label="Total usuárias" value={(totalUsers.count ?? 0).toLocaleString('pt-BR')} sub="cadastradas" />
          <StatCard
            icon="✅"
            label="Assinantes ativas"
            value={(activeUsers.count ?? 0).toLocaleString('pt-BR')}
            color={green}
            sub={`${((activeUsers.count ?? 0) / Math.max(1, totalUsers.count ?? 1) * 100).toFixed(0)}% do total`}
          />
          <StatCard icon="🆕" label="Novas usuárias 7d" value={newLast7.count ?? 0} color={accent} sub="cadastros recentes" />
          <StatCard icon="📝" label="Planos pendentes" value={pendingPlans.count ?? 0} color={pendingPlans.count ? orange : '#2D1B2E'} sub={`de ${totalPlans.count ?? 0} total`} />
        </div>

        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 24px', marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#2D1B2E', marginBottom: 16 }}>Check-ins no app</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { label: 'Hoje',        value: checkInsToday.count ?? 0,  color: accent },
              { label: 'Últimos 7d',  value: checkInsLast7.count ?? 0,  color: blue },
              { label: 'Últimos 30d', value: checkInsLast30.count ?? 0, color: green },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ textAlign: 'center', padding: '16px', background: '#F9F9FC', borderRadius: 10 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color }}>{value.toLocaleString('pt-BR')}</div>
                <div style={{ fontSize: 12, color: gray, marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  )
}
