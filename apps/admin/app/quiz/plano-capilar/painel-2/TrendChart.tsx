'use client'

import { useState } from 'react'

export type TrendDay = {
  date: string
  clicks: number; sessions: number; engaged: number; lead: number; sales: number; conversao: number
}
type MetricKey = 'clicks' | 'sessions' | 'engaged' | 'lead' | 'sales' | 'conversao'

const METRICS: { key: MetricKey; label: string; color: string; pct?: boolean }[] = [
  { key: 'clicks',    label: 'Cliques',   color: '#7C3AED' },
  { key: 'sessions',  label: 'Visitas',   color: '#475569' },
  { key: 'engaged',   label: 'Interagiu', color: '#2563EB' },
  { key: 'lead',      label: 'Leads',     color: '#D97706' },
  { key: 'sales',     label: 'Compras',   color: '#16A34A' },
  { key: 'conversao', label: 'Conversão', color: '#DB2777', pct: true },
]

const W = 900, H = 220, PADL = 8, PADR = 8, PADT = 10, PADB = 18
const fmtVal = (v: number, pct?: boolean) => pct ? `${v.toFixed(1).replace('.', ',')}%` : Math.round(v).toLocaleString('pt-BR')
const fmtDate = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

export default function TrendChart({ days }: { days: TrendDay[] }) {
  const [sel, setSel] = useState<MetricKey | 'all'>('all')
  const [hover, setHover] = useState<number | null>(null)

  const shown = sel === 'all' ? METRICS.filter(m => m.key !== 'conversao') : METRICS.filter(m => m.key === sel)
  const innerW = W - PADL - PADR, innerH = H - PADT - PADB
  const n = days.length
  const xAt = (i: number) => PADL + (n <= 1 ? 0 : (i / (n - 1)) * innerW)

  // Escala: no modo isolado, eixo real da métrica; no "todas", cada linha normaliza pelo próprio máximo.
  const single = sel !== 'all'
  const singleMax = single ? Math.max(1, ...days.map(d => d[sel as MetricKey])) : 1
  const yAt = (m: MetricKey, v: number) => {
    const max = single ? singleMax : Math.max(1, ...days.map(d => d[m]))
    return PADT + innerH - (v / max) * innerH
  }
  const pathFor = (m: MetricKey) => days.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(m, d[m]).toFixed(1)}`).join(' ')

  const totals = (m: MetricKey) => days.reduce((s, d) => s + d[m], 0)

  return (
    <div>
      {/* Chips — clique pra isolar uma métrica */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        <Chip label="Todas" active={sel === 'all'} color="#0F172A" onClick={() => setSel('all')} />
        {METRICS.map(m => (
          <Chip key={m.key} label={m.label} active={sel === m.key} color={m.color}
            suffix={m.pct ? undefined : totals(m.key).toLocaleString('pt-BR')}
            onClick={() => setSel(sel === m.key ? 'all' : m.key)} />
        ))}
      </div>

      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 260, display: 'block' }}
          onMouseMove={e => {
            const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
            const x = ((e.clientX - r.left) / r.width) * W
            const i = Math.round(((x - PADL) / innerW) * (n - 1))
            setHover(Math.max(0, Math.min(n - 1, i)))
          }}
          onMouseLeave={() => setHover(null)}
        >
          {[0.25, 0.5, 0.75].map(p => <line key={p} x1={PADL} x2={W - PADR} y1={PADT + innerH * p} y2={PADT + innerH * p} stroke="#F1F5F9" strokeWidth="1" />)}
          {shown.map(m => (
            <path key={m.key} d={pathFor(m.key)} fill="none" stroke={m.color} strokeWidth={single ? 2.4 : 1.6} strokeLinejoin="round" strokeLinecap="round" opacity={single ? 1 : 0.9} />
          ))}
          {/* Modo isolado: pontos + eixo Y real */}
          {single && (
            <>
              {days.map((d, i) => <circle key={i} cx={xAt(i)} cy={yAt(sel as MetricKey, d[sel as MetricKey])} r={hover === i ? 3.5 : 1.8} fill={shown[0].color} />)}
              <text x={PADL} y={PADT + 4} fontSize="10" fill="#94A3B8">{fmtVal(singleMax, shown[0].pct)}</text>
              <text x={PADL} y={PADT + innerH} fontSize="10" fill="#94A3B8">0</text>
            </>
          )}
          {/* Linha de hover */}
          {hover != null && (
            <line x1={xAt(hover)} x2={xAt(hover)} y1={PADT} y2={PADT + innerH} stroke="#CBD5E1" strokeWidth="1" strokeDasharray="3 3" />
          )}
          {/* eixo X */}
          <text x={PADL} y={H - 4} fontSize="9" fill="#94A3B8">{fmtDate(days[0]?.date ?? '')}</text>
          <text x={W / 2 - 12} y={H - 4} fontSize="9" fill="#94A3B8">{fmtDate(days[Math.floor(n / 2)]?.date ?? '')}</text>
          <text x={W - 40} y={H - 4} fontSize="9" fill="#94A3B8">{fmtDate(days[n - 1]?.date ?? '')}</text>
        </svg>

        {/* Tooltip com valores exatos */}
        {hover != null && days[hover] && (
          <div style={{
            position: 'absolute', top: 0, left: `${(xAt(hover) / W) * 100}%`, transform: 'translateX(8px)',
            background: '#0F172A', color: '#fff', borderRadius: 8, padding: '8px 10px', fontSize: 11, pointerEvents: 'none', minWidth: 120, boxShadow: '0 6px 18px rgba(0,0,0,0.2)',
          }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{fmtDate(days[hover].date)}</div>
            {(sel === 'all' ? METRICS : shown).map(m => (
              <div key={m.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ color: m.color }}>● {m.label}</span>
                <strong>{fmtVal(days[hover][m.key], m.pct)}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Chip({ label, active, color, suffix, onClick }: { label: string; active: boolean; color: string; suffix?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
      border: `1.5px solid ${active ? color : '#E5E7EB'}`, background: active ? color : '#fff',
      color: active ? '#fff' : '#475569', borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: active ? '#fff' : color }} />
      {label}{suffix ? ` · ${suffix}` : ''}
    </button>
  )
}
