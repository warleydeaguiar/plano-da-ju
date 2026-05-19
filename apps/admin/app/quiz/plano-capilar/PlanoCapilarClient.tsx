'use client'

import Link from 'next/link'

const accent = '#C4607A'
const green  = '#34C759'
const blue   = '#007AFF'
const gray   = '#8A8A8E'
const red    = '#FF3B30'
const orange = '#FF9500'

const BAR_COLORS = ['#C4607A', '#8B3A6E', '#E1306C', '#6366F1', '#4285F4', '#34C759', '#FF9500', '#c9a45c']

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: 12, color: gray, fontWeight: 600, marginBottom: 8, letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color ?? '#2D1B2E', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: gray, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function ViewsChart({ series }: { series: { label: string; views: number; cliques?: number; leads?: number }[] }) {
  // Usa cliques como barra principal (dado disponível desde o início)
  // Usa sessões únicas quando disponível (desde 19/05)
  const hasSessionData = series.some(d => d.views > 0)
  const barKey = hasSessionData ? 'views' : 'cliques'
  const maxBar  = Math.max(...series.map(d => (d as any)[barKey] ?? 0), 1)
  const maxLead = Math.max(...series.map(d => d.leads ?? 0), 1)
  const labelIndexes = new Set([0, Math.floor(series.length / 2), series.length - 1])
  return (
    <div>
      {/* Barras: cliques ou sessões */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80 }}>
        {series.map((d, i) => {
          const val = (d as any)[barKey] ?? 0
          const h   = Math.max(Math.round((val / maxBar) * 72), val > 0 ? 3 : 0)
          const tip = `${d.label}: ${d.cliques ?? 0} cliques · ${d.views} sessões únicas · ${d.leads ?? 0} leads`
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', position: 'relative' }}>
              {/* Barra de cliques */}
              <div title={tip} style={{ width: '100%', height: h, background: accent, borderRadius: '2px 2px 0 0', opacity: 0.65 }} />
              {/* Ponto de lead */}
              {(d.leads ?? 0) > 0 && (
                <div title={`${d.leads} leads`} style={{
                  position: 'absolute',
                  bottom: h + 2,
                  width: 6, height: 6,
                  borderRadius: '50%',
                  background: green,
                  border: '1.5px solid #fff',
                  left: '50%', transform: 'translateX(-50%)',
                }} />
              )}
            </div>
          )
        })}
      </div>
      {/* Labels de datas */}
      <div style={{ display: 'flex', marginTop: 4 }}>
        {series.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            {labelIndexes.has(i) && <div style={{ fontSize: 9, color: gray }}>{d.label}</div>}
          </div>
        ))}
      </div>
      {/* Legenda */}
      <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 12, height: 8, background: accent, borderRadius: 2, opacity: 0.65 }} />
          <span style={{ fontSize: 11, color: gray }}>{hasSessionData ? 'Sessões únicas' : 'Cliques'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: green, border: '1.5px solid #fff', boxShadow: `0 0 0 1px ${green}` }} />
          <span style={{ fontSize: 11, color: gray }}>Leads capturados</span>
        </div>
      </div>
    </div>
  )
}

