'use client'

import Link from 'next/link'
import { useState } from 'react'

const accent = '#BE185D'
const gold   = '#c9a45c'
const green  = '#22A06B'
const gray   = '#7C6B7E'
const red    = '#DC2626'

const UTM_COLORS: Record<string, string> = {
  facebook: '#1877F2', instagram: '#E1306C', google: '#4285F4',
  tiktok: '#000', email: '#6366F1', direto: gray,
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: 12, color: gray, fontWeight: 600, marginBottom: 8, letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color ?? '#2A1E2C', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: gray, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function MiniBarChart({ series }: { series: { label: string; leads: number }[] }) {
  const max = Math.max(...series.map(d => d.leads), 1)
  const show = series.slice(-30)
  const labelIndexes = new Set([0, Math.floor(show.length / 2), show.length - 1])
  const [hover, setHover] = useState<number | null>(null)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 72 }}>
        {show.map((d, i) => {
          const h = Math.max(Math.round((d.leads / max) * 68), d.leads > 0 ? 3 : 0)
          const active = hover === i
          return (
            // A COLUNA INTEIRA (altura cheia) é a área de hover — antes o tooltip
            // ficava só na barrinha curta, então em dias com poucos/zero leads não
            // dava pra ver a quantidade. Tooltip próprio acima da barra.
            <div
              key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(p => (p === i ? null : p))}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', position: 'relative', cursor: 'default' }}
            >
              {active && (
                <div style={{
                  position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                  marginBottom: 6, whiteSpace: 'nowrap', background: '#2A1E2C', color: '#fff',
                  fontSize: 11, fontWeight: 600, padding: '4px 8px', borderRadius: 6,
                  zIndex: 10, pointerEvents: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
                }}>
                  {d.label}: {d.leads} {d.leads === 1 ? 'lead' : 'leads'}
                </div>
              )}
              <div style={{ width: '100%', height: h, background: gold, borderRadius: '2px 2px 0 0', opacity: active ? 1 : 0.85 }} />
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', marginTop: 4 }}>
        {show.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            {labelIndexes.has(i) && <div style={{ fontSize: 9, color: gray }}>{d.label}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

function formatPhone(phone: string | null) {
  if (!phone) return '—'
  const d = phone.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return phone
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const pctStr = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '—')
const thCell: React.CSSProperties = { padding: '11px 16px', fontSize: 11, color: gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }
const convCell: React.CSSProperties = { padding: '11px 16px', fontSize: 12.5, textAlign: 'right', color: green, fontWeight: 600 }

// ── FUNIL UNIFICADO: Cliques (Meta) → Visualização → Acessos → Etapa 1..7 → Lead ──
const UNIVERSE_LABEL: Record<string, string> = { meta: 'ANÚNCIO (META)', views: 'SITE', step: 'DENTRO DO QUIZ', lead: 'RESULTADO' }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function UnifiedFunnel({ rows, metaOk, hasStepData }: { rows: any[]; metaOk: boolean; hasStepData: boolean }) {
  const num = (): React.CSSProperties => ({ padding: '11px 16px', fontSize: 14, textAlign: 'right', fontWeight: 700, color: '#2A1E2C' })
  const cliques = rows.find(r => r.key === 'cliques')
  const acessos = rows.find(r => r.key === 'acessos')
  const lead = rows.find(r => r.key === 'lead')
  // "Seguem →" = % que avança para a PRÓXIMA linha, SÓ quando as duas linhas vêm
  // da mesma base de medição (mesmo universe). Nas fronteiras mostramos "—".
  const ret = (i: number, field: 'today' | 'yesterday' | 'd30') => {
    const s = rows[i]; const next = i < rows.length - 1 ? rows[i + 1] : null
    if (!next || next.universe !== s.universe || s[field] <= 0) return '—'
    return `${Math.round((next[field] / s[field]) * 100)}%`
  }
  // Maior desistência DENTRO do quiz (universe step), no período 30d.
  const stepIdx = rows.map((r, i) => ({ r, i })).filter(x => x.r.universe === 'step').map(x => x.i)
  let worstIdx = -1, worstRet = 1.01
  for (const i of stepIdx) {
    const next = rows[i + 1]
    if (next && next.universe === 'step' && rows[i].d30 >= 3) {
      const r = next.d30 / rows[i].d30
      if (r < worstRet) { worstRet = r; worstIdx = i }
    }
  }
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', marginBottom: 24, overflow: 'hidden' }}>
      <div style={{ padding: '16px 18px 4px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#2A1E2C' }}>🎯 Funil completo — Anúncio → Lead</div>
        <div style={{ fontSize: 11.5, color: gray, marginTop: 2 }}>Do clique no anúncio até virar lead. <strong>Seguem →</strong> = % que avança para a etapa seguinte (dentro da mesma medição). Lead é a métrica principal.</div>
        {worstIdx >= 0 && (
          <div style={{ fontSize: 12, color: red, marginTop: 6, fontWeight: 600 }}>
            🔴 Maior desistência dentro do quiz: <strong>{rows[worstIdx].label}</strong> — só {ret(worstIdx, 'd30')} seguem para a próxima etapa.
          </div>
        )}
        {!metaOk && <div style={{ fontSize: 11, color: '#B8860B', marginTop: 4 }}>⚠️ Dados do Meta indisponíveis no momento — Cliques/Visualização podem estar zerados.</div>}
        <div style={{ fontSize: 11, color: '#B8860B', marginTop: 4 }}>
          ⚠️ As linhas <strong>Etapa 1…7</strong> têm rastreamento próprio, iniciado em <strong>03/08 às 13:25</strong>. Por isso <strong>hoje</strong> elas mostram só quem entrou depois desse horário (ainda não refletem o dia inteiro). A partir de amanhã a Etapa 1 passa a bater com os Acessos.
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
          <thead>
            <tr style={{ background: '#FFF7EE', borderBottom: '1px solid #F0EAF2' }}>
              <th style={{ ...thCell, textAlign: 'left' }}>Etapa</th>
              <th style={{ ...thCell, textAlign: 'right' }}>Hoje</th>
              <th style={{ ...thCell, textAlign: 'right' }}>Seguem →</th>
              <th style={{ ...thCell, textAlign: 'right' }}>Ontem</th>
              <th style={{ ...thCell, textAlign: 'right' }}>Seguem →</th>
              <th style={{ ...thCell, textAlign: 'right' }}>30D</th>
              <th style={{ ...thCell, textAlign: 'right' }}>Seguem →</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => {
              const hi = !!s.main
              const isWorst = i === worstIdx
              const prevUniverse = i > 0 ? rows[i - 1].universe : null
              const newBlock = s.universe !== prevUniverse
              const bg = hi ? '#FDF2F6' : isWorst ? '#FEF2F2' : '#fff'
              const rCell = (isW: boolean): React.CSSProperties => ({ ...convCell, color: isW ? red : green, fontWeight: isW ? 800 : 600 })
              return (
                <tr key={s.key} style={{ borderBottom: '1px solid #F7F2F8', background: bg, borderTop: newBlock && i > 0 ? '2px solid #EDE4EF' : undefined }}>
                  <td style={{ padding: '11px 16px' }}>
                    {newBlock && <div style={{ fontSize: 9, fontWeight: 700, color: gray, letterSpacing: 0.5, marginBottom: 3 }}>{UNIVERSE_LABEL[s.universe]}</div>}
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: hi ? accent : isWorst ? red : '#2A1E2C', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {s.label}
                      {s.badge === 'META' && <span style={{ fontSize: 9, fontWeight: 700, color: '#2563EB', background: '#EFF6FF', borderRadius: 4, padding: '1px 5px', letterSpacing: 0.3 }}>META</span>}
                      {isWorst && <span style={{ fontSize: 9, fontWeight: 700, color: red, background: '#FEE2E2', borderRadius: 4, padding: '1px 5px' }}>MAIOR SAÍDA</span>}
                    </div>
                    {s.sub && <div style={{ fontSize: 11, color: gray, marginTop: 1 }}>{s.sub}</div>}
                  </td>
                  <td style={{ ...num(), color: hi ? accent : '#2A1E2C' }}>{s.today.toLocaleString('pt-BR')}</td>
                  <td style={rCell(isWorst)}>{ret(i, 'today')}</td>
                  <td style={{ ...num(), fontWeight: 600 }}>{s.yesterday.toLocaleString('pt-BR')}</td>
                  <td style={rCell(isWorst)}>{ret(i, 'yesterday')}</td>
                  <td style={{ ...num(), fontWeight: 600 }}>{s.d30.toLocaleString('pt-BR')}</td>
                  <td style={rCell(isWorst)}>{ret(i, 'd30')}</td>
                </tr>
              )
            })}
            {/* Conversões finais: sobre o clique pago e sobre o acesso ao site */}
            {[
              { label: '◎ Conversão paga (lead ÷ clique Meta)', base: cliques },
              { label: '◎ Conversão do site (lead ÷ acesso)', base: acessos },
            ].map(rowc => (
              <tr key={rowc.label} style={{ background: '#FBF6EC' }}>
                <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: gold }}>{rowc.label}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 14, fontWeight: 800, color: gold }}>{pctStr(lead.today, rowc.base?.today ?? 0)}</td>
                <td />
                <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 14, fontWeight: 800, color: gold }}>{pctStr(lead.yesterday, rowc.base?.yesterday ?? 0)}</td>
                <td />
                <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 14, fontWeight: 800, color: gold }}>{pctStr(lead.d30, rowc.base?.d30 ?? 0)}</td>
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Custo por lead × Taxa de conversão (7 dias) ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CostPerLeadChart({ series, stats }: { series: any[]; stats: any }) {
  const brl = (n: number | null) => (n == null ? '—' : `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
  const maxCpl = Math.max(...series.map(d => d.cpl ?? 0), 1)
  const maxConv = Math.max(...series.map(d => d.conv ?? 0), 1)
  // geometria do SVG
  const W = 720, H = 220, padX = 44, padY = 20, padBottom = 34
  const innerW = W - padX * 2, innerH = H - padY - padBottom
  const n = series.length
  const bw = (innerW / n) * 0.5
  const x = (i: number) => padX + (innerW / n) * (i + 0.5)
  const yCpl = (v: number) => padY + innerH - (v / maxCpl) * innerH
  const yConv = (v: number) => padY + innerH - (v / maxConv) * innerH
  const linePts = series.map((d, i) => (d.conv == null ? null : `${x(i)},${yConv(d.conv)}`)).filter(Boolean).join(' ')

  const Stat = ({ label, value, color }: { label: string; value: string; color?: string }) => (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 11, color: gray, fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 700, color: color ?? '#2A1E2C' }}>{value}</div>
    </div>
  )

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', marginBottom: 24, padding: '20px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#2A1E2C' }}>💰 Custo por lead × Taxa de conversão</div>
        <div style={{ fontSize: 12, color: gray }}>Últimos 7 dias</div>
      </div>
      <div style={{ fontSize: 11.5, color: gray, marginBottom: 16 }}>Barras = custo por lead (investimento ÷ leads). Linha = % dos acessos que viraram lead.</div>

      {!stats.hasSpend ? (
        <div style={{ padding: '20px 0', fontSize: 12.5, color: '#B8860B' }}>
          ⚠️ Sem investimento do Meta registrado nos últimos 7 dias para as campanhas de grupo — o custo por lead aparece quando houver gasto atribuído.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            <Stat label="INVESTIMENTO (7D)" value={brl(stats.spend)} />
            <Stat label="LEADS (7D)" value={stats.leads.toLocaleString('pt-BR')} color={green} />
            <Stat label="CUSTO/LEAD MÉDIO" value={brl(stats.avgCpl)} color={gold} />
            <Stat label="CONVERSÃO MÉDIA" value={stats.avgConv == null ? '—' : `${stats.avgConv.toFixed(1)}%`} color={accent} />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 560, display: 'block' }}>
              {/* grid horizontal */}
              {[0, 0.5, 1].map((f, i) => (
                <g key={i}>
                  <line x1={padX} y1={padY + innerH * (1 - f)} x2={W - padX} y2={padY + innerH * (1 - f)} stroke="#F0EAF2" strokeWidth={1} />
                  <text x={padX - 8} y={padY + innerH * (1 - f) + 3} textAnchor="end" fontSize={9} fill={gray}>{brl(maxCpl * f).replace('R$ ', '')}</text>
                  <text x={W - padX + 8} y={padY + innerH * (1 - f) + 3} textAnchor="start" fontSize={9} fill={accent}>{Math.round(maxConv * f)}%</text>
                </g>
              ))}
              {/* barras de CPL */}
              {series.map((d, i) => d.cpl != null && (
                <g key={i}>
                  <rect x={x(i) - bw / 2} y={yCpl(d.cpl)} width={bw} height={padY + innerH - yCpl(d.cpl)} rx={3} fill={gold} opacity={0.9} />
                  <text x={x(i)} y={yCpl(d.cpl) - 5} textAnchor="middle" fontSize={9} fontWeight={700} fill="#8a6d2f">{brl(d.cpl).replace('R$ ', '')}</text>
                </g>
              ))}
              {/* linha de conversão */}
              {linePts && <polyline points={linePts} fill="none" stroke={accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
              {series.map((d, i) => d.conv != null && (
                <circle key={`c${i}`} cx={x(i)} cy={yConv(d.conv)} r={3} fill="#fff" stroke={accent} strokeWidth={2} />
              ))}
              {/* labels do eixo X */}
              {series.map((d, i) => (
                <text key={`l${i}`} x={x(i)} y={H - 14} textAnchor="middle" fontSize={10} fill={gray}>{d.label}</text>
              ))}
            </svg>
          </div>
          <div style={{ display: 'flex', gap: 18, marginTop: 12, fontSize: 11, color: gray }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 8, background: gold, borderRadius: 2, display: 'inline-block' }} />Custo por lead (R$)</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 2, background: accent, display: 'inline-block' }} />Taxa de conversão (%)</span>
          </div>
        </>
      )}
    </div>
  )
}

export default function FashionGoldClient({ data }: { data: any }) {
  const { kpis, dailySeries, utmBreakdown, leads } = data
  const totalUtm = utmBreakdown.reduce((s: number, u: any) => s + u.count, 0) || 1

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Link href="/quiz" style={{ fontSize: 13, color: gray, textDecoration: 'none' }}>Quiz</Link>
            <span style={{ color: gray }}>›</span>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#2A1E2C' }}>Fashion Gold</div>
          </div>
          <div style={{ fontSize: 13, color: gray }}>
            <a href="https://planodaju.julianecost.com/quiz/fashion-gold" target="_blank" rel="noopener noreferrer" style={{ color: gold, textDecoration: 'none' }}>
              planodaju.julianecost.com/quiz/fashion-gold ↗
            </a>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/quiz/configuracoes" style={{ background: '#FFFAF5', color: '#2A1E2C', padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            📸 Depoimentos
          </Link>
          <a href="https://planodaju.julianecost.com/quiz/fashion-gold" target="_blank" rel="noopener noreferrer" style={{ background: gold, color: '#fff', padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            Ver quiz ↗
          </a>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="TOTAL DE LEADS" value={kpis.total.toLocaleString('pt-BR')} sub="todos os tempos" />
        <StatCard label="HOJE" value={kpis.today} sub="desde meia-noite" color={kpis.today > 0 ? green : '#2A1E2C'} />
        <StatCard label="ESTA SEMANA" value={kpis.week} sub="últimos 7 dias" color={kpis.week > 0 ? green : '#2A1E2C'} />
        <StatCard label="CLIQUES (TOTAL)" value={kpis.views.toLocaleString('pt-BR')} sub="visitas ao quiz" />
        <StatCard
          label="CONVERSÃO HOJE"
          value={kpis.convToday != null ? `${kpis.convToday}%` : '—'}
          sub={`lead ÷ acesso · ${kpis.leadsToday}/${kpis.viewsToday} hoje · 30d: ${kpis.conv30d != null ? kpis.conv30d + '%' : '—'}`}
          color={kpis.convToday != null ? (kpis.convToday >= 15 ? green : kpis.convToday >= 5 ? accent : red) : '#2A1E2C'}
        />
      </div>

      {/* ── Funil unificado — Anúncio → Etapas do quiz → Lead ── */}
      <UnifiedFunnel rows={data.funnelUnified} metaOk={data.metaOk} hasStepData={data.stagesHaveData} />

      {/* ── Custo por lead × taxa de conversão (7 dias) ── */}
      <CostPerLeadChart series={data.cplSeries} stats={data.cplStats} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, marginBottom: 24 }}>
        {/* Gráfico de leads por dia */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#2A1E2C' }}>📈 Leads por dia</div>
            <div style={{ fontSize: 12, color: gray }}>Últimos 30 dias</div>
          </div>
          <MiniBarChart series={dailySeries} />
          <div style={{ marginTop: 16, display: 'flex', gap: 16 }}>
            <div style={{ fontSize: 12, color: gray }}>
              Total no período: <strong style={{ color: '#2A1E2C' }}>{dailySeries.reduce((s: number, d: any) => s + d.leads, 0)}</strong>
            </div>
            <div style={{ fontSize: 12, color: gray }}>
              Média/dia: <strong style={{ color: '#2A1E2C' }}>{(dailySeries.reduce((s: number, d: any) => s + d.leads, 0) / 30).toFixed(1)}</strong>
            </div>
          </div>
        </div>

        {/* UTM Breakdown */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#2A1E2C', marginBottom: 16 }}>🔍 Origem dos leads</div>
          {utmBreakdown.length === 0 ? (
            <div style={{ fontSize: 13, color: gray, textAlign: 'center', padding: '20px 0' }}>Nenhum dado de UTM ainda</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {utmBreakdown.slice(0, 6).map((u: any) => {
                const color = UTM_COLORS[u.source.toLowerCase()] ?? gray
                const pct = Math.round((u.count / totalUtm) * 100)
                return (
                  <div key={u.source}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#2A1E2C', textTransform: 'capitalize' }}>{u.source}</span>
                      <span style={{ fontSize: 12, color: gray }}>{u.count} ({pct}%)</span>
                    </div>
                    <div style={{ height: 5, background: '#F0F0F5', borderRadius: 3 }}>
                      <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Tabela de leads */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #F0F0F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#2A1E2C' }}>Leads recentes</div>
          <div style={{ fontSize: 12, color: gray }}>Últimos {leads.length} registros</div>
        </div>

        {leads.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: gray, fontSize: 14 }}>
            Nenhum lead ainda. Compartilhe o link do quiz para começar a capturar.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F0F0F5' }}>
                  {['Data', 'Nome', 'E-mail', 'WhatsApp', 'Origem', 'Campanha', 'Grupo'].map(h => (
                    <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, color: gray, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((lead: any) => (
                  <tr key={lead.id} style={{ borderBottom: '1px solid #F9F9FC' }}>
                    <td style={{ padding: '11px 20px', fontSize: 12, color: gray, whiteSpace: 'nowrap' }}>{formatDate(lead.created_at)}</td>
                    <td style={{ padding: '11px 20px', fontSize: 13, fontWeight: 600, color: '#2A1E2C' }}>{lead.name ?? <span style={{ color: gray }}>—</span>}</td>
                    <td style={{ padding: '11px 20px', fontSize: 12, color: '#2A1E2C' }}>{lead.email ?? <span style={{ color: gray }}>—</span>}</td>
                    <td style={{ padding: '11px 20px', fontSize: 12, color: '#2A1E2C', whiteSpace: 'nowrap' }}>{formatPhone(lead.phone)}</td>
                    <td style={{ padding: '11px 20px' }}>
                      {lead.utm_source ? (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: (UTM_COLORS[lead.utm_source.toLowerCase()] ?? gray) + '20', color: UTM_COLORS[lead.utm_source.toLowerCase()] ?? gray }}>
                          {lead.utm_source}
                        </span>
                      ) : <span style={{ fontSize: 11, color: gray }}>direto</span>}
                    </td>
                    <td style={{ padding: '11px 20px', fontSize: 11, color: gray, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {lead.utm_campaign ?? '—'}
                    </td>
                    <td style={{ padding: '11px 20px' }}>
                      {lead.invite_link_used ? (
                        <a href={lead.invite_link_used} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: green, textDecoration: 'none', fontWeight: 700 }}>Ver grupo ↗</a>
                      ) : (
                        <span style={{ fontSize: 11, color: gray }}>sem vaga</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dica UTM */}
      <div style={{ marginTop: 20, padding: '16px 20px', background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ fontSize: 20 }}>💡</div>
        <div style={{ fontSize: 12, color: gray, lineHeight: 1.6 }}>
          Use{' '}
          <code style={{ background: '#FFFAF5', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>
            ?utm_source=facebook&utm_medium=paid&utm_campaign=NOME_DA_CAMPANHA
          </code>{' '}
          nos seus links de anúncio para rastrear a origem de cada lead automaticamente.
        </div>
      </div>
    </div>
  )
}
