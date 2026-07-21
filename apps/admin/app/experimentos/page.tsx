import { createAdminClient } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'

export const revalidate = 30
export const metadata = { title: 'Experimentos A/B — Admin Plano da Ju' }

const accent = '#BE185D'
const green  = '#22A06B'
const red    = '#DC2626'
const blue   = '#2563EB'
const gray   = '#7C6B7E'
const dark   = '#2A1E2C'

const PLAN_PRICE = 34.90

// ── Types ──────────────────────────────────────────────────────────
interface Experiment {
  id:               string
  flag_key:         string
  name:             string
  hypothesis:       string | null
  target_quiz_slug: string
  target_step_id:   string
  status:           'draft' | 'running' | 'paused' | 'concluded'
  started_at:       string | null
  ended_at:         string | null
  traffic_pct:      number
  control_name:     string
  variant_name:     string
  variant_content:  Record<string, unknown>
  winner:           string | null
  conclusion_notes: string | null
}

interface VariantStats {
  views:        number
  interagiu:    number
  leads:        number
  sales:        number
  // Taxas (calculadas)
  interactionRate: number   // interagiu / views
  saleRate:        number   // sales / views
  revenue:         number   // sales * PLAN_PRICE
}

// ── Helpers ───────────────────────────────────────────────────────
function brl(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function pctStr(v: number) {
  return `${(v * 100).toFixed(1)}%`
}
function pctDelta(a: number, b: number): { text: string; positive: boolean } | null {
  if (b === 0) return null
  const delta = (a - b) / b
  return { text: `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)}%`, positive: delta >= 0 }
}

/**
 * Conta o número de sessões DISTINTAS por lado do experimento, dado um array
 * de linhas com colunas {session_id, ab_variant}.
 *
 * Retorna { control: Set, variant: Set } — usar size pra contar.
 */
function tallyVariants(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: any[],
  flagKey: string,
): { control: Set<string>; variant: Set<string> } {
  const control = new Set<string>()
  const variant = new Set<string>()
  for (const r of rows ?? []) {
    if (!r.session_id || !r.ab_variant) continue
    // ab_variant pode ser "flag_key:side" ou "flag1:side1,flag2:side2"
    const labels = String(r.ab_variant).split(',')
    for (const lbl of labels) {
      const [key, side] = lbl.split(':')
      if (key !== flagKey) continue
      if (side === 'control') control.add(r.session_id)
      else if (side === 'variant') variant.add(r.session_id)
    }
  }
  return { control, variant }
}

// ── Stats computation ─────────────────────────────────────────────
async function getExperimentStats(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  exp: Experiment,
): Promise<{ control: VariantStats; variant: VariantStats }> {
  // Fetch rows that contain ab_variant for this experiment.
  // Como ab_variant é uma string com formato "flag_key:side", usamos ilike.
  const since = exp.started_at ?? '1970-01-01'
  const flagLike = `%${exp.flag_key}:%`

  const [viewsRes, stepEventsRes, leadsRes, salesRes] = await Promise.all([
    sb.from('wg_quiz_views')
      .select('session_id, ab_variant')
      .eq('quiz_slug', exp.target_quiz_slug)
      .ilike('ab_variant', flagLike)
      .gte('created_at', since)
      .limit(50000),
    sb.from('wg_quiz_step_events')
      .select('session_id, ab_variant')
      .eq('quiz_slug', exp.target_quiz_slug)
      .eq('step_id', exp.target_step_id)
      .eq('event_type', 'answered')
      .ilike('ab_variant', flagLike)
      .gte('created_at', since)
      .limit(50000),
    sb.from('wg_quiz_leads')
      .select('session_id, ab_variant')
      .eq('quiz_slug', exp.target_quiz_slug)
      .ilike('ab_variant', flagLike)
      .gte('created_at', since)
      .limit(50000),
    // Vendas: profiles com subscription_status='active' cujo quiz_session_id
    // bate com session_ids visualizados no experimento. Fazemos via lista de
    // sessions e filtramos depois (não tem JOIN fácil com Supabase JS).
    sb.from('profiles')
      .select('quiz_session_id')
      .eq('subscription_status', 'active')
      .not('quiz_session_id', 'is', null)
      .gte('subscription_activated_at', since)
      .limit(50000),
  ])

  // Conta views/interagiu/leads por lado
  const views     = tallyVariants(viewsRes.data ?? [], exp.flag_key)
  const interagiu = tallyVariants(stepEventsRes.data ?? [], exp.flag_key)
  const leads     = tallyVariants(leadsRes.data ?? [], exp.flag_key)

  // Vendas: precisa cruzar quiz_session_id com qual lado a sessão estava
  // Pegamos os session_ids ativos de profile, e checamos qual lado eles
  // estavam na sessão (do views ou step_events).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeSessions = new Set<string>((salesRes.data ?? []).map((r: any) => r.quiz_session_id).filter(Boolean) as string[])
  const allSessions: Map<string, 'control' | 'variant'> = new Map()
  for (const sid of views.control)     allSessions.set(sid, 'control')
  for (const sid of views.variant)     allSessions.set(sid, 'variant')
  // Se a sessão não tem view (improvável), usa step_events como fallback
  for (const sid of interagiu.control) if (!allSessions.has(sid)) allSessions.set(sid, 'control')
  for (const sid of interagiu.variant) if (!allSessions.has(sid)) allSessions.set(sid, 'variant')

  let salesControl = 0
  let salesVariant = 0
  for (const sid of activeSessions) {
    const side = allSessions.get(sid)
    if (side === 'control') salesControl++
    else if (side === 'variant') salesVariant++
  }

  function build(side: 'control' | 'variant'): VariantStats {
    const v = side === 'control' ? views.control.size : views.variant.size
    const i = side === 'control' ? interagiu.control.size : interagiu.variant.size
    const l = side === 'control' ? leads.control.size : leads.variant.size
    const s = side === 'control' ? salesControl : salesVariant
    return {
      views:           v,
      interagiu:       i,
      leads:           l,
      sales:           s,
      interactionRate: v > 0 ? i / v : 0,
      saleRate:        v > 0 ? s / v : 0,
      revenue:         s * PLAN_PRICE,
    }
  }

  return { control: build('control'), variant: build('variant') }
}

// ── Page ──────────────────────────────────────────────────────────
export default async function ExperimentosPage() {
  const sb = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: experiments } = await (sb.from('wg_experiments' as any) as any)
    .select('*')
    .order('created_at', { ascending: false })

  const expList: Experiment[] = (experiments ?? []) as Experiment[]

  // Calcula stats só pros que estão rodando ou concluídos (draft não tem dados)
  const statsByExp = await Promise.all(
    expList.map(async exp => ({
      id: exp.id,
      stats: exp.status === 'draft'
        ? null
        : await getExperimentStats(sb, exp),
    })),
  )
  const statsMap = new Map(statsByExp.map(s => [s.id, s.stats]))

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: '#FFFAF5', fontFamily: 'Plus Jakarta Sans, -apple-system, system-ui, sans-serif',
    }}>
      <Sidebar />
      <main style={{ marginLeft: 234, flex: 1, height: '100vh', overflowY: 'auto', padding: '32px 40px' }}>

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: dark, margin: 0 }}>
            🧪 Experimentos A/B
          </h1>
          <p style={{ fontSize: 13, color: gray, margin: '4px 0 0' }}>
            Testes controlados nas etapas do funil. Métricas-chave: taxa de interação na página e taxa de venda.
          </p>
        </div>

        {expList.length === 0 ? (
          <div style={{
            background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)',
            padding: 40, textAlign: 'center',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🧪</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: dark, marginBottom: 6 }}>Nenhum experimento ainda</div>
            <div style={{ fontSize: 13, color: gray }}>Crie um experimento via SQL na tabela wg_experiments.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {expList.map(exp => {
              const stats = statsMap.get(exp.id) ?? null
              return <ExperimentCard key={exp.id} exp={exp} stats={stats} />
            })}
          </div>
        )}

      </main>
    </div>
  )
}