function QuestionCard({ qa }: { qa: any }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#2D1B2E', flex: 1, paddingRight: 12 }}>{qa.question}</div>
        <span style={{ fontSize: 12, color: gray, whiteSpace: 'nowrap', background: '#F5F5F7', padding: '3px 10px', borderRadius: 20, flexShrink: 0 }}>
          {qa.total.toLocaleString('pt-BR')} resp.
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {qa.options.map((opt: any, i: number) => {
          const color = BAR_COLORS[i % BAR_COLORS.length]
          return (
            <div key={opt.value}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 13, color: '#2D1B2E', fontWeight: opt.pct >= 30 ? 700 : 500 }}>{opt.label}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: gray }}>{opt.count}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color, minWidth: 36, textAlign: 'right' }}>{opt.pct}%</span>
                </div>
              </div>
              <div style={{ height: 6, background: '#F0F0F5', borderRadius: 3 }}>
                <div style={{ height: '100%', borderRadius: 3, width: `${opt.pct}%`, background: color, transition: 'width 0.6s ease' }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Steps que auto-avançam (sem clique do usuário)
const AUTO_ADVANCE_STEPS = new Set(['loading'])

// ─── Funil por etapa ─────────────────────────────────────────────
function StepFunnelRow({ row, isWorst }: { row: any; isWorst: boolean }) {
  const rate = row.conversion_rate
  const isAutoAdvance = AUTO_ADVANCE_STEPS.has(row.step_id)
  // Loading step: trata como transparente (não é abandono real)
  const rateColor = isAutoAdvance ? '#5AC8FA' : rate == null ? gray : rate >= 80 ? green : rate >= 60 ? '#34C759CC' : rate >= 40 ? orange : red
  const barColor  = isAutoAdvance ? '#5AC8FA' : rate == null ? '#E5E5EA' : rate >= 80 ? green : rate >= 60 ? '#5AC8FA' : rate >= 40 ? orange : red
  const barWidth  = row.pct_of_top ?? 100

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '28px 200px 1fr 80px 80px 80px',
      gap: 10,
      alignItems: 'center',
      padding: '8px 0',
      borderBottom: '1px solid #F0F0F5',
      background: isWorst ? 'rgba(255,59,48,0.03)' : 'transparent',
      borderRadius: isWorst ? 6 : 0,
    }}>
      {/* Step index badge */}
      <div style={{
        width: 24, height: 24, borderRadius: '50%',
        background: isWorst ? red : '#F5F5F7',
        color: isWorst ? '#fff' : gray,
        fontSize: 10, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {row.step_index}
      </div>

      {/* Step name */}
      <div style={{ fontSize: 12, fontWeight: isWorst ? 700 : 500, color: isWorst ? red : '#2D1B2E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {row.label}
        {isWorst && <span style={{ fontSize: 10, marginLeft: 6, color: red }}>⚠ maior queda</span>}
      </div>

      {/* Bar */}
      <div style={{ position: 'relative', height: 10, background: '#F0F0F5', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${barWidth}%`, background: barColor, borderRadius: 5, opacity: 0.75, transition: 'width 0.4s' }} />
      </div>

      {/* Viewed */}
      <div style={{ fontSize: 12, color: '#2D1B2E', fontWeight: 600, textAlign: 'right' }}>
        {row.viewed.toLocaleString('pt-BR')}
        <div style={{ fontSize: 10, color: gray, fontWeight: 400 }}>viram</div>
      </div>

      {/* Answered */}
      <div style={{ fontSize: 12, color: '#2D1B2E', fontWeight: 600, textAlign: 'right' }}>
        {row.answered.toLocaleString('pt-BR')}
        <div style={{ fontSize: 10, color: gray, fontWeight: 400 }}>avançaram</div>
      </div>

      {/* Rate */}
      <div style={{ fontSize: 14, fontWeight: 700, color: rateColor, textAlign: 'right' }}>
        {isAutoAdvance ? <span style={{ fontSize: 11, color: '#5AC8FA', fontWeight: 600 }}>auto</span> : rate != null ? `${rate}%` : '—'}
        {!isAutoAdvance && row.dropoff_from_prev != null && row.dropoff_from_prev > 10 && (
          <div style={{ fontSize: 10, color: red, fontWeight: 500 }}>↓{row.dropoff_from_prev}%</div>
        )}
      </div>
    </div>
  )
}

// ─── Funnel de checkout ───────────────────────────────────────────
function CheckoutFunnelBar({ label, count, base, color, isBase }: { label: string; count: number; base: number; color: string; isBase?: boolean }) {
  const pct = base > 0 ? Math.round((count / base) * 100) : null
  const barW = base > 0 ? Math.round((count / base) * 100) : (isBase ? 100 : 0)
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 13, color: '#2D1B2E', fontWeight: isBase ? 700 : 500 }}>{label}</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#2D1B2E' }}>{count.toLocaleString('pt-BR')}</span>
          {pct != null && !isBase && (
            <span style={{ fontSize: 12, fontWeight: 600, color, minWidth: 40, textAlign: 'right' }}>{pct}%</span>
          )}
          {isBase && <span style={{ fontSize: 11, color: gray, minWidth: 40, textAlign: 'right' }}>base</span>}
        </div>
      </div>
      <div style={{ height: 8, background: '#F0F0F5', borderRadius: 4 }}>
        <div style={{ height: '100%', borderRadius: 4, width: `${barW}%`, background: color, transition: 'width 0.6s', opacity: isBase ? 0.5 : 1 }} />
      </div>
    </div>
  )
}

// Mínimo de sessões únicas para considerar o funil estatisticamente útil
const MIN_FUNNEL_SESSIONS = 30

export default function PlanoCapilarClient({ data }: { data: any }) {
  const { kpis, dailySeries, questionAnalytics, answerFunnel = [], stepFunnel = [] } = data

  const topStepSessions = stepFunnel[0]?.viewed ?? 0
  const hasSufficientData = topStepSessions >= MIN_FUNNEL_SESSIONS

  // Encontra passo com maior drop-off de viewers — só exibe se dados suficientes
  const worstDropoffStep = hasSufficientData
    ? stepFunnel.reduce((worst: any, row: any) => {
        if (row.dropoff_from_prev == null) return worst
        if (!worst || row.dropoff_from_prev > worst.dropoff_from_prev) return row
        return worst
      }, null)
    : null

  const hasFunnelData = stepFunnel.length > 0

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Link href="/quiz" style={{ fontSize: 13, color: gray, textDecoration: 'none' }}>Quiz</Link>
            <span style={{ color: gray }}>›</span>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#2D1B2E' }}>Plano Capilar</div>
          </div>
          <div style={{ fontSize: 13, color: gray }}>Quiz de 32 perguntas para venda do app</div>
        </div>
        <a href="https://planodaju.julianecost.com/quiz" target="_blank" rel="noopener noreferrer"
          style={{ background: accent, color: '#fff', padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
          Ver quiz ↗
        </a>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 8 }}>
        <StatCard label="PESSOAS ÚNICAS" value={(kpis.uniqueSessions ?? 0).toLocaleString('pt-BR')} sub={`${(kpis.totalCliques ?? 0).toLocaleString('pt-BR')} cliques totais`} />
        <StatCard label="HOJE" value={kpis.uniqueToday ?? 0} sub={`${kpis.todayCliques ?? 0} cliques`} color={(kpis.uniqueToday ?? 0) > 0 ? green : '#2D1B2E'} />
        <StatCard label="LEADS (30d)" value={(kpis.periodLeads ?? 0).toLocaleString('pt-BR')} sub="email capturado" color={blue} />
        <StatCard
          label="ASSINANTES"
          value={kpis.activeProfiles ?? kpis.profiles}
          sub={`${kpis.profiles} cadastrados · ${kpis.activeProfiles ?? 0} ativos`}
          color={accent}
        />
        <StatCard
          label="CONVERSÃO"
          value={kpis.conversion != null ? `${kpis.conversion}%` : '—'}
          sub={kpis.conversionBase === 'cliques' ? 'assinantes / cliques (estimado)' : kpis.conversionBase === 'sessions' ? 'assinantes / pessoas únicas' : 'dados insuficientes'}
          color={kpis.conversion != null ? (kpis.conversion >= 5 ? green : kpis.conversion >= 2 ? orange : red) : '#2D1B2E'}
        />
      </div>
      {/* Nota explicativa sobre sessões */}
      <div style={{ fontSize: 11, color: gray, marginBottom: 20, paddingLeft: 4 }}>
        💡 <strong>Pessoas únicas</strong> = sessões identificadas por localStorage (1 pessoa = 1 sessão mesmo fechando e reabrindo o quiz) ·{' '}
        <strong>Cliques</strong> = cada carregamento da página (bate com dados de anúncios)
      </div>

      {/* Funil de checkout (30d) */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#2D1B2E', marginBottom: 16 }}>💳 Funil de checkout — últimos 30 dias</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div>
            <CheckoutFunnelBar label="Viu a oferta" count={kpis.offerViewed ?? 0} base={kpis.offerViewed ?? 0} color={accent} isBase />
            <CheckoutFunnelBar label="Iniciou checkout" count={kpis.checkoutInitiated ?? 0} base={kpis.offerViewed ?? 0} color={blue} />
            <CheckoutFunnelBar label="PIX gerado" count={kpis.pixGenerated ?? 0} base={kpis.offerViewed ?? 0} color={orange} />
            <CheckoutFunnelBar label="Pagamento confirmado" count={kpis.paymentConfirmed ?? 0} base={kpis.offerViewed ?? 0} color={green} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, paddingLeft: 16, borderLeft: '1px solid #F0F0F5' }}>
            <div style={{ fontSize: 12, color: gray }}>Pessoas únicas (30d)</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: (kpis.uniqueMonth ?? 0) > 0 ? '#2D1B2E' : gray }}>
              {(kpis.uniqueMonth ?? 0) > 0 ? (kpis.uniqueMonth ?? 0).toLocaleString('pt-BR') : '—'}
            </div>
            {(kpis.uniqueMonth ?? 0) === 0 && (
              <div style={{ fontSize: 11, color: orange }}>
                ⏳ Rastreamento ativo desde 19/05 — dados acumulando
              </div>
            )}
            <div style={{ fontSize: 12, color: gray, marginTop: 4 }}>Taxa checkout → pagamento</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: (kpis.paymentConfirmed ?? 0) > 0 ? green : gray }}>
              {(kpis.checkoutInitiated ?? 0) > 0
                ? `${Math.round(((kpis.paymentConfirmed ?? 0) / (kpis.checkoutInitiated ?? 1)) * 100)}%`
                : '—'}
            </div>
            {(kpis.passwordSet ?? 0) > 0 && (
              <div style={{ fontSize: 12, color: green, marginTop: 4 }}>
                ✅ {kpis.passwordSet} cliente{(kpis.passwordSet ?? 0) > 1 ? 's' : ''} ativou acesso
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Gráfico de views */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#2D1B2E' }}>📈 Cliques + Leads por dia</div>
          <div style={{ fontSize: 12, color: gray }}>Últimos 30 dias · passe o mouse para detalhes</div>
        </div>
        <ViewsChart series={dailySeries} />
        <div style={{ marginTop: 12, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12, color: gray }}>
            Cliques (30d): <strong style={{ color: '#2D1B2E' }}>{dailySeries.reduce((s: number, d: any) => s + (d.cliques ?? 0), 0).toLocaleString('pt-BR')}</strong>
          </div>
          <div style={{ fontSize: 12, color: gray }}>
            Leads (30d): <strong style={{ color: green }}>{dailySeries.reduce((s: number, d: any) => s + (d.leads ?? 0), 0).toLocaleString('pt-BR')}</strong>
          </div>
          <div style={{ fontSize: 12, color: gray }}>
            Sessões únicas (30d): <strong style={{ color: (kpis.uniqueMonth ?? 0) > 0 ? '#2D1B2E' : gray }}>{(kpis.uniqueMonth ?? 0) > 0 ? kpis.uniqueMonth : '— (ativo desde 19/05)'}</strong>
          </div>
          <div style={{ fontSize: 12, color: gray }}>
            Média cliques/dia: <strong style={{ color: '#2D1B2E' }}>{(dailySeries.reduce((s: number, d: any) => s + (d.cliques ?? 0), 0) / 30).toFixed(1)}</strong>
          </div>
        </div>
      </div>

      {/* ── Funil por respostas (histórico desde o dia 1) ── */}
      {answerFunnel.length > 0 && (() => {
        const top = answerFunnel[0]?.sessions ?? 1
        const worst = answerFunnel.reduce((w: any, r: any) =>
          (r.dropoff_from_prev ?? 0) > (w?.dropoff_from_prev ?? 0) ? r : w, null)
        return (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 24px', marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#2D1B2E', marginBottom: 4 }}>📋 Funil por respostas — desde o início</div>
                <div style={{ fontSize: 12, color: gray }}>
                  Sessões únicas que responderam cada pergunta · <strong style={{ color: '#2D1B2E' }}>{top}</strong> sessões totais · dado disponível desde o dia 1
                </div>
              </div>
              {worst && worst.dropoff_from_prev > 5 && (
                <div style={{ background: 'rgba(255,59,48,0.07)', border: '1px solid rgba(255,59,48,0.2)', borderRadius: 10, padding: '8px 14px', textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
                  <div style={{ fontSize: 11, color: red, fontWeight: 600 }}>⚠ MAIOR ABANDONO</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: red }}>{worst.label}</div>
                  <div style={{ fontSize: 11, color: red }}>↓{worst.dropoff_from_prev}% não responderam</div>
                </div>
              )}
            </div>

            {/* Header da tabela — 5 colunas: label / barra / sessões / % / queda */}
            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 70px 60px 60px', gap: 12, padding: '6px 0', borderBottom: '2px solid #F0F0F5', marginBottom: 4 }}>
              <div style={{ fontSize: 11, color: gray, fontWeight: 600 }}>PERGUNTA</div>
              <div style={{ fontSize: 11, color: gray, fontWeight: 600 }}>ALCANCE</div>
              <div style={{ fontSize: 11, color: gray, fontWeight: 600, textAlign: 'right' }}>SESSÕES</div>
              <div style={{ fontSize: 11, color: gray, fontWeight: 600, textAlign: 'right' }}>% DO TOP</div>
              <div style={{ fontSize: 11, color: gray, fontWeight: 600, textAlign: 'right' }}>QUEDA</div>
            </div>

            {answerFunnel.map((row: any, i: number) => {
              const isWorst = worst && row.question_id === worst.question_id && (worst.dropoff_from_prev ?? 0) > 5
              const drop = row.dropoff_from_prev
              const dropColor = drop == null ? gray : drop === 0 ? green : drop <= 5 ? green : drop <= 15 ? orange : red
              const barColor  = drop == null || drop === 0 ? green : drop <= 5 ? green : drop <= 15 ? orange : red
              return (
                <div key={row.question_id} style={{
                  display: 'grid', gridTemplateColumns: '220px 1fr 70px 60px 60px', gap: 12,
                  alignItems: 'center', padding: '8px 0',
                  borderBottom: '1px solid #F0F0F5',
                  background: isWorst ? 'rgba(255,59,48,0.04)' : 'transparent',
                }}>
                  {/* Label (coluna fixa) */}
                  <div style={{ fontSize: 12, fontWeight: isWorst ? 700 : 500, color: isWorst ? red : '#2D1B2E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.label}
                    {isWorst && <span style={{ fontSize: 10, marginLeft: 6, color: red, fontWeight: 700 }}>⚠ gargalo</span>}
                  </div>
                  {/* Barra (coluna própria, ocupa o resto do espaço) */}
                  <div style={{ position: 'relative', height: 10, background: '#F0F0F5', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0,
                      width: `${row.pct_of_top}%`,
                      background: barColor, borderRadius: 5, opacity: 0.75,
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                  {/* Sessões */}
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#2D1B2E', textAlign: 'right' }}>{row.sessions}</div>
                  {/* % do topo */}
                  <div style={{ fontSize: 12, color: gray, textAlign: 'right' }}>{row.pct_of_top}%</div>
                  {/* Queda */}
                  <div style={{ fontSize: 12, fontWeight: drop != null && drop > 0 ? 700 : 400, color: dropColor, textAlign: 'right' }}>
                    {drop == null || drop === 0 ? '—' : `↓${drop}%`}
                  </div>
                </div>
              )
            })}

            <div style={{ marginTop: 12, fontSize: 11, color: gray, lineHeight: 1.6 }}>
              💡 Perguntas com <strong>0 respostas</strong> (como steps informativos) não aparecem aqui.
              <strong> produtos_casa</strong> pode ter menos respostas porque é opcional — usuárias sem produtos não selecionam nada.
            </div>
          </div>
        )
      })()}

      {/* Funil por etapa */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 24px', marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#2D1B2E', marginBottom: 4 }}>🔬 Funil por etapa — últimos 30 dias</div>
            <div style={{ fontSize: 12, color: gray }}>
              Sessões únicas que visualizaram e avançaram em cada passo · rastreamento ativo desde 19/05/2026
            </div>
          </div>
          {worstDropoffStep && (
            <div style={{ background: 'rgba(255,59,48,0.07)', border: '1px solid rgba(255,59,48,0.2)', borderRadius: 10, padding: '8px 14px', textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
              <div style={{ fontSize: 11, color: red, fontWeight: 600 }}>⚠ MAIOR ABANDONO</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: red }}>{worstDropoffStep.label}</div>
              <div style={{ fontSize: 11, color: red }}>passo {worstDropoffStep.step_index} — ↓{worstDropoffStep.dropoff_from_prev}% menos viewers</div>
            </div>
          )}
        </div>

        {!hasFunnelData ? (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#2D1B2E', marginBottom: 6 }}>Coletando dados por etapa</div>
            <div style={{ fontSize: 13, color: gray, maxWidth: 360, margin: '0 auto', lineHeight: 1.6 }}>
              O rastreamento por etapa foi ativado recentemente. Os dados aparecerão aqui conforme as usuárias acessarem o quiz.
            </div>
          </div>
        ) : (
          <div>
            {/* Aviso de dados insuficientes */}
            {!hasSufficientData && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.25)',
                borderRadius: 10, padding: '10px 14px', marginBottom: 16,
              }}>
                <span style={{ fontSize: 16 }}>⏳</span>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: orange }}>Dados insuficientes para análise confiável</span>
                  <span style={{ fontSize: 12, color: gray, marginLeft: 8 }}>
                    {topStepSessions} sessão{topStepSessions !== 1 ? 'ões' : ''} rastreada{topStepSessions !== 1 ? 's' : ''} — mínimo recomendado: {MIN_FUNNEL_SESSIONS}.
                    Aguarde mais tráfego para identificar gargalos reais.
                  </span>
                </div>
              </div>
            )}
            {/* Legenda */}
            <div style={{ display: 'grid', gridTemplateColumns: '28px 200px 1fr 80px 80px 80px', gap: 10, paddingBottom: 8, borderBottom: '2px solid #F0F0F5', marginBottom: 4 }}>
              <div />
              <div style={{ fontSize: 10, color: gray, fontWeight: 700, letterSpacing: 0.5 }}>ETAPA</div>
              <div style={{ fontSize: 10, color: gray, fontWeight: 700, letterSpacing: 0.5 }}>ALCANCE</div>
              <div style={{ fontSize: 10, color: gray, fontWeight: 700, letterSpacing: 0.5, textAlign: 'right' }}>VIRAM</div>
              <div style={{ fontSize: 10, color: gray, fontWeight: 700, letterSpacing: 0.5, textAlign: 'right' }}>AVANÇARAM</div>
              <div style={{ fontSize: 10, color: gray, fontWeight: 700, letterSpacing: 0.5, textAlign: 'right' }}>TAXA</div>
            </div>
            {stepFunnel.map((row: any) => (
              <StepFunnelRow
                key={row.step_index}
                row={row}
                isWorst={worstDropoffStep?.step_index === row.step_index && (worstDropoffStep?.dropoff_from_prev ?? 0) >= 20}
              />
            ))}
            <div style={{ marginTop: 16, padding: '12px 16px', background: '#F5F5F7', borderRadius: 10, display: 'flex', gap: 24, fontSize: 12, color: gray }}>
              <div><span style={{ color: green, fontWeight: 700 }}>■</span> ≥ 80% avanço</div>
              <div><span style={{ color: '#5AC8FA', fontWeight: 700 }}>■</span> 60–80%</div>
              <div><span style={{ color: orange, fontWeight: 700 }}>■</span> 40–60%</div>
              <div><span style={{ color: red, fontWeight: 700 }}>■</span> &lt; 40% — considerar A/B test</div>
            </div>
          </div>
        )}
      </div>

      {/* Analytics das perguntas */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#2D1B2E' }}>📊 Análise das respostas</div>
        {questionAnalytics.length === 0 && (
          <span style={{ fontSize: 12, color: gray }}>Os dados aparecem conforme as usuárias respondem o quiz</span>
        )}
      </div>

      {questionAnalytics.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#2D1B2E', marginBottom: 8 }}>Ainda sem dados de respostas</div>
          <div style={{ fontSize: 13, color: gray, lineHeight: 1.6, maxWidth: 400, margin: '0 auto' }}>
            Quando as usuárias começarem a responder o quiz, os percentuais de cada pergunta aparecerão aqui automaticamente.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          {questionAnalytics.map((qa: any) => (
            <QuestionCard key={qa.questionId} qa={qa} />
          ))}
        </div>
      )}
    </div>
  )
}
