import { createAdminClient } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'

export const revalidate = 30
export const metadata = { title: 'Checkout — Funil de Conversão' }

const accent = '#C4607A'
const green  = '#34C759'
const red    = '#FF453A'
const orange = '#FF9500'
const gray   = '#8A8A8E'

// Etapas em ordem do funil
const FUNNEL_STEPS: { key: string; label: string; icon: string }[] = [
  { key: 'offer_viewed',       label: 'Viu a oferta',           icon: '👀' },
  { key: 'checkout_initiated', label: 'Clicou em comprar',      icon: '🛒' },
  { key: 'pix_generated',      label: 'Gerou PIX',              icon: '📱' },
  { key: 'card_submitted',     label: 'Enviou cartão',          icon: '💳' },
  { key: 'payment_confirmed',  label: 'Pagou ✓',                icon: '✅' },
  { key: 'password_set',       label: 'Criou senha',            icon: '🔐' },
  { key: 'photo_uploaded',     label: 'Enviou foto',            icon: '📸' },
]

function StatCard({ label, value, sub, color }: {
  label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: 11, color: gray, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: color ?? '#2D1B2E', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: gray, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

interface FunnelRow {
  step: typeof FUNNEL_STEPS[number]
  count: number
  pctOfTop: number
  pctOfPrev: number
}

export default async function CheckoutFunnelPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>
}) {
  const params = await searchParams
  const days = parseInt(params.days ?? '7', 10)
  const since = new Date(Date.now() - days * 86400000).toISOString()

  const sb = createAdminClient()

  // Eventos do período
  const { data: events } = await sb
    .from('checkout_events')
    .select('event_type, session_id, email, payment_type, amount_cents, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })

  const allEvents = events ?? []

  // Conta SESSIONS únicas por step (não eventos)
  const sessionsByStep = new Map<string, Set<string>>()
  FUNNEL_STEPS.forEach(s => sessionsByStep.set(s.key, new Set()))
  for (const e of allEvents) {
    if (sessionsByStep.has(e.event_type)) {
      sessionsByStep.get(e.event_type)!.add(e.session_id)
    }
  }

  const topCount = sessionsByStep.get('offer_viewed')?.size ?? 0
  const funnel: FunnelRow[] = FUNNEL_STEPS.map((step, i) => {
    const count = sessionsByStep.get(step.key)?.size ?? 0
    const prevCount = i === 0 ? count : (sessionsByStep.get(FUNNEL_STEPS[i - 1].key)?.size ?? 0)
    return {
      step,
      count,
      pctOfTop: topCount > 0 ? (count / topCount) * 100 : 0,
      pctOfPrev: prevCount > 0 ? (count / prevCount) * 100 : 0,
    }
  })

  // Métricas-chave
  const paidCount = sessionsByStep.get('payment_confirmed')?.size ?? 0
  const failedCount = allEvents.filter(e => e.event_type === 'payment_failed').length
  const conversionRate = topCount > 0 ? (paidCount / topCount) * 100 : 0
  const totalRevenue = allEvents
    .filter(e => e.event_type === 'payment_confirmed')
    .reduce((acc, e) => acc + (e.amount_cents ?? 0), 0) / 100

  // Quebra por método de pagamento (compras confirmadas)
  const paymentBreakdown = { pix: 0, card: 0 }
  for (const e of allEvents) {
    if (e.event_type === 'payment_confirmed') {
      if (e.payment_type === 'pix') paymentBreakdown.pix++
      if (e.payment_type === 'card') paymentBreakdown.card++
    }
  }

  // Lista de eventos recentes (top 50)
  const recent = allEvents.slice(0, 50)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F5F2F4', fontFamily: '-apple-system, "Inter", system-ui, sans-serif' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '32px 40px', maxWidth: 1400 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#2D1B2E', marginBottom: 4 }}>Funil de Checkout</h1>
            <p style={{ fontSize: 13, color: gray }}>Onde as pessoas estão abandonando · últimos {days} dias</p>
          </div>
          <div style={{ display: 'flex', gap: 6, background: '#fff', padding: 4, borderRadius: 10, border: '1px solid rgba(0,0,0,0.06)' }}>
            {[1, 7, 30, 90].map(d => (
              <a key={d} href={`?days=${d}`}
                 style={{
                   padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                   textDecoration: 'none',
                   background: d === days ? accent : 'transparent',
                   color: d === days ? '#fff' : gray,
                 }}>
                {d === 1 ? 'Hoje' : `${d}d`}
              </a>
            ))}
          </div>
        </div>

        {/* Stats cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          <StatCard label="Visualizações" value={topCount} sub="Quem chegou na oferta" />
          <StatCard label="Compras" value={paidCount} sub={`R$ ${totalRevenue.toFixed(2)}`} color={green} />
          <StatCard label="Taxa Lead→Venda" value={`${conversionRate.toFixed(1)}%`} color={paidCount > 0 ? green : red} />
          <StatCard label="Pagamentos recusados" value={failedCount} color={failedCount > 0 ? red : gray} sub="Cartão negado" />
        </div>

        {/* Funil */}
        <div style={{ background: '#fff', borderRadius: 14, padding: '24px 28px', border: '1px solid rgba(0,0,0,0.06)', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#2D1B2E', marginBottom: 4 }}>Funil completo</h2>
          <p style={{ fontSize: 12, color: gray, marginBottom: 20 }}>% relativa ao passo anterior e à etapa inicial</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {funnel.map((row, i) => {
              const widthPct = Math.max(2, row.pctOfTop)
              const isDrop = i > 0 && row.pctOfPrev < 50 && row.count > 0 && funnel[i - 1].count > 0
              return (
                <div key={row.step.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 220, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{row.step.icon}</span>
                    <span style={{ fontSize: 13, color: '#2D1B2E', fontWeight: 600 }}>{row.step.label}</span>
                  </div>
                  <div style={{ flex: 1, height: 32, background: 'rgba(196,96,122,0.08)', borderRadius: 6, position: 'relative' }}>
                    <div style={{
                      width: `${widthPct}%`, height: '100%',
                      background: `linear-gradient(90deg, ${accent}, ${accent}99)`,
                      borderRadius: 6,
                      display: 'flex', alignItems: 'center', paddingLeft: 12,
                      color: '#fff', fontSize: 12, fontWeight: 700,
                    }}>
                      {row.count}
                    </div>
                  </div>
                  <div style={{ width: 80, textAlign: 'right', fontSize: 12, color: gray }}>
                    {row.pctOfTop.toFixed(1)}%
                  </div>
                  <div style={{
                    width: 70, textAlign: 'right', fontSize: 12, fontWeight: 700,
                    color: isDrop ? red : (i === 0 ? gray : green),
                  }}>
                    {i === 0 ? '—' : `${row.pctOfPrev.toFixed(0)}%`}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          {/* Quebra por método */}
          <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: '#2D1B2E', marginBottom: 16 }}>Método de pagamento (compras)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>📱 PIX</span>
                  <span style={{ fontWeight: 700 }}>{paymentBreakdown.pix}</span>
                </div>
                <div style={{ height: 8, background: 'rgba(0,0,0,0.05)', borderRadius: 99 }}>
                  <div style={{
                    width: `${paidCount > 0 ? (paymentBreakdown.pix / paidCount) * 100 : 0}%`,
                    height: '100%', background: accent, borderRadius: 99,
                  }} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>💳 Cartão</span>
                  <span style={{ fontWeight: 700 }}>{paymentBreakdown.card}</span>
                </div>
                <div style={{ height: 8, background: 'rgba(0,0,0,0.05)', borderRadius: 99 }}>
                  <div style={{
                    width: `${paidCount > 0 ? (paymentBreakdown.card / paidCount) * 100 : 0}%`,
                    height: '100%', background: orange, borderRadius: 99,
                  }} />
                </div>
              </div>
            </div>
          </div>

          {/* Maior gargalo */}
          <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: '#2D1B2E', marginBottom: 16 }}>Maior gargalo</h3>
            {(() => {
              // Encontra a maior queda
              let biggestDrop = { from: '', to: '', dropPct: 0, lost: 0 }
              for (let i = 1; i < funnel.length; i++) {
                const prev = funnel[i - 1]
                const curr = funnel[i]
                if (prev.count === 0) continue
                const dropPct = 100 - (curr.count / prev.count) * 100
                if (dropPct > biggestDrop.dropPct) {
                  biggestDrop = {
                    from: prev.step.label,
                    to: curr.step.label,
                    dropPct,
                    lost: prev.count - curr.count,
                  }
                }
              }
              if (biggestDrop.dropPct === 0) {
                return <p style={{ fontSize: 13, color: gray }}>Sem dados suficientes ainda</p>
              }
              return (
                <>
                  <p style={{ fontSize: 13, color: gray, marginBottom: 8 }}>
                    Entre <strong style={{ color: '#2D1B2E' }}>{biggestDrop.from}</strong> e <strong style={{ color: '#2D1B2E' }}>{biggestDrop.to}</strong>
                  </p>
                  <div style={{ fontSize: 32, fontWeight: 800, color: red, lineHeight: 1 }}>
                    -{biggestDrop.dropPct.toFixed(0)}%
                  </div>
                  <p style={{ fontSize: 12, color: gray, marginTop: 6 }}>
                    {biggestDrop.lost} pessoas perdidas
                  </p>
                </>
              )
            })()}
          </div>
        </div>

        {/* Eventos recentes */}
        <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: '#2D1B2E', marginBottom: 16 }}>Últimos eventos</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 400, overflowY: 'auto' }}>
            {recent.length === 0 && (
              <p style={{ fontSize: 13, color: gray, textAlign: 'center', padding: 20 }}>Nenhum evento no período</p>
            )}
            {recent.map((e, i) => {
              const step = FUNNEL_STEPS.find(s => s.key === e.event_type)
              return (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 12px', borderRadius: 6, fontSize: 12,
                  background: i % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>{step?.icon ?? '•'}</span>
                    <span style={{ color: '#2D1B2E', fontWeight: 600 }}>{step?.label ?? e.event_type}</span>
                    {e.email && <span style={{ color: gray }}>· {e.email}</span>}
                    {e.payment_type && <span style={{ color: gray, fontSize: 11, background: 'rgba(0,0,0,0.05)', padding: '2px 6px', borderRadius: 4 }}>{e.payment_type}</span>}
                  </div>
                  <span style={{ color: gray, fontSize: 11 }}>
                    {new Date(e.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
