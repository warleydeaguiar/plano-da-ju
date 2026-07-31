'use client'

import { useState } from 'react'

const ACCENT = '#BE185D'
const gray = '#7C6B7E'

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  open:        { label: 'Em aberto',   color: '#D97706', bg: '#FEF3E2' },
  in_progress: { label: 'Analisando',  color: '#2563EB', bg: '#EFF6FF' },
  resolved:    { label: 'Resolvido',   color: '#16A34A', bg: '#E9F9EF' },
  dismissed:   { label: 'Descartado',  color: '#7C6B7E', bg: '#F1EDF2' },
}

const brDate = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function FeedbackList({ initial }: { initial: any[] }) {
  const [items, setItems] = useState(initial)
  const [tab, setTab] = useState<'open' | 'all' | 'bug' | 'suggestion'>('open')
  const [busy, setBusy] = useState<string | null>(null)
  const [zoom, setZoom] = useState<string | null>(null)

  const filtered = items.filter(f =>
    tab === 'open' ? f.status === 'open'
    : tab === 'bug' ? f.type === 'bug'
    : tab === 'suggestion' ? f.type === 'suggestion'
    : true)

  const setStatus = async (id: string, status: string) => {
    setBusy(id)
    try {
      const res = await fetch('/api/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (res.ok) setItems(prev => prev.map(f => f.id === id ? { ...f, status } : f))
    } finally {
      setBusy(null)
    }
  }

  const counts = {
    open: items.filter(f => f.status === 'open').length,
    all: items.length,
    bug: items.filter(f => f.type === 'bug').length,
    suggestion: items.filter(f => f.type === 'suggestion').length,
  }

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        {([['open', 'Em aberto'], ['bug', '🐞 Bugs'], ['suggestion', '💡 Sugestões'], ['all', 'Todos']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '8px 14px', borderRadius: 9, border: '1px solid ' + (tab === key ? ACCENT : '#E6DEE8'),
              background: tab === key ? ACCENT : '#fff', color: tab === key ? '#fff' : gray,
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {label} ({counts[key]})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: gray, fontSize: 14, background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)' }}>
          Nada por aqui 🎉
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(f => {
            const st = STATUS[f.status] ?? STATUS.open
            return (
              <div key={f.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '16px 18px', display: 'flex', gap: 14 }}>
                {f.screenshot_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={f.screenshot_url}
                    alt="print"
                    onClick={() => setZoom(f.screenshot_url)}
                    style={{ width: 92, height: 92, objectFit: 'cover', borderRadius: 10, border: '1px solid #EEE', cursor: 'zoom-in', flexShrink: 0 }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: f.type === 'bug' ? '#FEF2F2' : '#EFF6FF', color: f.type === 'bug' ? '#DC2626' : '#2563EB' }}>
                      {f.type === 'bug' ? '🐞 Bug' : '💡 Sugestão'}
                    </span>
                    <span style={{ fontSize: 11.5, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: st.bg, color: st.color }}>{st.label}</span>
                    <span style={{ fontSize: 12, color: gray }}>{brDate(f.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 14, color: '#2A1E2C', lineHeight: 1.55, whiteSpace: 'pre-wrap', marginBottom: 8 }}>{f.message}</div>
                  {f.page_url && (
                    <a href={f.page_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: ACCENT, textDecoration: 'none', wordBreak: 'break-all' }}>
                      🔗 {f.page_url.replace(/^https?:\/\/[^/]+/, '')}
                    </a>
                  )}
                  {f.resolution_note && (
                    <div style={{ marginTop: 8, fontSize: 12.5, color: '#16A34A', background: '#E9F9EF', padding: '6px 10px', borderRadius: 8 }}>✓ {f.resolution_note}</div>
                  )}

                  {/* Ações */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    {f.status !== 'resolved' && (
                      <button onClick={() => setStatus(f.id, 'resolved')} disabled={busy === f.id} style={btn('#16A34A')}>✓ Resolvido</button>
                    )}
                    {f.status !== 'in_progress' && f.status === 'open' && (
                      <button onClick={() => setStatus(f.id, 'in_progress')} disabled={busy === f.id} style={btn('#2563EB')}>👀 Analisando</button>
                    )}
                    {f.status !== 'dismissed' && (
                      <button onClick={() => setStatus(f.id, 'dismissed')} disabled={busy === f.id} style={btn(gray)}>Descartar</button>
                    )}
                    {(f.status === 'resolved' || f.status === 'dismissed') && (
                      <button onClick={() => setStatus(f.id, 'open')} disabled={busy === f.id} style={btn('#D97706')}>↩ Reabrir</button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Zoom do print */}
      {zoom && (
        <div onClick={() => setZoom(null)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="print" style={{ maxWidth: '95%', maxHeight: '95%', borderRadius: 10 }} />
        </div>
      )}
    </div>
  )
}

function btn(color: string): React.CSSProperties {
  return {
    padding: '7px 13px', borderRadius: 8, border: `1px solid ${color}40`,
    background: '#fff', color, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  }
}
