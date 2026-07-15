import { createAdminClient } from '@/lib/supabase'
import Sidebar from '../../components/Sidebar'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Aprovação de Planos — Admin Plano da Ju' }

const accent = '#BE185D'
const gold = '#c9a45c'
const green = '#22A06B'
const gray = '#7C6B7E'
const ink = '#2A1E2C'
const DAY = 86400000

const n1 = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function weekStartKey(iso: string): string {
  const d = new Date(iso); const day = (d.getDay() + 6) % 7
  d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - day)
  return d.toISOString().slice(0, 10)
}
const weekLabel = (k: string) => { const [, m, d] = k.split('-'); return `${d}/${m}` }
const monthLabel = (k: string) => { const [y, m] = k.split('-'); return `${MES[Number(m) - 1]}/${y}` }

type Bucket = { key: string; reviews: number; ratingSum: number; ratingN: number; clicks: number; gerados: number }
function emptyBucket(key: string): Bucket { return { key, reviews: 0, ratingSum: 0, ratingN: 0, clicks: 0, gerados: 0 } }

async function getData() {
  const sb = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: fb } = await (sb.from('plan_feedback') as any).select('rating, created_at').limit(100000)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: clk } = await (sb.from('plan_product_clicks') as any).select('product_name, is_ybera, created_at').limit(100000)
  const feedback = (fb ?? []) as { rating: number | null; created_at: string }[]
  const clicks = (clk ?? []) as { product_name: string | null; is_ybera: boolean | null; created_at: string }[]

  const weeks = new Map<string, Bucket>()
  const months = new Map<string, Bucket>()
  const bump = (map: Map<string, Bucket>, key: string, fn: (b: Bucket) => void) => {
    const b = map.get(key) ?? emptyBucket(key); fn(b); map.set(key, b)
  }

  let firstTs = Infinity
  for (const f of feedback) {
    const t = new Date(f.created_at).getTime(); if (t < firstTs) firstTs = t
    bump(weeks, weekStartKey(f.created_at), b => { b.reviews++; if (f.rating != null) { b.ratingSum += f.rating; b.ratingN++ } })
    bump(months, f.created_at.slice(0, 7), b => { b.reviews++; if (f.rating != null) { b.ratingSum += f.rating; b.ratingN++ } })
  }
  for (const c of clicks) {
    const t = new Date(c.created_at).getTime(); if (t < firstTs) firstTs = t
    bump(weeks, weekStartKey(c.created_at), b => { b.clicks++ })
    bump(months, c.created_at.slice(0, 7), b => { b.clicks++ })
  }

  // ── Contexto: planos gerados (data de entrega) e vendidos (pagamentos reais) ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: genRows } = await (sb.from('profiles') as any)
    .select('plan_released_at').not('plan_released_at', 'is', null).limit(100000)
  const generated = (genRows ?? []) as { plan_released_at: string }[]
  for (const g of generated) {
    if (!g.plan_released_at) continue
    bump(weeks, weekStartKey(g.plan_released_at), b => { b.gerados++ })
    bump(months, g.plan_released_at.slice(0, 7), b => { b.gerados++ })
  }
  const totalGerados = generated.length

  // Vendidos = pagamentos reais (dedup por cliente/dia; webhook grava 2 eventos/venda)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: payRows } = await (sb.from('checkout_events') as any)
    .select('email, order_id, created_at').eq('event_type', 'payment_confirmed').limit(100000)
  const seenPay = new Set<string>()
  for (const p of (payRows ?? []) as { email: string | null; order_id: string | null; created_at: string }[]) {
    const k = `${String(p.email ?? p.order_id ?? Math.random()).toLowerCase()}_${String(p.created_at).slice(0, 10)}`
    if (!seenPay.has(k)) seenPay.add(k)
  }
  const totalVendidos = seenPay.size

  const now = Date.now()
  const span = isFinite(firstTs) ? Math.max(now - firstTs, DAY) : DAY
  const weeksSpan = Math.max(1, Math.ceil(span / (7 * DAY)))
  const monthsSpan = Math.max(1, Math.ceil(span / (30 * DAY)))

  const totalReviews = feedback.length
  const ratingN = feedback.filter(f => f.rating != null).length
  const ratingSum = feedback.reduce((s, f) => s + (f.rating ?? 0), 0)
  const totalClicks = clicks.length

  // top produtos clicados
  const prodMap = new Map<string, number>()
  for (const c of clicks) { const k = c.product_name ?? '—'; prodMap.set(k, (prodMap.get(k) ?? 0) + 1) }
  const topProducts = [...prodMap.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n).slice(0, 10)
  const yberaClicks = clicks.filter(c => c.is_ybera).length

  const weekRows = [...weeks.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(-12)
  const monthRows = [...months.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(-12)

  // ── Engajamento: alunas ativas que registram a rotina no app (hair_events) ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: actRows } = await (sb.from('profiles') as any)
    .select('id').eq('subscription_status', 'active').limit(100000)
  const activeIds = new Set<string>((actRows ?? []).map((r: { id: string }) => r.id))
  const activeCount = activeIds.size

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: heRows } = await (sb.from('hair_events') as any)
    .select('user_id, event_type, occurred_at').limit(100000)
  const events = (heRows ?? []).filter((e: { user_id: string }) => activeIds.has(e.user_id)) as { user_id: string; event_type: string; occurred_at: string }[]

  const engagedSet = new Set<string>()
  const eng7 = new Set<string>(), eng30 = new Set<string>()
  const typeMap = new Map<string, number>()
  for (const e of events) {
    engagedSet.add(e.user_id)
    typeMap.set(e.event_type, (typeMap.get(e.event_type) ?? 0) + 1)
    const age = (now - new Date(e.occurred_at).getTime()) / DAY
    if (age <= 7) eng7.add(e.user_id)
    if (age <= 30) eng30.add(e.user_id)
  }
  const TYPE_LABEL: Record<string, string> = {
    wash: 'Lavagem', hydration_mask: 'Hidratação', nutrition_mask: 'Nutrição',
    reconstruction: 'Reconstrução', oil_treatment: 'Umectação', heat_used: 'Usou calor',
  }
  const eventsByType = [...typeMap.entries()]
    .map(([k, v]) => ({ label: TYPE_LABEL[k] ?? k, n: v }))
    .sort((a, b) => b.n - a.n)

  return {
    avgReviewsPerWeek: totalReviews / weeksSpan,
    avgReviewsPerMonth: totalReviews / monthsSpan,
    overallRating: ratingN ? ratingSum / ratingN : 0,
    totalReviews, totalClicks, yberaClicks,
    totalGerados, totalVendidos,
    pctAvaliacao: totalGerados ? (totalReviews / totalGerados) * 100 : 0,
    weekRows, monthRows, topProducts,
    engagement: {
      activeCount,
      engaged: engagedSet.size,
      engagementRate: activeCount ? engagedSet.size / activeCount : 0,
      active7: eng7.size, active30: eng30.size,
      totalEvents: events.length,
      avgPerEngaged: engagedSet.size ? events.length / engagedSet.size : 0,
      eventsByType,
    },
  }
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: 11, color: gray, fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: color ?? ink, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: gray, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function stars(avg: number): string {
  const full = Math.round(avg)
  return '★'.repeat(Math.max(0, Math.min(5, full))) + '☆'.repeat(Math.max(0, 5 - full))
}

function PeriodTable({ title, rows, kind }: { title: string; rows: Bucket[]; kind: 'week' | 'month' }) {
  const label = (k: string) => kind === 'week' ? `Semana de ${weekLabel(k)}` : monthLabel(k)
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', overflow: 'hidden' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: ink, padding: '16px 20px', borderBottom: '1px solid #F0EAF0' }}>{title}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: gray, background: '#FAF6FA' }}>
            <th style={{ padding: '9px 20px', fontWeight: 600 }}>{kind === 'week' ? 'Semana' : 'Mês'}</th>
            <th style={{ padding: '9px 8px', fontWeight: 600, textAlign: 'right' }}>Planos gerados</th>
            <th style={{ padding: '9px 8px', fontWeight: 600, textAlign: 'right' }}>Avaliações</th>
            <th style={{ padding: '9px 8px', fontWeight: 600, textAlign: 'right' }}>% avaliação</th>
            <th style={{ padding: '9px 8px', fontWeight: 600, textAlign: 'right' }}>Nota média</th>
            <th style={{ padding: '9px 20px', fontWeight: 600, textAlign: 'right' }}>Cliques produtos</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: gray }}>Sem dados ainda.</td></tr>}
          {[...rows].reverse().map(b => {
            const pct = b.gerados > 0 ? (b.reviews / b.gerados) * 100 : null
            return (
            <tr key={b.key} style={{ borderTop: '1px solid #F3EEF3' }}>
              <td style={{ padding: '9px 20px', color: ink, fontWeight: 600 }}>{label(b.key)}</td>
              <td style={{ padding: '9px 8px', textAlign: 'right', color: ink }}>{b.gerados}</td>
              <td style={{ padding: '9px 8px', textAlign: 'right', color: ink }}>{b.reviews}</td>
              <td style={{ padding: '9px 8px', textAlign: 'right', color: pct !== null ? accent : gray, fontWeight: 700 }}>
                {pct !== null ? `${n1(pct)}%` : '—'}
              </td>
              <td style={{ padding: '9px 8px', textAlign: 'right', color: b.ratingN ? accent : gray, fontWeight: 700 }}>
                {b.ratingN ? `${n1(b.ratingSum / b.ratingN)} ${stars(b.ratingSum / b.ratingN)}` : '—'}
              </td>
              <td style={{ padding: '9px 20px', textAlign: 'right', color: ink }}>{b.clicks}</td>
            </tr>
          )})}
        </tbody>
      </table>
    </div>
  )
}

