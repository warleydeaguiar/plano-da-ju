'use client'

import Link from 'next/link'

const accent = '#C4607A'
const gold   = '#c9a45c'
const green  = '#34C759'
const gray   = '#8A8A8E'
const red    = '#FF3B30'

const UTM_COLORS: Record<string, string> = {
  facebook: '#1877F2', instagram: '#E1306C', google: '#4285F4',
  tiktok: '#000', email: '#6366F1', direto: gray,
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: 12, color: gray, fontWeight: 600, marginBottom: 8, letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color ?? '#2D1B2E', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: gray, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function MiniBarChart({ series }: { series: { label: string; leads: number }[] }) {
  const max = Math.max(...series.map(d => d.leads), 1)
  const show = series.slice(-30)
  const labelIndexes = new Set([0, Math.floor(show.length / 2), show.length - 1])
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 72 }}>
        {show.map((d, i) => {
          const h = Math.max(Math.round((d.leads / max) * 68), d.leads > 0 ? 3 : 0)
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
              <div title={`${d.label}: ${d.leads}`} style={{ width: '100%', height: h, background: gold, borderRadius: '2px 2px 0 0', opacity: 0.85 }} />
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
            <div style={{ fontSize: 15, fontWeight: 700, color: '#2D1B2E' }}>Fashion Gold</div>
          </div>
          <div style={{ fontSize: 13, color: gray }}>
            <a href="https://planodaju.julianecost.com/quiz/fashion-gold" target="_blank" rel="noopener noreferrer" style={{ color: gold, textDecoration: 'none' }}>
              planodaju.julianecost.com/quiz/fashion-gold ↗
            </a>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/quiz/configuracoes" style={{ background: '#F5F5F7', color: '#2D1B2E', padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
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
        <StatCard label="HOJE" value={kpis.today} sub="desde meia-noite" color={kpis.today > 0 ? green : '#2D1B2E'} />
        <StatCard label="ESTA SEMANA" value={kpis.week} sub="últimos 7 dias" color={kpis.week > 0 ? green : '#2D1B2E'} />
        <StatCard label="CLIQUES (TOTAL)" value={kpis.views.toLocaleString('pt-BR')} sub="visitas ao quiz" />
        <StatCard
          label="TAXA DE CONVERSÃO"
          value={kpis.conversion != null ? `${kpis.conversion}%` : '—'}
          sub="leads / cliques"
          color={kpis.conversion != null ? (kpis.conversion >= 15 ? green : kpis.conversion >= 5 ? accent : red) : '#2D1B2E'}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, marginBottom: 24 }}>
        {/* Gráfico de leads por dia */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#2D1B2E' }}>📈 Leads por dia</div>
            <div style={{ fontSize: 12, color: gray }}>Últimos 30 dias</div>
          </div>
          <MiniBarChart series={dailySeries} />
          <div style={{ marginTop: 16, display: 'flex', gap: 16 }}>
            <div style={{ fontSize: 12, color: gray }}>
              Total no período: <strong style={{ color: '#2D1B2E' }}>{dailySeries.reduce((s: number, d: any) => s + d.leads, 0)}</strong>
            </div>
            <div style={{ fontSize: 12, color: gray }}>
              Média/dia: <strong style={{ color: '#2D1B2E' }}>{(dailySeries.reduce((s: number, d: any) => s + d.leads, 0) / 30).toFixed(1)}</strong>
            </div>
          </div>
        </div>

        {/* UTM Breakdown */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#2D1B2E', marginBottom: 16 }}>🔍 Origem dos leads</div>
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
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#2D1B2E', textTransform: 'capitalize' }}>{u.source}</span>
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
          <div style={{ fontSize: 14, fontWeight: 700, color: '#2D1B2E' }}>Leads recentes</div>
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
                    <td style={{ padding: '11px 20px', fontSize: 13, fontWeight: 600, color: '#2D1B2E' }}>{lead.name ?? <span style={{ color: gray }}>—</span>}</td>
                    <td style={{ padding: '11px 20px', fontSize: 12, color: '#2D1B2E' }}>{lead.email ?? <span style={{ color: gray }}>—</span>}</td>
                    <td style={{ padding: '11px 20px', fontSize: 12, color: '#2D1B2E', whiteSpace: 'nowrap' }}>{formatPhone(lead.phone)}</td>
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
          <code style={{ background: '#F5F5F7', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>
            ?utm_source=facebook&utm_medium=paid&utm_campaign=NOME_DA_CAMPANHA
          </code>{' '}
          nos seus links de anúncio para rastrear a origem de cada lead automaticamente.
        </div>
      </div>
    </div>
  )
}