// ── Components ────────────────────────────────────────────────────
function ExperimentCard({
  exp,
  stats,
}: {
  exp: Experiment
  stats: { control: VariantStats; variant: VariantStats } | null
}) {
  const statusConfig: Record<Experiment['status'], { label: string; color: string; bg: string }> = {
    draft:      { label: 'Rascunho',  color: gray,   bg: '#F3EBE1' },
    running:    { label: 'Rodando',   color: green,  bg: green + '15' },
    paused:     { label: 'Pausado',   color: '#D97706', bg: '#D9770615' },
    concluded:  { label: 'Concluído', color: blue,   bg: blue + '15' },
  }
  const cfg = statusConfig[exp.status]

  // Interaction delta + sale delta
  const interactionDelta = stats ? pctDelta(stats.variant.interactionRate, stats.control.interactionRate) : null
  const saleDelta        = stats ? pctDelta(stats.variant.saleRate,        stats.control.saleRate)        : null

  return (
    <div style={{
      background: '#fff', borderRadius: 16,
      border: '1px solid rgba(0,0,0,0.06)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F3EBE1' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 5,
            color: cfg.color, background: cfg.bg, textTransform: 'uppercase', letterSpacing: 0.5,
          }}>
            {cfg.label}
          </span>
          <code style={{
            fontSize: 11, color: gray, padding: '2px 6px', borderRadius: 4,
            background: '#FFFAF5', fontFamily: 'monospace',
          }}>
            {exp.flag_key}
          </code>
          <span style={{ fontSize: 11, color: gray, marginLeft: 'auto' }}>
            Step <strong style={{ color: dark }}>{exp.target_step_id}</strong> · {exp.traffic_pct}% variante
          </span>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: dark, margin: '0 0 6px' }}>
          {exp.name}
        </h2>
        {exp.hypothesis && (
          <p style={{ fontSize: 13, color: gray, margin: 0, lineHeight: 1.55, fontStyle: 'italic' }}>
            &ldquo;{exp.hypothesis}&rdquo;
          </p>
        )}
        {exp.status === 'concluded' && exp.winner && (
          <div style={{
            marginTop: 12, padding: '11px 14px', borderRadius: 10,
            background: green + '12', border: `1px solid ${green}33`,
          }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: green }}>
              🏆 Vencedor: {exp.winner === 'control' ? exp.control_name : exp.winner === 'variant' ? exp.variant_name : exp.winner}
              {exp.ended_at && (
                <span style={{ fontWeight: 500, color: gray, marginLeft: 8 }}>
                  · encerrado em {new Date(exp.ended_at).toLocaleDateString('pt-BR')}
                </span>
              )}
            </div>
            {exp.conclusion_notes && (
              <div style={{ fontSize: 12.5, color: dark, marginTop: 5, lineHeight: 1.5 }}>
                {exp.conclusion_notes}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats table */}
      {stats ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#FFF7EE' }}>
                {['Variante', 'Visualizações', 'Interagiu', 'Taxa interação', 'Vendas', 'Taxa venda', 'Receita'].map((h, i) => (
                  <th key={i} style={{
                    padding: '11px 18px', textAlign: i === 0 ? 'left' : 'right',
                    fontSize: 11, color: gray, fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: 0.4,
                    borderBottom: '1px solid #F0F0F5',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <VariantRow
                label={exp.control_name + ' (controle)'}
                stats={stats.control}
                isControl
              />
              <VariantRow
                label={exp.variant_name + ' (variante)'}
                stats={stats.variant}
                interactionDelta={interactionDelta}
                saleDelta={saleDelta}
              />
            </tbody>
          </table>

          {/* Conclusion hint */}
          <div style={{
            padding: '14px 20px', borderTop: '1px solid #F3EBE1',
            background: '#FFF7EE', fontSize: 12, color: gray, lineHeight: 1.55,
          }}>
            {stats.control.views + stats.variant.views < 30 ? (
              <>⏳ <strong>Pouca amostra</strong> ainda — recomendado esperar pelo menos ~300 sessões por lado pra ter confiança estatística. Resultado pode mudar.</>
            ) : interactionDelta && saleDelta ? (
              <>📊 Variante {interactionDelta.positive ? 'ganhou' : 'perdeu'} {Math.abs(parseFloat(interactionDelta.text))}% em <strong>interação</strong> e {saleDelta.positive ? 'ganhou' : 'perdeu'} {Math.abs(parseFloat(saleDelta.text))}% em <strong>vendas</strong>. Use mais dados pra decidir (≥300/lado).</>
            ) : (
              <>📊 Aguardando primeiros dados nas duas variantes.</>
            )}
          </div>
        </div>
      ) : (
        <div style={{ padding: 30, textAlign: 'center', color: gray, fontSize: 13 }}>
          Experimento em rascunho. Mude o status pra <code>running</code> pra começar.
        </div>
      )}
    </div>
  )
}

function VariantRow({
  label, stats, isControl, interactionDelta, saleDelta,
}: {
  label: string
  stats: VariantStats
  isControl?: boolean
  interactionDelta?: { text: string; positive: boolean } | null
  saleDelta?:        { text: string; positive: boolean } | null
}) {
  const cellStyle: React.CSSProperties = {
    padding: '14px 18px', textAlign: 'right',
    fontSize: 14, color: dark,
    borderBottom: '1px solid #F9F9FC',
  }
  return (
    <tr>
      <td style={{ ...cellStyle, textAlign: 'left', fontWeight: 600 }}>
        <span style={{
          display: 'inline-block', width: 10, height: 10, borderRadius: 3,
          background: isControl ? gray : accent, marginRight: 8,
        }} />
        {label}
      </td>
      <td style={cellStyle}>{stats.views.toLocaleString('pt-BR')}</td>
      <td style={cellStyle}>{stats.interagiu.toLocaleString('pt-BR')}</td>
      <td style={cellStyle}>
        <strong style={{ color: stats.interactionRate > 0 ? dark : gray }}>
          {pctStr(stats.interactionRate)}
        </strong>
        {interactionDelta && (
          <div style={{ fontSize: 11, fontWeight: 600, marginTop: 2, color: interactionDelta.positive ? green : red }}>
            {interactionDelta.text}
          </div>
        )}
      </td>
      <td style={cellStyle}>{stats.sales.toLocaleString('pt-BR')}</td>
      <td style={cellStyle}>
        <strong style={{ color: stats.saleRate > 0 ? dark : gray }}>
          {pctStr(stats.saleRate)}
        </strong>
        {saleDelta && (
          <div style={{ fontSize: 11, fontWeight: 600, marginTop: 2, color: saleDelta.positive ? green : red }}>
            {saleDelta.text}
          </div>
        )}
      </td>
      <td style={{ ...cellStyle, fontWeight: 700, color: stats.revenue > 0 ? green : gray }}>
        {brl(stats.revenue)}
      </td>
    </tr>
  )
}
