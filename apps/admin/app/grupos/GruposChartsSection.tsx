'use client'

import { useState, useEffect } from 'react'

type Period = 'day' | 'week' | 'month'
type DataPoint = { label: string; joins: number; leaves: number; clicks: number }

const green  = '#34C759'
const red    = '#FF3B30'
const accent = '#C4607A'
const blue   = '#007AFF'
const gray   = '#8A8A8E'

function BarChart({
  data,
  metric,
  color,
}: {
  data: DataPoint[]
  metric: 'joins' | 'leaves' | 'clicks'
  color: string
}) {
  const values = data.map(d => d[metric])
  const max = Math.max(...values, 1)

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80, paddingBottom: 0 }}>
      {data.map((d, i) => {
        const h = Math.round((d[metric] / max) * 76)
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div
              title={`${d.label}: ${d[metric]}`}
              style={{
                width: '100%', height: h, minHeight: d[metric] > 0 ? 3 : 0,
                background: color,
                borderRadius: '3px 3px 0 0',
                opacity: 0.85,
                transition: 'height 0.3s ease',
              }}
            />
          </div>
        )
      })}
    </div>
  )
}

function ChartCard({
  title,
  metric,
  color,
  data,
  period,
}: {
  title: string
  metric: 'joins' | 'leaves' | 'clicks'
  color: string
  data: DataPoint[]
  period: Period
}) {
  const values = data.map(d => d[metric])
  const total  = values.reduce((a, b) => a + b, 0)
  const avg    = data.length > 0 ? Math.round(total / data.length) : 0
  const max    = values.reduce((m, v) => Math.max(m, v), 0)
  const half   = Math.floor(data.length / 2)
  const prev   = values.slice(0, half).reduce((a, b) => a + b, 0)
  const curr   = values.slice(half).reduce((a, b) => a + b, 0)
  const delta  = prev > 0 ? Math.round(((curr - prev) / prev) * 100) : 0
  const trend  = delta > 0 ? `▲ ${delta}%` : delta < 0 ? `▼ ${Math.abs(delta)}%` : '—'
  const trendColor = delta > 0 ? (metric === 'leaves' ? red : green) : delta < 0 ? (metric === 'leaves' ? green : red) : gray
  const periodUnit = period === 'day' ? 'dia' : period === 'week' ? 'semana' : 'mês'

  // Labels: only show first, middle, last
  const labelIndexes = new Set([0, Math.floor(data.length / 2), data.length - 1])
  const labelCount = period === 'day' ? 30 : period === 'week' ? 12 : 12

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: gray, fontWeight: 600, marginBottom: 4 }}>{title}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#2D1B2E', lineHeight: 1 }}>{avg.toLocaleString('pt-BR')}</div>
            <div style={{ fontSize: 12, color: gray, fontWeight: 500 }}>/ {periodUnit} (média)</div>
          </div>
          <div style={{ fontSize: 11, color: gray, marginTop: 4 }}>
            total <strong style={{ color: '#2D1B2E' }}>{total.toLocaleString('pt-BR')}</strong>
            {max > 0 && <> · pico <strong style={{ color: '#2D1B2E' }}>{max.toLocaleString('pt-BR')}</strong></>}
          </div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: trendColor, background: trendColor + '15', padding: '3px 9px', borderRadius: 20 }}>
          {trend}
        </span>
      </div>

      <BarChart data={data} metric={metric} color={color} />

      {/* Axis labels */}
      <div style={{ display: 'flex', marginTop: 5, position: 'relative' }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            {labelIndexes.has(i) && (
              <div style={{ fontSize: 9, color: gray, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'clip' }}>
                {d.label}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function GruposChartsSection() {
  const [period, setPeriod]   = useState<Period>('day')
  const [data, setData]       = useState<DataPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/grupos/analytics?period=${period}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [period])

  const periodLabel: Record<Period, string> = {
    day:   'Últimos 30 dias',
    week:  'Últimas 12 semanas',
    month: 'Últimos 12 meses',
  }

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 24px', marginBottom: 28 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#2D1B2E' }}>📊 Atividade dos grupos</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['day', 'week', 'month'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '5px 13px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                background: period === p ? '#2D1B2E' : '#F5F5F7',
                color: period === p ? '#fff' : '#2D1B2E',
              }}
            >
              {p === 'day' ? 'Dias' : p === 'week' ? 'Semanas' : 'Meses'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 12, color: gray, marginBottom: 16 }}>{periodLabel[period]}</div>

      {loading ? (
        <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: gray, fontSize: 13 }}>
          Carregando…
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <ChartCard title="ENTRADAS NO GRUPO"  metric="joins"  color={green}  data={data} period={period} />
          <ChartCard title="SAÍDAS DO GRUPO"    metric="leaves" color={red}    data={data} period={period} />
          <ChartCard title="CLIQUES NO LINK"    metric="clicks" color={accent} data={data} period={period} />
        </div>
      )}
    </div>
  )
}