export default async function AprovacaoPage() {
  const d = await getData()
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#FFFAF5', fontFamily: 'Plus Jakarta Sans, -apple-system, system-ui, sans-serif' }}>
      <Sidebar />
      <main style={{ marginLeft: 234, flex: 1, height: '100vh', overflowY: 'auto', padding: '32px 40px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: ink, margin: 0 }}>Aprovação de Planos — Analytics</h1>
        <div style={{ fontSize: 13, color: gray, marginTop: 4, marginBottom: 20 }}>
          Avaliações das alunas (nota do plano) e cliques nos produtos recomendados.
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          <StatCard label="Planos vendidos" value={d.totalVendidos.toLocaleString('pt-BR')} sub="pagamentos confirmados (total)" color={green} />
          <StatCard label="Planos gerados" value={d.totalGerados.toLocaleString('pt-BR')} sub="planos entregues (total)" />
          <StatCard label="% que avaliou" value={`${n1(d.pctAvaliacao)}%`} sub={`${d.totalReviews} avaliações ÷ ${d.totalGerados} gerados`} color={accent} />
          <StatCard label="Nota média geral" value={`${n1(d.overallRating)} ${stars(d.overallRating)}`} color={accent} />
          <StatCard label="Avaliações / semana" value={n1(d.avgReviewsPerWeek)} sub={`${d.totalReviews} no total`} />
          <StatCard label="Avaliações / mês" value={n1(d.avgReviewsPerMonth)} />
          <StatCard label="Cliques em produtos" value={d.totalClicks.toLocaleString('pt-BR')} sub={`${d.yberaClicks} em produtos Ybera`} color={green} />
        </div>

        {/* Por semana / por mês */}
        <div style={{ fontSize: 16, fontWeight: 700, color: ink, margin: '30px 0 14px' }}>📅 Por semana</div>
        <PeriodTable title="Últimas 12 semanas" rows={d.weekRows} kind="week" />

        <div style={{ fontSize: 16, fontWeight: 700, color: ink, margin: '30px 0 14px' }}>🗓️ Por mês</div>
        <PeriodTable title="Últimos 12 meses" rows={d.monthRows} kind="month" />

        {/* Cliques por produto */}
        <div style={{ fontSize: 16, fontWeight: 700, color: ink, margin: '30px 0 14px' }}>🛍️ Cliques por produto</div>
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: 20 }}>
          {d.topProducts.length === 0 && <div style={{ fontSize: 13, color: gray }}>Nenhum clique registrado ainda. Os cliques no botão “Ver” dos produtos do plano passam a aparecer aqui.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {d.topProducts.map((p, i) => {
              const max = Math.max(...d.topProducts.map(x => x.n), 1)
              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: ink, marginBottom: 3 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{p.name}</span>
                    <span style={{ color: gray }}>{p.n} clique{p.n === 1 ? '' : 's'}</span>
                  </div>
                  <div style={{ height: 6, background: '#F0EAF0', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: `${(p.n / max) * 100}%`, background: gold, borderRadius: 3 }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Engajamento com o plano */}
        <div style={{ fontSize: 16, fontWeight: 700, color: ink, margin: '30px 0 14px' }}>💪 Engajamento com o plano</div>
        <div style={{ fontSize: 12, color: gray, margin: '-8px 0 12px', lineHeight: 1.5 }}>
          Quantas alunas ativas realmente acompanham o plano registrando a rotina (lavagem, hidratação, etc.) no app.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          <div style={{ background: `linear-gradient(135deg, ${accent}, #9d1457)`, borderRadius: 14, padding: '20px 24px' }}>
            <div style={{ fontSize: 11, color: '#ffffffcc', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>Taxa de engajamento</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{n1(d.engagement.engagementRate * 100)}%</div>
            <div style={{ fontSize: 12, color: '#ffffffcc', marginTop: 6 }}>{d.engagement.engaged} de {d.engagement.activeCount} alunas ativas registraram a rotina</div>
          </div>
          <StatCard label="Ativas nos últimos 7 dias" value={String(d.engagement.active7)} sub="registraram algo na última semana" color={green} />
          <StatCard label="Ativas nos últimos 30 dias" value={String(d.engagement.active30)} />
          <StatCard label="Registros de rotina" value={String(d.engagement.totalEvents)} sub={`${n1(d.engagement.avgPerEngaged)} por aluna engajada`} />
        </div>
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: 20, marginTop: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: ink, marginBottom: 12 }}>O que as alunas mais registram</div>
          {d.engagement.eventsByType.length === 0 && <div style={{ fontSize: 13, color: gray }}>Nenhum registro de rotina ainda.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {d.engagement.eventsByType.map((t, i) => {
              const max = Math.max(...d.engagement.eventsByType.map(x => x.n), 1)
              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: ink, marginBottom: 3 }}>
                    <span>{t.label}</span><span style={{ color: gray }}>{t.n}</span>
                  </div>
                  <div style={{ height: 6, background: '#F0EAF0', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: `${(t.n / max) * 100}%`, background: accent, borderRadius: 3 }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ height: 40 }} />
      </main>
    </div>
  )
}
