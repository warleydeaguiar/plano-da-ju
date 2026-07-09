import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase'
import { getPlanoClicksDaily } from '@/lib/meta-ads-quiz'
import TrendChart from './TrendChart'

export const dynamic = 'force-dynamic'

// ─── Visual tokens ──────────────────────────────────────────────────────────
const T = {
  bg:        '#FAFAFB',
  surface:   '#FFFFFF',
  surfaceAlt:'#F8F9FB',
  ink:       '#0F172A',
  inkSoft:   '#475569',
  inkMuted:  '#94A3B8',
  border:    '#E5E7EB',
  borderSoft:'#F1F5F9',
  pink:      '#BE185D',
  pinkSoft:  '#FCE4EA',
  green:     '#16A34A',
  greenSoft: '#DCFCE7',
  amber:     '#D97706',
  amberSoft: '#FEF3C7',
  red:       '#DC2626',
  redSoft:   '#FEE2E2',
  blue:      '#2563EB',
  blueSoft:  '#DBEAFE',
  purple:    '#7C3AED',
  purpleSoft:'#EDE9FE',
}
const fonts = {
  sans: '"Plus Jakarta Sans","Inter",-apple-system,system-ui,sans-serif',
  mono: '"JetBrains Mono",ui-monospace,Menlo,monospace',
}

// ─── Constants ──────────────────────────────────────────────────────────────
const Q_LABELS: Record<string, string> = {
  tipo:'Tipo de cabelo', cor:'Cor do cabelo', idade:'Faixa etária',
  incomoda:'O que mais incomoda', quimica:'Químicas recentes', corte_quimico:'Corte químico?',
  espessura:'Espessura do fio', oleosidade:'Seco/oleoso/normal', porosidade:'Porosidade',
  caspa:'Caspa/coceira', elasticidade:'Elasticidade', lavagem:'Freq. lavagem',
  calor:'Uso de calor', cronograma:'Faz cronograma?', crescimento_desigual:'Crescimento desigual',
  sol_piscina:'Sol/piscina/mar', agua:'Litros de água/dia', protetor:'Usa protetor?',
  como_plano:'Como quer o plano', cortes:'Freq. de cortes', areas:'Áreas preocupantes',
}
const Q_ORDER = Object.keys(Q_LABELS)
const OPT_LABEL: Record<string, Record<string,string>> = {
  tipo:{crespo:'Crespo',cacheado:'Cacheado',ondulado:'Ondulado',liso:'Liso'},
  cor:{preto:'Preto',castanho_claro:'Castanho claro',castanho_esc:'Castanho Escuro',ruivo:'Ruivo',loiro:'Loiro'},
  idade:{'13_18':'13–18','19_30':'19–30','31_50':'31–50','51':'+51'},
  incomoda:{pontas:'Pontas',frizz:'Frizz',cresc:'Pouco crescimento',queda:'Queda',volume:'Volume',quebra:'Quebra'},
  quimica:{progressiva:'Progressiva',descolor:'Descoloração',tintura:'Tintura',relax:'Relaxamento',botox:'Botox/Selagem',nenhuma:'Nenhuma'},
}

const FUNNEL_STAGES = [
  { key:'clicks',             label:'Cliques (anúncios)', color:T.blue },
  { key:'sessions',           label:'Visitou o quiz',   color:T.inkSoft },
  { key:'engaged',            label:'Interagiu',        color:T.blue },
  { key:'lead',               label:'Lead capturado',   color:T.amber },
  { key:'offer_viewed',       label:'Viu oferta',       color:T.purple },
  { key:'checkout_initiated', label:'Iniciou checkout', color:T.pink },
  { key:'purchased',          label:'Comprou',          color:T.green },
] as const

