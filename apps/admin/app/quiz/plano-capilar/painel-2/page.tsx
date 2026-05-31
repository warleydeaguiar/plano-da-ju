import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Tokens visuais — alinhados ao theme atual mas mais minimalistas (estilo Linear/Resend)
const T = {
  bg:        '#FAFAFB',
  surface:   '#FFFFFF',
  ink:       '#0F172A',
  inkSoft:   '#475569',
  inkMuted:  '#94A3B8',
  border:    '#E5E7EB',
  borderSoft:'#F1F5F9',
  pink:      '#BE185D',  // brand
  pinkSoft:  '#FCE4EA',
  green:     '#16A34A',
  greenSoft: '#DCFCE7',
  amber:     '#D97706',
  amberSoft: '#FEF3C7',
  red:       '#DC2626',
  redSoft:   '#FEE2E2',
  blue:      '#2563EB',
  blueSoft:  '#DBEAFE',
}

const fonts = {
  sans: '"Plus Jakarta Sans", "Inter", -apple-system, system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, Menlo, monospace',
}

// ─── Funnel stages (mesma sequência da página atual) ─────────────────────────
const FUNNEL_STAGES = [
  { key: 'sessions',           label: 'Visitou o quiz',   color: T.inkSoft },
  { key: 'engaged',            label: 'Interagiu',        color: T.blue },
  { key: 'lead',               label: 'Lead capturado',   color: T.amber },
  { key: 'offer_viewed',       label: 'Viu oferta',       color: T.pink },
  { key: 'checkout_initiated', label: 'Iniciou checkout', color: T.pink },
  { key: 'purchased',          label: 'Comprou',          color: T.green },
] as const

// ─── Question labels (subset — só p/ drop-off) ──────────────────────────────
const Q_LABELS: Record<string, string> = {
  tipo: 'Tipo de cabelo', cor: 'Cor do cabelo', idade: 'Faixa etária',
  incomoda: 'O que mais incomoda', quimica: 'Químicas recentes',
  corte_quimico: 'Corte químico?', espessura: 'Espessura do fio',
  oleosidade: 'Seco/oleoso/normal', porosidade: 'Porosidade',
  caspa: 'Caspa/coceira', elasticidade: 'Elasticidade', lavagem: 'Freq. lavagem',
  calor: 'Uso de calor', cronograma: 'Faz cronograma?',
  crescimento_desigual: 'Crescimento desigual', sol_piscina: 'Sol/piscina/mar',
  agua: 'Litros de água/dia', protetor: 'Usa protetor?',
  como_plano: 'Como quer o plano', cortes: 'Freq. de cortes', areas: 'Áreas preocupantes',
}
const Q_ORDER = Object.keys(Q_LABELS)

