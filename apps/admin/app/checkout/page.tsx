import { createAdminClient } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'

export const revalidate = 30
export const metadata = { title: 'Checkout — Funil de Conversão' }

const accent = '#BE185D'
const green  = '#22A06B'
const red    = '#FF453A'
const orange = '#D97706'
const gray   = '#7C6B7E'

// Funil de checkout — 4 passos SEQUENCIAIS reais.
// (pix_generated e card_submitted são ramos paralelos → juntados em "Iniciou pagamento";
//  password_set / envio de foto são onboarding pós-compra, não fazem parte do funil de conversão.)
const FUNNEL_STEPS: { key: 'viewed' | 'initiated' | 'pay_started' | 'paid'; label: string; icon: string }[] = [
  { key: 'viewed',      label: 'Viu a oferta',       icon: '👀' },
  { key: 'initiated',   label: 'Clicou em comprar',  icon: '🛒' },
  { key: 'pay_started', label: 'Iniciou pagamento',  icon: '💳' },
  { key: 'paid',        label: 'Pagou',              icon: '✅' },
]

// Rótulos/ícones dos eventos crus (lista "Últimos eventos")
const EVENT_META: Record<string, { label: string; icon: string }> = {
  offer_viewed:       { label: 'Viu a oferta',      icon: '👀' },
  checkout_initiated: { label: 'Clicou em comprar', icon: '🛒' },
  pix_generated:      { label: 'Gerou PIX',         icon: '📱' },
  card_submitted:     { label: 'Enviou cartão',     icon: '💳' },
  payment_confirmed:  { label: 'Pagou ✓',           icon: '✅' },
  password_set:       { label: 'Criou senha',       icon: '🔐' },
  checkout_error:     { label: 'Erro no checkout',  icon: '⚠️' },
}

type FunnelData = {
  viewed: number; initiated: number; pay_started: number; pix_started: number; card_started: number
  paid: number; paid_pix: number; paid_card: number; revenue: number; errors: number; password_set: number
}

