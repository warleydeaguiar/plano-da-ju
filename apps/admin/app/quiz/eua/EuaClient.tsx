'use client'

import Link from 'next/link'

const accent = '#BE185D'
const gold = '#c9a45c'
const green = '#22A06B'
const gray = '#7C6B7E'
const blue = '#2563EB'

function Stat({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', border: '1px solid rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: 11.5, color: gray, fontWeight: 600, marginBottom: 7, letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: color ?? '#2A1E2C', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: gray, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

const usd = (c: number) => `$${(c / 100).toFixed(2)}`
const fmtDate = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function EuaClient({ data }: { data: any }) {
  const { kpis, funnel, dailySeries, leadsList } = data
  const maxLeads = Math.max(...dailySeries.map((d: { leads: number }) => d.leads), 1)

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Link href="/quiz" style={{ fontSize: 13, color: gray, textDecoration: 'none' }}>Quiz</Link>
            <span style={{ color: gray }}>›</span>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#2A1E2C' }}>🇺🇸 Brasileiras nos EUA</div>
          </div>
          <a href="https://planodaju.julianecost.com/quiz/eua" target="_blank" rel="noopener noreferrer"
             style={{ fontSize: 13, color: gold, textDecoration: 'none' }}>
            planodaju.julianecost.com/quiz/eua ↗
          </a>
        </div>
        <a href="https://planodaju.julianecost.com/quiz/eua" target="_blank" rel="noopener noreferrer"
           style={{ background: gold, color: '#fff', padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
          Ver quiz ↗
        </a>
      </div>

      <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 12, padding: '12px 16px', marginBottom: 22, fontSize: 12.5, color: '#1E40AF', lineHeight: 1.5 }}>
        Funil em <strong>dólar</strong> (US$ 9,90), cobrado pela <strong>Stripe</strong> — a PagarMe só opera em BRL.
        Métricas separadas do funil brasileiro pelo slug <code>plano-capilar-usa</code>.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 22 }}>
        <Stat label="ACESSOS (TOTAL)" value={kpis.views.toLocaleString('pt-BR')} sub={`hoje ${kpis.viewsToday} · ontem ${kpis.viewsYest}`} />
        <Stat label="LEADS (TOTAL)" value={kpis.leads.toLocaleString('pt-BR')} sub={`hoje ${kpis.leadsToday} · 7d ${kpis.leadsWeek}`} color={kpis.leads > 0 ? green : undefined} />
        <Stat label="CONVERSÃO HOJE" value={kpis.convToday != null ? `${kpis.convToday}%` : '—'} sub={`30d: ${kpis.conv30 != null ? kpis.conv30 + '%' : '—'}`} color={accent} />
        <Stat label="VENDAS (30D)" value={kpis.salesCount} sub="pagas via Stripe" color={kpis.salesCount > 0 ? green : undefined} />
        <Stat label="FATURAMENTO (30D)" value={usd(kpis.salesUsdCents)} sub="em dólar" color={blue} />
      </div>

      {/* Funil por etapa */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', marginBottom: 22, overflow: 'hidden' }}>
        <div style={{ padding: '16px 18px 6px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#2A1E2C' }}>🔎 Funil por etapa (30 dias)</div>
          <div style={{ fontSize: 11.5, color: gray, marginTop: 2 }}>Sessões únicas por etapa · % = quem avança para a seguinte.</div>
        </div>
        {funnel.length === 0 ? (
          <div style={{ padding: '28px 18px', textAlign: 'center', color: gray, fontSize: 13.5 }}>
            Ainda sem dados — as etapas aparecem conforme as visitantes passam pelo quiz.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#FFF7EE', borderBottom: '1px solid #F0EAF2' }}>
                {['Etapa', 'Sessões', 'Seguem →'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: 11, color: gray, fontWeight: 600, textTransform: 'uppercase', textAlign: h === 'Etapa' ? 'left' : 'right' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {funnel.map((f: any, i: number) => {
                const next = funnel[i + 1]
                const pct = next && f.sessions > 0 ? `${Math.round((next.sessions / f.sessions) * 100)}%` : '—'
                return (
                  <tr key={f.index} style={{ borderBottom: '1px solid #F7F2F8' }}>
                    <td style={{ padding: '10px 16px', fontSize: 13.5, fontWeight: 600, color: '#2A1E2C' }}>
                      {f.index}. {f.id}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 14, fontWeight: 700 }}>{f.sessions}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12.5, color: green, fontWeight: 600 }}>{pct}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Leads por dia */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 24px', marginBottom: 22 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#2A1E2C', marginBottom: 16 }}>📈 Leads por dia (30 dias)</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {dailySeries.map((d: any, i: number) => (
            <div key={i} title={`${d.label}: ${d.leads} lead(s)`} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
              <div style={{ height: Math.max((d.leads / maxLeads) * 74, d.leads > 0 ? 3 : 0), background: gold, borderRadius: '2px 2px 0 0' }} />
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11.5, color: gray, marginTop: 8 }}>
          Total no período: <strong style={{ color: '#2A1E2C' }}>{dailySeries.reduce((s: number, d: { leads: number }) => s + d.leads, 0)}</strong>
        </div>
      </div>

      {/* Leads recentes */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)' }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid #F0F0F5', fontSize: 14, fontWeight: 700, color: '#2A1E2C' }}>
          Leads recentes
        </div>
        {leadsList.length === 0 ? (
          <div style={{ padding: '40px 22px', textAlign: 'center', color: gray, fontSize: 13.5 }}>
            Nenhum lead ainda. Divulgue o link do quiz EUA para começar.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F0F0F5' }}>
                  {['Data', 'Nome', 'E-mail', 'Origem'].map(h => (
                    <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, color: gray, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {leadsList.map((l: any) => (
                  <tr key={l.id} style={{ borderBottom: '1px solid #F9F9FC' }}>
                    <td style={{ padding: '10px 20px', fontSize: 12, color: gray, whiteSpace: 'nowrap' }}>{fmtDate(l.created_at)}</td>
                    <td style={{ padding: '10px 20px', fontSize: 13, fontWeight: 600 }}>{l.name ?? '—'}</td>
                    <td style={{ padding: '10px 20px', fontSize: 12 }}>{l.email ?? '—'}</td>
                    <td style={{ padding: '10px 20px', fontSize: 11.5, color: gray }}>{l.utm_source ?? 'direto'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