// ─── Data fetch ─────────────────────────────────────────────────────────────
async function fetchPanelData() {
  const sb = createAdminClient()
  const now = Date.now()
  const since30 = new Date(now - 30 * 86400_000).toISOString()
  const since60 = new Date(now - 60 * 86400_000).toISOString()
  const slug = 'plano-capilar'

  const [
    views30, viewsPrev,
    step0_30, step0Prev,
    leads30, leadsPrev,
    profilesActive,
    profilesActivePrev,
    checkoutEvents30,
    answersBySession,
    leadsDaily,
    leadsBySource,
  ] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_views') as any).select('session_id').eq('quiz_slug', slug).gte('created_at', since30).not('session_id', 'is', null),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_views') as any).select('session_id').eq('quiz_slug', slug).gte('created_at', since60).lt('created_at', since30).not('session_id', 'is', null),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_step_events') as any).select('session_id').eq('quiz_slug', slug).eq('step_index', 0).eq('event_type', 'answered').gte('created_at', since30),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_step_events') as any).select('session_id').eq('quiz_slug', slug).eq('step_index', 0).eq('event_type', 'answered').gte('created_at', since60).lt('created_at', since30),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_leads') as any).select('created_at, utm_source, utm_medium, utm_campaign').eq('quiz_slug', slug).gte('created_at', since30),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_leads') as any).select('id', { count: 'exact', head: true }).eq('quiz_slug', slug).gte('created_at', since60).lt('created_at', since30),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('profiles') as any).select('id', { count: 'exact', head: true }).eq('subscription_status', 'active').or('is_gift.is.null,is_gift.eq.false').gte('subscription_activated_at', since30),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('profiles') as any).select('id', { count: 'exact', head: true }).eq('subscription_status', 'active').or('is_gift.is.null,is_gift.eq.false').gte('subscription_activated_at', since60).lt('subscription_activated_at', since30),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('checkout_events') as any).select('event_type').gte('created_at', since30),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_answers') as any).select('question_id, session_id').eq('quiz_slug', slug),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_leads') as any).select('created_at').eq('quiz_slug', slug).gte('created_at', since30).order('created_at', { ascending: true }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_leads') as any).select('utm_source').eq('quiz_slug', slug).gte('created_at', since30).not('utm_source', 'is', null),
  ])

  // Sessões únicas
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessions = new Set<string>((views30.data ?? []).map((r: any) => r.session_id)).size
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionsPrev = new Set<string>((viewsPrev.data ?? []).map((r: any) => r.session_id)).size
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const engaged = new Set<string>((step0_30.data ?? []).map((r: any) => r.session_id)).size
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const engagedPrev = new Set<string>((step0Prev.data ?? []).map((r: any) => r.session_id)).size

  const lead = leads30.data?.length ?? 0
  const leadPrev = leadsPrev.count ?? 0

  const purchased = profilesActive.count ?? 0
  const purchasedPrev = profilesActivePrev.count ?? 0

  // Checkout breakdown
  const ce: Record<string, number> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (checkoutEvents30.data ?? []) as any[]) {
    ce[r.event_type] = (ce[r.event_type] ?? 0) + 1
  }

  const funnelCounts: Record<string, number> = {
    sessions,
    engaged,
    lead,
    offer_viewed:       ce['offer_viewed']       ?? 0,
    checkout_initiated: ce['checkout_initiated'] ?? 0,
    purchased,
  }

  // Drop-off por pergunta (sessões únicas que responderam cada pergunta)
  const qSessions = new Map<string, Set<string>>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (answersBySession.data ?? []) as any[]) {
    if (!r.session_id || !Q_LABELS[r.question_id]) continue
    if (!qSessions.has(r.question_id)) qSessions.set(r.question_id, new Set())
    qSessions.get(r.question_id)!.add(r.session_id)
  }
  const top = Math.max(...Q_ORDER.map(q => qSessions.get(q)?.size ?? 0), 1)
  const dropoff = Q_ORDER.map((q, i) => {
    const n = qSessions.get(q)?.size ?? 0
    const prevN = i > 0 ? (qSessions.get(Q_ORDER[i - 1])?.size ?? 0) : null
    const dropPct = prevN != null && prevN > 0 ? Math.round(((prevN - n) / prevN) * 100) : null
    return { qid: q, label: Q_LABELS[q], sessions: n, pctOfTop: Math.round((n / top) * 100), dropPct }
  }).filter(r => r.sessions > 0)

  // Sparkline diário de leads
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now - (29 - i) * 86400_000)
    return d.toISOString().slice(0, 10)
  })
  const dayMap: Record<string, number> = Object.fromEntries(days.map(d => [d, 0]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (leadsDaily.data ?? []) as any[]) {
    const k = (r.created_at as string).slice(0, 10)
    if (k in dayMap) dayMap[k]++
  }
  const sparkSeries = days.map(d => ({ date: d, count: dayMap[d] }))

  // Top UTM sources
  const utmMap: Record<string, number> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (leadsBySource.data ?? []) as any[]) {
    const s = (r.utm_source as string) || 'desconhecido'
    utmMap[s] = (utmMap[s] ?? 0) + 1
  }
  const topUtm = Object.entries(utmMap).sort(([, a], [, b]) => b - a).slice(0, 5).map(([source, count]) => ({ source, count }))

  return {
    kpis: {
      sessions, sessionsPrev,
      engaged, engagedPrev,
      lead, leadPrev,
      purchased, purchasedPrev,
    },
    funnelCounts,
    dropoff,
    sparkSeries,
    topUtm,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function delta(curr: number, prev: number): { label: string; positive: boolean; neutral: boolean } {
  if (prev === 0) return { label: curr > 0 ? 'novo' : '—', positive: curr > 0, neutral: curr === 0 }
  const pct = Math.round(((curr - prev) / prev) * 100)
  return { label: `${pct > 0 ? '+' : ''}${pct}%`, positive: pct > 0, neutral: pct === 0 }
}
function pct(num: number, denom: number): string {
  if (!denom) return '—'
  const v = (num / denom) * 100
  return `${v.toFixed(v >= 10 ? 0 : 1)}%`
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default async function Painel2Page() {
  const data = await fetchPanelData()
  const { kpis, funnelCounts, dropoff, sparkSeries, topUtm } = data

  // Funnel viz: percentual de cada etapa em relação a sessions (topo)
  const funnelTop = Math.max(funnelCounts.sessions, 1)
  const funnelRows = FUNNEL_STAGES.map((stage, i) => {
    const count = funnelCounts[stage.key] ?? 0
    const prevCount = i > 0 ? funnelCounts[FUNNEL_STAGES[i - 1].key] ?? 0 : null
    const widthPct = Math.max(2, Math.round((count / funnelTop) * 100))
    const fromTop = Math.round((count / funnelTop) * 100)
    const fromPrev = prevCount != null && prevCount > 0 ? Math.round((count / prevCount) * 100) : null
    return { ...stage, count, widthPct, fromTop, fromPrev }
  })

  // Sparkline svg path
  const maxSpark = Math.max(...sparkSeries.map(s => s.count), 1)
  const sparkW = 100, sparkH = 28
  const sparkPath = sparkSeries.map((s, i) => {
    const x = (i / (sparkSeries.length - 1)) * sparkW
    const y = sparkH - (s.count / maxSpark) * (sparkH - 2)
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')
  const sparkTotal = sparkSeries.reduce((s, x) => s + x.count, 0)
  const sparkAvg = (sparkTotal / sparkSeries.length).toFixed(1)

  const kpiDefs = [
    { label: 'Visitas únicas', value: kpis.sessions,  prev: kpis.sessionsPrev, accent: T.inkSoft },
    { label: 'Interagiu',      value: kpis.engaged,   prev: kpis.engagedPrev,  accent: T.blue },
    { label: 'Leads',          value: kpis.lead,      prev: kpis.leadPrev,     accent: T.amber },
    { label: 'Compraram',      value: kpis.purchased, prev: kpis.purchasedPrev,accent: T.green },
  ]
  const overallConv = pct(kpis.purchased, kpis.sessions)

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.ink, fontFamily: fonts.sans }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '28px 32px' }}>

        {/* Breadcrumb + Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: T.inkMuted, marginBottom: 6 }}>
              <Link href="/quiz" style={{ color: T.inkMuted, textDecoration: 'none' }}>Quiz</Link>
              <span>›</span>
              <Link href="/quiz/plano-capilar" style={{ color: T.inkMuted, textDecoration: 'none' }}>Plano Capilar</Link>
              <span>›</span>
              <span style={{ color: T.ink, fontWeight: 600 }}>Painel 2</span>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.5, margin: 0 }}>Funil do Quiz</h1>
            <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 4 }}>Últimos 30 dias · comparativo com 30 dias anteriores</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/quiz/plano-capilar" style={btnGhost}>← Painel 1</Link>
            <a href="https://planodaju.julianecost.com/quiz" target="_blank" rel="noopener noreferrer" style={btnPrimary}>Ver quiz ↗</a>
          </div>
        </div>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
          {kpiDefs.map((k) => {
            const d = delta(k.value, k.prev)
            return (
              <div key={k.label} style={card()}>
                <div style={kpiLabel}>{k.label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
                  <div style={kpiValue(k.accent)}>{k.value.toLocaleString('pt-BR')}</div>
                </div>
                <div style={{ ...kpiSub, color: d.neutral ? T.inkMuted : d.positive ? T.green : T.red }}>
                  {d.label} <span style={{ color: T.inkMuted }}>vs 30d anteriores</span>
                </div>
              </div>
            )
          })}
          {/* Conv card */}
          <div style={{ ...card(), background: T.ink, color: '#fff', borderColor: T.ink }}>
            <div style={{ ...kpiLabel, color: 'rgba(255,255,255,0.6)' }}>Conversão geral</div>
            <div style={{ ...kpiValue('#fff'), marginTop: 6 }}>{overallConv}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 6 }}>visitas → compras</div>
          </div>
        </div>

        {/* Funnel */}
        <div style={{ ...card(), padding: 20, marginBottom: 20 }}>
          <div style={sectionTitle}>Funil de conversão</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {funnelRows.map((r) => (
              <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 150, fontSize: 13, color: T.inkSoft, flexShrink: 0 }}>{r.label}</div>
                <div style={{ flex: 1, position: 'relative', height: 28, background: T.borderSoft, borderRadius: 6 }}>
                  <div style={{
                    width: `${r.widthPct}%`, height: '100%',
                    background: r.color, borderRadius: 6,
                    transition: 'width 0.3s', display: 'flex', alignItems: 'center', paddingLeft: 10,
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', fontFamily: fonts.mono }}>
                      {r.count.toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>
                <div style={{ width: 60, fontSize: 12, fontWeight: 600, color: T.ink, textAlign: 'right', fontFamily: fonts.mono }}>
                  {r.fromTop}%
                </div>
                <div style={{ width: 70, fontSize: 11, color: r.fromPrev != null && r.fromPrev < 50 ? T.red : T.inkMuted, textAlign: 'right' }}>
                  {r.fromPrev != null ? `${r.fromPrev}% etapa` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Grid: drop-off + sparkline + utm */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, marginBottom: 20 }}>
          {/* Drop-off por pergunta */}
          <div style={card()}>
            <div style={sectionTitle}>Onde perdemos mais gente (por pergunta)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
              {dropoff.map((row) => (
                <div key={row.qid} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 160, fontSize: 12, color: T.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</div>
                  <div style={{ flex: 1, height: 8, background: T.borderSoft, borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ width: `${row.pctOfTop}%`, height: '100%', background: row.dropPct != null && row.dropPct > 20 ? T.red : T.pink, borderRadius: 4 }} />
                  </div>
                  <div style={{ width: 40, fontSize: 11, color: T.ink, fontWeight: 600, fontFamily: fonts.mono, textAlign: 'right' }}>{row.sessions}</div>
                  <div style={{ width: 50, fontSize: 11, color: row.dropPct != null && row.dropPct > 20 ? T.red : T.inkMuted, textAlign: 'right', fontFamily: fonts.mono }}>
                    {row.dropPct != null ? `−${row.dropPct}%` : ''}
                  </div>
                </div>
              ))}
              {dropoff.length === 0 && <div style={emptyState}>Sem dados de respostas no período.</div>}
            </div>
          </div>

          {/* Tendência diária */}
          <div style={card()}>
            <div style={sectionTitle}>Tendência de leads</div>
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <div style={{ fontSize: 30, fontWeight: 700, fontFamily: fonts.mono, color: T.ink }}>{sparkTotal}</div>
                <div style={{ fontSize: 12, color: T.inkMuted }}>nos últimos 30 dias</div>
              </div>
              <svg viewBox={`0 0 ${sparkW} ${sparkH}`} preserveAspectRatio="none" style={{ width: '100%', height: 60, marginTop: 12, display: 'block' }}>
                <path d={sparkPath} fill="none" stroke={T.amber} strokeWidth="1.2" />
                <path d={`${sparkPath} L ${sparkW} ${sparkH} L 0 ${sparkH} Z`} fill={T.amber} opacity="0.10" />
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.inkMuted, marginTop: 4 }}>
                <span>30 dias atrás</span>
                <span>Hoje</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.borderSoft}` }}>
                <div>
                  <div style={miniLabel}>Média/dia</div>
                  <div style={miniValue}>{sparkAvg}</div>
                </div>
                <div>
                  <div style={miniLabel}>Pico</div>
                  <div style={miniValue}>{maxSpark}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top UTMs */}
        <div style={card()}>
          <div style={sectionTitle}>Origem dos leads (UTM source)</div>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {topUtm.length === 0 && <div style={emptyState}>Nenhum lead com UTM no período.</div>}
            {(() => {
              const max = Math.max(...topUtm.map(u => u.count), 1)
              return topUtm.map((u) => (
                <div key={u.source} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 140, fontSize: 12, color: T.ink, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.source}</div>
                  <div style={{ flex: 1, height: 8, background: T.borderSoft, borderRadius: 4 }}>
                    <div style={{ width: `${(u.count / max) * 100}%`, height: '100%', background: T.blue, borderRadius: 4 }} />
                  </div>
                  <div style={{ width: 60, fontSize: 12, color: T.ink, fontWeight: 600, fontFamily: fonts.mono, textAlign: 'right' }}>{u.count}</div>
                  <div style={{ width: 50, fontSize: 11, color: T.inkMuted, textAlign: 'right' }}>{pct(u.count, sparkTotal)}</div>
                </div>
              ))
            })()}
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Styles ─────────────────────────────────────────────────────────────────
function card(): React.CSSProperties {
  return {
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: 14,
    padding: 18,
  }
}
const sectionTitle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6 }
const kpiLabel: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: T.inkMuted, textTransform: 'uppercase', letterSpacing: 0.4 }
const kpiValue = (color: string): React.CSSProperties => ({ fontSize: 28, fontWeight: 700, letterSpacing: -0.6, color, fontFamily: fonts.mono })
const kpiSub: React.CSSProperties = { fontSize: 11, marginTop: 6 }
const miniLabel: React.CSSProperties = { fontSize: 10, color: T.inkMuted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }
const miniValue: React.CSSProperties = { fontSize: 17, fontWeight: 700, color: T.ink, marginTop: 2, fontFamily: fonts.mono }
const emptyState: React.CSSProperties = { fontSize: 12, color: T.inkMuted, padding: '20px 0', textAlign: 'center' }
const btnGhost: React.CSSProperties = { background: T.surface, color: T.ink, padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none', border: `1px solid ${T.border}` }
const btnPrimary: React.CSSProperties = { background: T.pink, color: '#fff', padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none' }