// ─── Helpers ────────────────────────────────────────────────────────────────
function isoDateBR(ts: number) {
  // Para bucket diário em horário de Brasília (UTC-3) — alinha com o resto do app
  return new Date(ts - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
}
function pctText(num: number, denom: number): string {
  if (!denom) return '—'
  const v = (num / denom) * 100
  return `${v.toFixed(v >= 10 ? 0 : 1)}%`
}
function deltaInfo(curr: number, prev: number): { label: string; positive: boolean; neutral: boolean } {
  if (prev === 0) return { label: curr > 0 ? 'novo' : '—', positive: curr > 0, neutral: curr === 0 }
  const pct = Math.round(((curr - prev) / prev) * 100)
  return { label: `${pct > 0 ? '+' : ''}${pct}%`, positive: pct >= 0, neutral: pct === 0 }
}
function sparkPath(values: number[], w: number, h: number): string {
  const max = Math.max(...values, 1)
  return values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * w
    const y = h - (v / max) * (h - 2)
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')
}

// ─── Data fetch ─────────────────────────────────────────────────────────────
async function fetchData() {
  const sb = createAdminClient()
  const now = Date.now()
  const since14 = new Date(now - 14 * 86400_000).toISOString()
  const since30 = new Date(now - 30 * 86400_000).toISOString()
  const since60 = new Date(now - 60 * 86400_000).toISOString()
  const slug = 'plano-capilar'

  const [
    views30, viewsPrev,
    step0_30, step0Prev,
    leads30, leadsPrev,
    profilesActive30, profilesActivePrev,
    checkoutEvents30, checkoutEventsPrev,
    answersBySession,
    answersWithMeta,
    leadsDetailed,
    leadsHourly,
    funnelNowR,
    funnelPrevR,
    dailyR,
    metaClicksByDay,
    dropoffR,
  ] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_views') as any).select('session_id, created_at').eq('quiz_slug', slug).gte('created_at', since30).not('session_id', 'is', null),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_views') as any).select('session_id, created_at').eq('quiz_slug', slug).gte('created_at', since60).lt('created_at', since30).not('session_id', 'is', null),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_step_events') as any).select('session_id, created_at').eq('quiz_slug', slug).eq('step_index', 0).eq('event_type', 'answered').gte('created_at', since30),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_step_events') as any).select('session_id').eq('quiz_slug', slug).eq('step_index', 0).eq('event_type', 'answered').gte('created_at', since60).lt('created_at', since30),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_leads') as any).select('id, name, email, utm_source, utm_medium, utm_campaign, created_at').eq('quiz_slug', slug).gte('created_at', since30).order('created_at', { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_leads') as any).select('id', { count: 'exact', head: true }).eq('quiz_slug', slug).gte('created_at', since60).lt('created_at', since30),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('profiles') as any).select('subscription_activated_at').eq('subscription_status', 'active').or('is_gift.is.null,is_gift.eq.false').gte('subscription_activated_at', since30),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('profiles') as any).select('id', { count: 'exact', head: true }).eq('subscription_status', 'active').or('is_gift.is.null,is_gift.eq.false').gte('subscription_activated_at', since60).lt('subscription_activated_at', since30),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('checkout_events') as any).select('event_type, created_at').gte('created_at', since30),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('checkout_events') as any).select('event_type').gte('created_at', since60).lt('created_at', since30),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_answers') as any).select('question_id, session_id').eq('quiz_slug', slug),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_answers') as any).select('question_id, answer, session_id').eq('quiz_slug', slug).in('question_id', ['tipo','cor','incomoda','quimica','idade']),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_leads') as any).select('id, name, email, utm_source, created_at').eq('quiz_slug', slug).gte('created_at', since30).order('created_at', { ascending: false }).limit(20),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_leads') as any).select('created_at').eq('quiz_slug', slug).gte('created_at', since30),
    // Funil EXATO (RPC — sem cap de 1000) período atual e anterior
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb as any).rpc('plano_funnel', { p_since: since30, p_until: new Date(now).toISOString() }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb as any).rpc('plano_funnel', { p_since: since60, p_until: since30 }),
    // Série diária exata (30 dias)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb as any).rpc('plano_daily', { p_days: 30 }),
    // Cliques do Meta (campanhas do plano) por dia — pro topo do funil + conversão
    getPlanoClicksDaily(isoDateBR(now - 29 * 86400_000), isoDateBR(now)),
    // Drop-off exato por pergunta (RPC — sem cap), últimos 30 dias
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb as any).rpc('plano_dropoff', { p_since: since30 }),
  ])

  // ── KPI base (period) ────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v30rows = (views30.data ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vPrevRows = (viewsPrev.data ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s0rows = (step0_30.data ?? []) as any[]

  const sessions = new Set<string>(v30rows.map((r) => r.session_id)).size
  const sessionsPrev = new Set<string>(vPrevRows.map((r) => r.session_id)).size
  const engaged = new Set<string>(s0rows.map((r) => r.session_id)).size
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const engagedPrev = new Set<string>(((step0Prev.data ?? []) as any[]).map((r) => r.session_id)).size

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leadsRows = (leads30.data ?? []) as any[]
  const lead = leadsRows.length
  const leadPrev = leadsPrev.count ?? 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profilesActiveRows = (profilesActive30.data ?? []) as any[]
  const purchased = profilesActiveRows.length
  const purchasedPrev = profilesActivePrev.count ?? 0

  // ── Checkout breakdown ──────────────────────────────────────────────
  const ce30: Record<string, number> = {}
  const cePrev: Record<string, number> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (checkoutEvents30.data ?? []) as any[]) ce30[r.event_type] = (ce30[r.event_type] ?? 0) + 1
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (checkoutEventsPrev.data ?? []) as any[]) cePrev[r.event_type] = (cePrev[r.event_type] ?? 0) + 1

  // Funil EXATO vindo das RPCs (sem cap de 1000). Cliques do Meta no topo.
  const metaClicksTotal = Object.values((metaClicksByDay ?? {}) as Record<string, number>).reduce((s, n) => s + (n || 0), 0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fN = ((funnelNowR as any)?.data ?? {}) as Record<string, number>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fP = ((funnelPrevR as any)?.data ?? {}) as Record<string, number>
  const funnelCounts: Record<string, number> = {
    clicks:             metaClicksTotal,
    sessions:           fN.sessions ?? 0,
    engaged:            fN.engaged ?? 0,
    lead:               fN.lead ?? 0,
    offer_viewed:       fN.offer_viewed ?? 0,
    checkout_initiated: fN.checkout_initiated ?? 0,
    purchased:          fN.purchased ?? 0,
  }
  const funnelPrev: Record<string, number> = {
    clicks:             0, // sem histórico de cliques do período anterior
    sessions:           fP.sessions ?? 0,
    engaged:            fP.engaged ?? 0,
    lead:               fP.lead ?? 0,
    offer_viewed:       fP.offer_viewed ?? 0,
    checkout_initiated: fP.checkout_initiated ?? 0,
    purchased:          fP.purchased ?? 0,
  }
  // Silencia variáveis antigas (agora vêm das RPCs) sem quebrar o resto do arquivo.
  void sessions; void engaged; void lead; void purchased; void sessionsPrev; void engagedPrev; void leadPrev; void purchasedPrev; void ce30; void cePrev;

  // ── Sparkline series (14 dias) por KPI ──────────────────────────────
  const days14 = Array.from({ length: 14 }, (_, i) => isoDateBR(now - (13 - i) * 86400_000))
  function bucket14(rows: { created_at?: string; subscription_activated_at?: string }[], dateField: 'created_at' | 'subscription_activated_at'): number[] {
    const map: Record<string, Set<string> | number> = {}
    days14.forEach(d => { map[d] = 0 })
    for (const r of rows) {
      const ts = (r as Record<string, unknown>)[dateField] as string | undefined
      if (!ts) continue
      const k = isoDateBR(new Date(ts).getTime())
      if (k in map) (map[k] as number)++
    }
    return days14.map(d => (map[d] as number) || 0)
  }
  function bucket14Unique(rows: { created_at?: string; session_id: string }[]): number[] {
    const map: Record<string, Set<string>> = {}
    days14.forEach(d => { map[d] = new Set() })
    for (const r of rows) {
      if (!r.created_at || !r.session_id) continue
      const k = isoDateBR(new Date(r.created_at).getTime())
      if (k in map) map[k].add(r.session_id)
    }
    return days14.map(d => map[d].size)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const spSessions = bucket14Unique(v30rows.filter((r) => new Date(r.created_at).getTime() >= now - 14 * 86400_000) as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const spEngaged  = bucket14Unique(s0rows.filter((r) => new Date(r.created_at).getTime() >= now - 14 * 86400_000) as any)
  const spLead     = bucket14(leadsRows.filter((r) => new Date(r.created_at).getTime() >= now - 14 * 86400_000), 'created_at')
  const spPurchased = bucket14(profilesActiveRows.filter((r) => new Date(r.subscription_activated_at).getTime() >= now - 14 * 86400_000), 'subscription_activated_at')

  // ── Daily trend (30 dias) — da RPC (exata) + cliques do Meta + conversão ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dailyRows = (((dailyR as any)?.data ?? []) as any[])
  const clicksMap = (metaClicksByDay ?? {}) as Record<string, number>
  const dailySeries = dailyRows.map((r) => {
    const date = String(r.dia)
    const clicks = clicksMap[date] ?? 0
    const sales = Number(r.sales) || 0
    return {
      date,
      sessions: Number(r.sessions) || 0,
      engaged:  Number(r.engaged) || 0,
      lead:     Number(r.leads) || 0,
      clicks,
      sales,
      conversao: clicks > 0 ? (sales / clicks) * 100 : 0,
    }
  })

  // ── Drop-off por pergunta (RPC exata — sem cap de 1000) ─────────────
  const qCount = new Map<string, number>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (((dropoffR as any)?.data ?? []) as any[])) {
    qCount.set(r.question_id, Number(r.sessions) || 0)
  }
  const qSessions = { get: (q: string) => ({ size: qCount.get(q) ?? 0 }) } // shim p/ manter o resto do código
  void answersBySession
  const top = Math.max(...Q_ORDER.map(q => qSessions.get(q)?.size ?? 0), 1)
  const dropoff = Q_ORDER.map((q, i) => {
    const n = qSessions.get(q)?.size ?? 0
    const prevN = i > 0 ? (qSessions.get(Q_ORDER[i - 1])?.size ?? 0) : null
    const dropPct = prevN != null && prevN > 0 ? Math.round(((prevN - n) / prevN) * 100) : null
    return { qid: q, label: Q_LABELS[q], sessions: n, pctOfTop: Math.round((n / top) * 100), dropPct }
  }).filter(r => r.sessions > 0)

  // ── Top answers (top 5 questões) ────────────────────────────────────
  const ansCounts: Record<string, Record<string, number>> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (answersWithMeta.data ?? []) as any[]) {
    const qid = r.question_id as string
    if (!ansCounts[qid]) ansCounts[qid] = {}
    const values = Array.isArray(r.answer) ? r.answer : [r.answer]
    for (const v of values) {
      const key = String(v)
      ansCounts[qid][key] = (ansCounts[qid][key] ?? 0) + 1
    }
  }
  const topAnswerQuestions = ['tipo', 'cor', 'incomoda', 'quimica']
  const topAnswers = topAnswerQuestions.map((qid) => {
    const counts = ansCounts[qid] ?? {}
    const labels = OPT_LABEL[qid] ?? {}
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    const items = Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 5).map(([value, count]) => ({
      label: labels[value] ?? value, count, pct: total ? Math.round((count / total) * 100) : 0,
    }))
    return { qid, question: Q_LABELS[qid] ?? qid, items, total }
  }).filter(x => x.items.length > 0)

  // ── UTM breakdowns ──────────────────────────────────────────────────
  function countBy(field: 'utm_source' | 'utm_medium' | 'utm_campaign'): { value: string; count: number }[] {
    const m: Record<string, number> = {}
    for (const r of leadsRows) {
      const v = (r[field] as string | null) || '—'
      m[v] = (m[v] ?? 0) + 1
    }
    return Object.entries(m).sort(([, a], [, b]) => b - a).slice(0, 6).map(([value, count]) => ({ value, count }))
  }
  const utmSource   = countBy('utm_source')
  const utmMedium   = countBy('utm_medium')
  const utmCampaign = countBy('utm_campaign')

  // ── Hourly heatmap (7d week × 24h) — usa todos leads do período ────
  const heatmap: number[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (leadsHourly.data ?? []) as any[]) {
    const d = new Date(new Date(r.created_at).getTime() - 3 * 60 * 60 * 1000) // BR
    const dow = d.getUTCDay() // 0=Sun
    const h = d.getUTCHours()
    heatmap[dow][h]++
  }
  const heatMax = Math.max(...heatmap.flat(), 1)

  // ── Recent activity ─────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recent = ((leadsDetailed.data ?? []) as any[]).map((r) => ({
    name: r.name || '—',
    email: r.email || '—',
    utm_source: r.utm_source || null,
    created_at: r.created_at,
  }))

  return {
    funnelCounts, funnelPrev,
    sparklines: { sessions: spSessions, engaged: spEngaged, lead: spLead, purchased: spPurchased },
    dailySeries,
    dropoff, topAnswers,
    utmSource, utmMedium, utmCampaign,
    heatmap, heatMax,
    recent,
  }
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default async function Painel2Page() {
  const data = await fetchData()
  const { funnelCounts, funnelPrev, sparklines, dailySeries, dropoff, topAnswers, utmSource, utmMedium, utmCampaign, heatmap, heatMax, recent } = data

  // KPI definitions with sparkline + delta
  const kpis: { key: keyof typeof sparklines; label: string; accent: string; spark: number[] }[] = [
    { key: 'sessions',  label: 'Visitas únicas', accent: T.inkSoft, spark: sparklines.sessions },
    { key: 'engaged',   label: 'Interagiu',      accent: T.blue,    spark: sparklines.engaged },
    { key: 'lead',      label: 'Leads',          accent: T.amber,   spark: sparklines.lead },
    { key: 'purchased', label: 'Compraram',      accent: T.green,   spark: sparklines.purchased },
  ]

  // Funnel
  const funnelTop = Math.max(funnelCounts.sessions, 1)
  const funnelRows = FUNNEL_STAGES.map((s, i) => {
    const count = funnelCounts[s.key] ?? 0
    const prev = i > 0 ? funnelCounts[FUNNEL_STAGES[i - 1].key] ?? 0 : null
    return {
      ...s,
      count,
      widthPct: Math.max(1.5, Math.round((count / funnelTop) * 100)),
      fromTop: Math.round((count / funnelTop) * 100),
      fromPrev: prev != null && prev > 0 ? Math.round((count / prev) * 100) : null,
      deltaPrev: deltaInfo(count, funnelPrev[s.key] ?? 0),
    }
  })

  // (o gráfico de tendência agora é o componente interativo <TrendChart>)

  const overallConv = pctText(funnelCounts.purchased, funnelCounts.sessions)
  const conv30 = pctText(funnelCounts.purchased, funnelPrev.purchased + funnelCounts.purchased)

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.ink, fontFamily: fonts.sans }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 28px 60px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: T.inkMuted, marginBottom: 6 }}>
              <Link href="/quiz" style={{ color: T.inkMuted, textDecoration: 'none' }}>Quiz</Link>
              <span>›</span>
              <Link href="/quiz/plano-capilar" style={{ color: T.inkMuted, textDecoration: 'none' }}>Plano Capilar</Link>
              <span>›</span>
              <span style={{ color: T.ink, fontWeight: 600 }}>Painel 2</span>
            </div>
            <h1 style={{ fontSize: 27, fontWeight: 700, letterSpacing: -0.6, margin: 0, lineHeight: 1.1 }}>Insights do Funil</h1>
            <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 6 }}>
              Últimos 30 dias · sparklines com últimos 14 dias · % vs 30 dias anteriores
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/quiz/plano-capilar" style={btnGhost}>← Painel 1</Link>
            <a href="https://planodaju.julianecost.com/quiz" target="_blank" rel="noopener noreferrer" style={btnPrimary}>Ver quiz ↗</a>
          </div>
        </div>

        {/* KPI Strip with sparklines */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
          {kpis.map((k) => {
            const count = funnelCounts[k.key] ?? 0
            const d = deltaInfo(count, funnelPrev[k.key] ?? 0)
            return (
              <div key={k.key} style={card()}>
                <div style={kpiLabel}>{k.label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 }}>
                  <div style={kpiValue(k.accent)}>{count.toLocaleString('pt-BR')}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: d.neutral ? T.inkMuted : d.positive ? T.green : T.red }}>
                    {d.label}
                  </div>
                </div>
                <svg viewBox="0 0 100 24" preserveAspectRatio="none" style={{ width: '100%', height: 22, marginTop: 8, display: 'block' }}>
                  <path d={sparkPath(k.spark, 100, 24)} fill="none" stroke={k.accent} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div style={{ fontSize: 10, color: T.inkMuted, marginTop: 2 }}>últimos 14 dias</div>
              </div>
            )
          })}
          {/* Conv geral — dark */}
          <div style={{ ...card(), background: T.ink, color: '#fff', borderColor: T.ink }}>
            <div style={{ ...kpiLabel, color: 'rgba(255,255,255,0.6)' }}>Conversão geral</div>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.6, color: '#fff', fontFamily: fonts.mono, marginTop: 4 }}>{overallConv}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 12 }}>visitas → compras</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{conv30} se contado contra 60 dias</div>
          </div>
        </div>

        {/* Big trend chart — interativo (clique numa métrica pra isolar + valores exatos) */}
        <div style={{ ...card(), padding: 22, marginBottom: 16 }}>
          <div style={{ marginBottom: 6 }}>
            <div style={sectionTitle}>Tendência diária (30 dias)</div>
            <div style={{ fontSize: 11.5, color: T.inkMuted, marginTop: 3 }}>
              Clique numa métrica pra ver só ela (com o eixo real) · passe o mouse pra ver o valor exato de cada dia.
            </div>
          </div>
          <TrendChart days={dailySeries} />
        </div>

        {/* Funnel + comparativo */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14, marginBottom: 16 }}>
          {/* Funnel */}
          <div style={card()}>
            <div style={sectionTitle}>Funil de conversão</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 12 }}>
              {funnelRows.map((r) => (
                <div key={r.key} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 56px 72px 50px', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 12, color: T.inkSoft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</div>
                  <div style={{ position: 'relative', height: 26, background: T.borderSoft, borderRadius: 5 }}>
                    <div style={{ width: `${r.widthPct}%`, height: '100%', background: r.color, borderRadius: 5, display: 'flex', alignItems: 'center', paddingLeft: 9 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', fontFamily: fonts.mono }}>{r.count.toLocaleString('pt-BR')}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.ink, textAlign: 'right', fontFamily: fonts.mono }}>{r.fromTop}%</div>
                  <div style={{ fontSize: 10.5, color: r.fromPrev != null && r.fromPrev < 50 ? T.red : T.inkMuted, textAlign: 'right' }}>
                    {r.fromPrev != null ? `${r.fromPrev}% retém` : ''}
                  </div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: r.deltaPrev.neutral ? T.inkMuted : r.deltaPrev.positive ? T.green : T.red, textAlign: 'right' }}>
                    {r.deltaPrev.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Comparativo período anterior */}
          <div style={card()}>
            <div style={sectionTitle}>Comparativo · 30d vs 30d anteriores</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
              {FUNNEL_STAGES.map((s) => {
                const curr = funnelCounts[s.key] ?? 0
                const prev = funnelPrev[s.key] ?? 0
                const d = deltaInfo(curr, prev)
                return (
                  <div key={s.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 12, color: T.inkSoft }}>{s.label}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, fontFamily: fonts.mono }}>{curr}</div>
                      <div style={{ fontSize: 10.5, color: T.inkMuted, fontFamily: fonts.mono }}>← {prev}</div>
                      <div style={{ minWidth: 38, fontSize: 11, fontWeight: 700, textAlign: 'right', color: d.neutral ? T.inkMuted : d.positive ? T.green : T.red }}>
                        {d.label}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Drop-off + Heatmap */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14, marginBottom: 16 }}>
          {/* Drop-off por pergunta */}
          <div style={card()}>
            <div style={sectionTitle}>Drop-off por pergunta</div>
            <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 4 }}>Sessões únicas que responderam cada pergunta (sequencial)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12 }}>
              {dropoff.map((row) => (
                <div key={row.qid} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 36px 50px', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 11.5, color: T.inkSoft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.label}</div>
                  <div style={{ height: 6, background: T.borderSoft, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${row.pctOfTop}%`, height: '100%', background: row.dropPct != null && row.dropPct > 20 ? T.red : T.pink }} />
                  </div>
                  <div style={{ fontSize: 11, color: T.ink, fontWeight: 600, fontFamily: fonts.mono, textAlign: 'right' }}>{row.sessions}</div>
                  <div style={{ fontSize: 10, color: row.dropPct != null && row.dropPct > 20 ? T.red : T.inkMuted, textAlign: 'right', fontFamily: fonts.mono }}>
                    {row.dropPct != null ? `−${row.dropPct}%` : ''}
                  </div>
                </div>
              ))}
              {dropoff.length === 0 && <div style={emptyState}>Sem dados de respostas no período.</div>}
            </div>
          </div>

          {/* Heatmap dia/hora */}
          <div style={card()}>
            <div style={sectionTitle}>Quando capturamos leads (dia × hora BR)</div>
            <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 4 }}>Intensidade pelo número de leads no horário</div>
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '28px repeat(24, 1fr)', gap: 2, fontSize: 9, color: T.inkMuted }}>
                <div />
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} style={{ textAlign: 'center' }}>{h % 3 === 0 ? h : ''}</div>
                ))}
              </div>
              {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map((dl, i) => (
                <div key={dl} style={{ display: 'grid', gridTemplateColumns: '28px repeat(24, 1fr)', gap: 2, marginTop: 2 }}>
                  <div style={{ fontSize: 10, color: T.inkMuted, textAlign: 'center', alignSelf: 'center' }}>{dl}</div>
                  {Array.from({ length: 24 }, (_, h) => {
                    const v = heatmap[i][h]
                    const intensity = v / heatMax
                    const bg = intensity === 0
                      ? T.borderSoft
                      : `rgba(190, 24, 93, ${0.15 + intensity * 0.75})`
                    return <div key={h} title={`${dl} ${h}h — ${v} leads`} style={{ aspectRatio: '1', background: bg, borderRadius: 2 }} />
                  })}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 10, color: T.inkMuted }}>
              <span>menor</span>
              {[0.15, 0.3, 0.5, 0.7, 0.9].map(a => (
                <div key={a} style={{ width: 18, height: 8, background: `rgba(190,24,93,${a})`, borderRadius: 2 }} />
              ))}
              <span>maior · pico: {heatMax}</span>
            </div>
          </div>
        </div>

        {/* Top respostas */}
        <div style={{ ...card(), marginBottom: 16 }}>
          <div style={sectionTitle}>Distribuição das respostas (perfil das visitantes)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 14 }}>
            {topAnswers.map((q) => (
              <div key={q.qid}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.ink, marginBottom: 8 }}>{q.question}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {q.items.map((it, idx) => (
                    <div key={`${q.qid}-${it.label}-${idx}`}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                        <span style={{ color: T.inkSoft }}>{it.label}</span>
                        <span style={{ color: T.inkMuted, fontFamily: fonts.mono }}>{it.pct}%</span>
                      </div>
                      <div style={{ height: 4, background: T.borderSoft, borderRadius: 2 }}>
                        <div style={{ width: `${it.pct}%`, height: '100%', background: T.purple, borderRadius: 2 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {topAnswers.length === 0 && <div style={emptyState}>Sem dados ainda.</div>}
          </div>
        </div>

        {/* UTM breakdowns */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 16 }}>
          {[
            { title: 'UTM source',   data: utmSource },
            { title: 'UTM medium',   data: utmMedium },
            { title: 'UTM campaign', data: utmCampaign },
          ].map(({ title, data }) => {
            const max = Math.max(...data.map(d => d.count), 1)
            const sum = data.reduce((s, d) => s + d.count, 0)
            return (
              <div key={title} style={card()}>
                <div style={sectionTitle}>{title}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 12 }}>
                  {data.length === 0 && <div style={emptyState}>Sem dados.</div>}
                  {data.map((u) => (
                    <div key={u.value} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 36px', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontSize: 11.5, color: T.ink, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.value}</div>
                      <div style={{ height: 6, background: T.borderSoft, borderRadius: 3 }}>
                        <div style={{ width: `${(u.count / max) * 100}%`, height: '100%', background: T.blue, borderRadius: 3 }} />
                      </div>
                      <div style={{ fontSize: 11, color: T.inkSoft, fontFamily: fonts.mono, textAlign: 'right' }}>
                        {u.count} <span style={{ color: T.inkMuted }}>· {pctText(u.count, sum)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Recent activity */}
        <div style={card()}>
          <div style={sectionTitle}>Atividade recente · últimos leads</div>
          <div style={{ marginTop: 12 }}>
            {recent.length === 0 && <div style={emptyState}>Sem leads recentes.</div>}
            {recent.map((r, i) => {
              const dt = new Date(r.created_at)
              const ago = Math.round((Date.now() - dt.getTime()) / 60000)
              const agoLabel = ago < 60 ? `${ago}m atrás` : ago < 1440 ? `${Math.round(ago / 60)}h atrás` : `${Math.round(ago / 1440)}d atrás`
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 100px 90px', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < recent.length - 1 ? `1px solid ${T.borderSoft}` : 'none' }}>
                  <div style={{ fontSize: 12.5, color: T.ink, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                  <div style={{ fontSize: 11.5, color: T.inkSoft, fontFamily: fonts.mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.email}</div>
                  <div style={{ fontSize: 10.5, color: T.inkMuted, textTransform: 'lowercase' }}>{r.utm_source ?? 'direto'}</div>
                  <div style={{ fontSize: 11, color: T.inkMuted, textAlign: 'right', fontFamily: fonts.mono }}>{agoLabel}</div>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Reusable bits ─────────────────────────────────────────────────────────
function Legend({ color, label, total }: { color: string; label: string; total: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
      <div style={{ fontSize: 11, color: T.inkSoft }}>{label}</div>
      <div style={{ fontSize: 11, color: T.ink, fontWeight: 700, fontFamily: fonts.mono }}>{total.toLocaleString('pt-BR')}</div>
    </div>
  )
}

// ─── Styles ────────────────────────────────────────────────────────────────
function card(): React.CSSProperties {
  return { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 18 }
}
const sectionTitle: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6 }
const kpiLabel: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: T.inkMuted, textTransform: 'uppercase', letterSpacing: 0.4 }
const kpiValue = (color: string): React.CSSProperties => ({ fontSize: 26, fontWeight: 700, letterSpacing: -0.5, color, fontFamily: fonts.mono })
const emptyState: React.CSSProperties = { fontSize: 12, color: T.inkMuted, padding: '20px 0', textAlign: 'center' }
const btnGhost: React.CSSProperties = { background: T.surface, color: T.ink, padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none', border: `1px solid ${T.border}` }
const btnPrimary: React.CSSProperties = { background: T.pink, color: '#fff', padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none' }
