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

type Bucket = { key: string; reviews: number; ratingSum: number; ratingN: number; clicks: number }
function emptyBucket(key: string): Bucket { return { key, reviews: 0, ratingSum: 0, ratingN: 0, clicks: 0 } }

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

  return {
    avgReviewsPerWeek: totalReviews / weeksSpan,
    avgReviewsPerMonth: totalReviews / monthsSpan,
    overallRating: ratingN ? ratingSum / ratingN : 0,
    totalReviews, totalClicks, yberaClicks,
    weekRows, monthRows, topProducts,
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
            <th style={{ padding: '9px 8px', fontWeight: 600, textAlign: 'right' }}>Avaliações</th>
            <th style={{ padding: '9px 8px', fontWeight: 600, textAlign: 'right' }}>Nota média</th>
            <th style={{ padding: '9px 20px', fontWeight: 600, textAlign: 'right' }}>Cliques produtos</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: gray }}>Sem dados ainda.</td></tr>}
          {[...rows].reverse().map(b => (
            <tr key={b.key} style={{ borderTop: '1px solid #F3EEF3' }}>
              <td style={{ padding: '9px 20px', color: ink, fontWeight: 600 }}>{label(b.key)}</td>
              <td style={{ padding: '9px 8px', textAlign: 'right', color: ink }}>{b.reviews}</td>
              <td style={{ padding: '9px 8px', textAlign: 'right', color: b.ratingN ? accent : gray, fontWeight: 700 }}>
                {b.ratingN ? `${n1(b.ratingSum / b.ratingN)} ${stars(b.ratingSum / b.ratingN)}` : '—'}
              </td>
              <td style={{ padding: '9px 20px', textAlign: 'right', color: ink }}>{b.clicks}</td>
            </tr>
          ))}
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
          <StatCard label="Média de avaliações / semana" value={n1(d.avgReviewsPerWeek)} sub={`${d.totalReviews} avaliações no total`} />
          <StatCard label="Média de avaliações / mês" value={n1(d.avgReviewsPerMonth)} />
          <StatCard label="Nota média geral" value={`${n1(d.overallRating)} ${stars(d.overallRating)}`} color={accent} />
          <StatCard label="Cliques em produtos" value={String(d.totalClicks)} sub={`${d.yberaClicks} em produtos Ybera`} color={green} />
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

        <div style={{ height: 40 }} />
      </main>
    </div>
  )
}
