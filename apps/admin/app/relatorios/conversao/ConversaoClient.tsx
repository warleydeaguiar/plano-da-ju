'use client'

import { useMemo, useState } from 'react'
import { T, fonts } from '../../theme'

type Day = { date: string; clicks: number; sales: number; revenue: number }
type View = 'dia' | 'semana' | 'mes'
type Bucket = { key: string; label: string; clicks: number; sales: number; revenue: number }

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const brl = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const pct = (s: number, c: number) => (c > 0 ? (s / c) * 100 : null)

function mondayOf(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  const dow = d.getDay()
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow))
  return d.toISOString().slice(0, 10)
}

function bucketize(days: Day[], view: View): Bucket[] {
  const map = new Map<string, Bucket>()
  for (const d of days) {
    let key: string, label: string
    if (view === 'dia') {
      key = d.date
      label = `${d.date.slice(8, 10)}/${d.date.slice(5, 7)}`
    } else if (view === 'semana') {
      key = mondayOf(d.date)
      label = `${key.slice(8, 10)}/${key.slice(5, 7)}`
    } else {
      key = d.date.slice(0, 7)
      label = `${MESES[Number(key.slice(5, 7)) - 1]}/${key.slice(2, 4)}`
    }
    const b = map.get(key) ?? { key, label, clicks: 0, sales: 0, revenue: 0 }
    b.clicks += d.clicks; b.sales += d.sales; b.revenue += d.revenue
    map.set(key, b)
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key))
}

export default function ConversaoClient({ days, metaOk }: { days: Day[]; metaOk: boolean }) {
  const [view, setView] = useState<View>('semana')
  const buckets = useMemo(() => bucketize(days, view), [days, view])

  const totClicks = days.reduce((s, d) => s + d.clicks, 0)
  const totSales = days.reduce((s, d) => s + d.sales, 0)
  const totRev = days.reduce((s, d) => s + d.revenue, 0)
  const convMedia = pct(totSales, totClicks)
  const maxConv = Math.max(1, ...buckets.map(b => pct(b.sales, b.clicks) ?? 0))

  return (
    <div>
      <div style={{ fontSize: 26, fontWeight: 600, fontFamily: fonts.display, letterSpacing: -0.5 }}>📈 Conversão — cliques × vendas</div>
      <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 4, marginBottom: 18 }}>
        Quantos cliques do Meta Ads (plano) viram venda paga. Conversão = vendas ÷ cliques.
      </div>

      {!metaOk && (
        <div style={{ background: '#FFF7EE', border: `1px solid ${T.gold}44`, borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: T.inkSoft }}>
          ⚠️ Sem dados do Meta Ads agora (token não configurado ou API indisponível) — os cliques aparecem como 0. As vendas continuam corretas.
        </div>
      )}

      {/* Resumo */}
      <div className="dash-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
        <Stat label="Cliques (Meta)" value={totClicks.toLocaleString('pt-BR')} color={T.blue} />
        <Stat label="Vendas pagas" value={totSales.toLocaleString('pt-BR')} color={T.pinkDeep} />
        <Stat label="Conversão média" value={convMedia != null ? `${convMedia.toFixed(1).replace('.', ',')}%` : '—'} color={T.green} />
        <Stat label="Receita" value={brl(totRev)} />
      </div>

      {/* Toggle dia/semana/mês */}
      <div style={{ display: 'inline-flex', gap: 4, background: T.surface, border: `1px solid ${T.borderSoft}`, borderRadius: 12, padding: 4, marginBottom: 16 }}>
        {(['dia', 'semana', 'mes'] as View[]).map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: fonts.ui,
            padding: '8px 16px', borderRadius: 9,
            background: view === v ? T.pinkDeep : 'transparent',
            color: view === v ? '#fff' : T.inkSoft,
          }}>{v === 'dia' ? 'Por dia' : v === 'semana' ? 'Por semana' : 'Por mês'}</button>
        ))}
      </div>

      {/* Gráfico de barras — conversão % por período */}
      <div style={{ background: T.surface, border: `1px solid ${T.borderSoft}`, borderRadius: 14, padding: '20px 22px', marginBottom: 22 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 14 }}>Conversão (%) por período</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: view === 'dia' ? 3 : 8, height: 180, overflowX: 'auto', paddingBottom: 4 }}>
          {buckets.map(b => {
            const c = pct(b.sales, b.clicks)
            const h = c != null ? Math.max(3, (c / maxConv) * 150) : 0
            return (
              <div key={b.key} title={`${b.label}\nCliques: ${b.clicks}\nVendas: ${b.sales}\nConversão: ${c != null ? c.toFixed(1) + '%' : '—'}\nReceita: ${brl(b.revenue)}`}
                style={{ flex: view === 'dia' ? '0 0 14px' : 1, minWidth: view === 'dia' ? 14 : 26, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, height: '100%', justifyContent: 'flex-end' }}>
                {c != null && <div style={{ fontSize: 9.5, color: T.inkSoft, fontWeight: 700 }}>{Math.round(c)}%</div>}
                <div style={{ width: '80%', maxWidth: 34, height: h, borderRadius: '4px 4px 0 0', background: c != null ? T.pinkDeep : T.border, opacity: c != null ? 0.9 : 0.4 }} />
                <div style={{ fontSize: view === 'dia' ? 8 : 10, color: T.inkMuted, whiteSpace: 'nowrap', transform: view === 'dia' ? 'rotate(-45deg)' : 'none', transformOrigin: 'center', marginTop: view === 'dia' ? 6 : 0 }}>{b.label}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tabela detalhada */}
      <div style={{ background: T.surface, border: `1px solid ${T.borderSoft}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
            <thead>
              <tr style={{ background: '#FFF7EE', borderBottom: `1px solid ${T.borderSoft}` }}>
                {['Período', 'Cliques', 'Vendas', 'Conversão', 'Receita'].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: h === 'Período' ? 'left' : 'right', fontSize: 11, color: T.inkSoft, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...buckets].reverse().map(b => {
                const c = pct(b.sales, b.clicks)
                return (
                  <tr key={b.key} style={{ borderBottom: `1px solid #F9F9FC` }}>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600 }}>{b.label}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 13, color: T.blue }}>{b.clicks.toLocaleString('pt-BR')}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 13, color: T.pinkDeep, fontWeight: 600 }}>{b.sales.toLocaleString('pt-BR')}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: c != null && c >= 5 ? T.green : T.ink }}>{c != null ? `${c.toFixed(1).replace('.', ',')}%` : '—'}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 13, color: T.inkSoft }}>{brl(b.revenue)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: T.surface, borderRadius: 14, padding: '16px 18px', border: `1px solid ${T.borderSoft}` }}>
      <div style={{ fontSize: 11, color: T.inkSoft, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color ?? T.ink, lineHeight: 1 }}>{value}</div>
    </div>
  )
}