function StatCard({ label, value, sub, color }: {
  label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: 11, color: gray, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: color ?? '#2A1E2C', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: gray, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

export default async function CheckoutFunnelPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>
}) {
  const params = await searchParams
  const days = parseInt(params.days ?? '7', 10)

  // Janela: dias INTEIROS em Brasília (UTC-3). days=1 → desde meia-noite de hoje em BR.
  const now = new Date()
  const brasiliaOffsetMs = 3 * 60 * 60 * 1000
  const brasiliaNow = new Date(now.getTime() - brasiliaOffsetMs)
  const yyyy = brasiliaNow.getUTCFullYear()
  const mm   = String(brasiliaNow.getUTCMonth() + 1).padStart(2, '0')
  const dd   = String(brasiliaNow.getUTCDate()).padStart(2, '0')
  const todayStartBR = new Date(`${yyyy}-${mm}-${dd}T03:00:00.000Z`)  // 03:00 UTC = 00:00 BR
  const since = days === 1
    ? todayStartBR.toISOString()
    : new Date(todayStartBR.getTime() - (days - 1) * 86400_000).toISOString()

  const sb = createAdminClient()

  // Agregados via RPC em SQL (count distinct de sessão por passo) — sem o teto de 1000 linhas.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rpcData } = await (sb as any).rpc('checkout_funnel', { p_since: since })
  const f: FunnelData = rpcData ?? {
    viewed: 0, initiated: 0, pay_started: 0, pix_started: 0, card_started: 0,
    paid: 0, paid_pix: 0, paid_card: 0, revenue: 0, errors: 0, password_set: 0,
  }

  const counts: Record<string, number> = {
    viewed: f.viewed, initiated: f.initiated, pay_started: f.pay_started, paid: f.paid,
  }
  const topCount = f.viewed
  const funnel = FUNNEL_STEPS.map((step, i) => {
    const count = counts[step.key] ?? 0
    const prevCount = i === 0 ? count : (counts[FUNNEL_STEPS[i - 1].key] ?? 0)
    return {
      step, count,
      pctOfTop: topCount > 0 ? (count / topCount) * 100 : 0,
      pctOfPrev: prevCount > 0 ? (count / prevCount) * 100 : 0,
    }
  })

  const paidCount = f.paid
  const conversionRate = topCount > 0 ? (paidCount / topCount) * 100 : 0
  const totalRevenue = f.revenue

  // Últimos eventos: query própria, limitada (não afeta os agregados).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: recentData } = await (sb as any)
    .from('checkout_events')
    .select('event_type, email, payment_type, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(50)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recent: any[] = recentData ?? []

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F5F2F4', fontFamily: '-apple-system, "Inter", system-ui, sans-serif' }}>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: 234, padding: '32px 40px', maxWidth: 1400 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#2A1E2C', marginBottom: 4 }}>Funil de Checkout</h1>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 8 }}>
          <StatCard label="Visualizações" value={topCount.toLocaleString('pt-BR')} sub="Quem chegou na oferta" />
          <StatCard label="Compras" value={paidCount.toLocaleString('pt-BR')} sub={`R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} color={green} />
          <StatCard label="Conversão (visita→compra)" value={`${conversionRate.toFixed(1)}%`} color={paidCount > 0 ? green : red} />
          <StatCard label="Erros no checkout" value={f.errors.toLocaleString('pt-BR')} color={f.errors > 0 ? orange : gray} sub="Sessões com falha" />
        </div>
        <p style={{ fontSize: 11, color: gray, marginBottom: 24 }}>
          “Compras” = checkouts pagos (fluxo de pagamento). Ativações grátis/UGC não entram aqui.
        </p>

        {/* Funil */}
        <div style={{ background: '#fff', borderRadius: 14, padding: '24px 28px', border: '1px solid rgba(0,0,0,0.06)', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#2A1E2C', marginBottom: 4 }}>Funil completo</h2>
          <p style={{ fontSize: 12, color: gray, marginBottom: 20 }}>% do total à esquerda · % em relação ao passo anterior à direita</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {funnel.map((row, i) => {
              const widthPct = Math.max(2, row.pctOfTop)
              const isDrop = i > 0 && row.pctOfPrev < 50 && row.count > 0 && funnel[i - 1].count > 0
              return (
                <div key={row.step.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 220, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{row.step.icon}</span>
                    <span style={{ fontSize: 13, color: '#2A1E2C', fontWeight: 600 }}>{row.step.label}</span>
                  </div>
                  <div style={{ flex: 1, height: 32, background: 'rgba(196,96,122,0.08)', borderRadius: 6, position: 'relative' }}>
                    <div style={{
                      width: `${widthPct}%`, height: '100%',
                      background: `linear-gradient(90deg, ${accent}, ${accent}99)`,
                      borderRadius: 6,
                      display: 'flex', alignItems: 'center', paddingLeft: 12,
                      color: '#fff', fontSize: 12, fontWeight: 700,
                    }}>
                      {row.count.toLocaleString('pt-BR')}
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
          <p style={{ fontSize: 11, color: gray, marginTop: 16 }}>
            “Iniciou pagamento” = gerou PIX ({f.pix_started.toLocaleString('pt-BR')}) ou enviou cartão ({f.card_started.toLocaleString('pt-BR')}).
            O evento de cartão é sub-registrado, então esse passo tende a subestimar quem pagou no cartão.
          </p>
        </div>

        {/* Conversão por método (pagos ÷ gerados) */}
        {(() => {
          const pixConv  = f.pix_started  > 0 ? (f.paid_pix  / f.pix_started)  * 100 : null
          const cardConv = f.card_started > 0 ? (f.paid_card / f.card_started) * 100 : null
          const cardUnreliable = cardConv !== null && cardConv > 100
          return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: 11, color: gray, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>📱 Conversão PIX</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: pixConv !== null ? green : gray, lineHeight: 1 }}>
                  {pixConv !== null ? `${pixConv.toFixed(1)}%` : '—'}
                </div>
                <div style={{ fontSize: 12, color: gray, marginTop: 6 }}>
                  {f.paid_pix.toLocaleString('pt-BR')} pagos ÷ {f.pix_started.toLocaleString('pt-BR')} gerados
                </div>
              </div>
              <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: 11, color: gray, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>💳 Conversão Cartão</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: cardUnreliable ? orange : (cardConv !== null ? green : gray), lineHeight: 1 }}>
                  {cardConv !== null && !cardUnreliable ? `${cardConv.toFixed(1)}%` : '—'}
                </div>
                <div style={{ fontSize: 12, color: gray, marginTop: 6 }}>
                  {f.paid_card.toLocaleString('pt-BR')} pagos ÷ {f.card_started.toLocaleString('pt-BR')} gerados
                  {cardUnreliable && <span style={{ color: orange }}> · ⚠️ evento de cartão sub-registrado (a base “gerados” está incompleta)</span>}
                </div>
              </div>
            </div>
          )
        })()}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          {/* Quebra por método */}
          <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: '#2A1E2C', marginBottom: 16 }}>Método de pagamento (compras)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>📱 PIX</span>
                  <span style={{ fontWeight: 700 }}>{f.paid_pix.toLocaleString('pt-BR')} · {paidCount > 0 ? Math.round((f.paid_pix / paidCount) * 100) : 0}%</span>
                </div>
                <div style={{ height: 8, background: 'rgba(0,0,0,0.05)', borderRadius: 99 }}>
                  <div style={{
                    width: `${paidCount > 0 ? (f.paid_pix / paidCount) * 100 : 0}%`,
                    height: '100%', background: accent, borderRadius: 99,
                  }} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>💳 Cartão</span>
                  <span style={{ fontWeight: 700 }}>{f.paid_card.toLocaleString('pt-BR')} · {paidCount > 0 ? Math.round((f.paid_card / paidCount) * 100) : 0}%</span>
                </div>
                <div style={{ height: 8, background: 'rgba(0,0,0,0.05)', borderRadius: 99 }}>
                  <div style={{
                    width: `${paidCount > 0 ? (f.paid_card / paidCount) * 100 : 0}%`,
                    height: '100%', background: orange, borderRadius: 99,
                  }} />
                </div>
              </div>
            </div>
          </div>

          {/* Maior gargalo */}
          <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: '#2A1E2C', marginBottom: 16 }}>Maior gargalo</h3>
            {(() => {
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
                    Entre <strong style={{ color: '#2A1E2C' }}>{biggestDrop.from}</strong> e <strong style={{ color: '#2A1E2C' }}>{biggestDrop.to}</strong>
                  </p>
                  <div style={{ fontSize: 32, fontWeight: 800, color: red, lineHeight: 1 }}>
                    -{biggestDrop.dropPct.toFixed(0)}%
                  </div>
                  <p style={{ fontSize: 12, color: gray, marginTop: 6 }}>
                    {biggestDrop.lost.toLocaleString('pt-BR')} pessoas perdidas
                  </p>
                </>
              )
            })()}
          </div>
        </div>

        {/* Eventos recentes */}
        <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: '#2A1E2C', marginBottom: 16 }}>Últimos eventos</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 400, overflowY: 'auto' }}>
            {recent.length === 0 && (
              <p style={{ fontSize: 13, color: gray, textAlign: 'center', padding: 20 }}>Nenhum evento no período</p>
            )}
            {recent.map((e, i) => {
              const meta = EVENT_META[e.event_type]
              return (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 12px', borderRadius: 6, fontSize: 12,
                  background: i % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>{meta?.icon ?? '•'}</span>
                    <span style={{ color: '#2A1E2C', fontWeight: 600 }}>{meta?.label ?? e.event_type}</span>
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
