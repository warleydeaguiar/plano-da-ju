'use client'

import { useEffect, useState, useCallback } from 'react'
import { T, fonts, gradient } from '../../theme'

type Item = { id: string; name: string | null; photoUrl: string | null; hairType: string | null; takenAt: string | null }
type Resp = { items: Item[]; page: number; total: number; hasMore: boolean }

function initials(name: string | null): string {
  if (!name) return '👤'
  const p = name.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '👤'
}
function fmtDate(iso: string | null): string {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' }) }
  catch { return '' }
}

export default function GaleriaClient() {
  const [items, setItems] = useState<Item[]>([])
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [zoom, setZoom] = useState<Item | null>(null)

  const load = useCallback(async (p: number) => {
    setLoading(true); setErr(null)
    try {
      const r = await fetch(`/api/initial-photos/gallery?page=${p}`)
      const d: Resp = await r.json()
      setItems(prev => p === 0 ? d.items : [...prev, ...d.items])
      setTotal(d.total); setHasMore(d.hasMore); setPage(d.page)
    } catch { setErr('Não consegui carregar a galeria.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load(0) }, [load])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, fontFamily: fonts.display, color: T.ink }}>🌱 Galeria — Cabelo inicial</div>
          <div style={{ fontSize: 13.5, color: T.inkSoft, marginTop: 4 }}>
            Todas as clientes que enviaram a foto do cabelo no começo.
          </div>
        </div>
        <div style={{ fontSize: 13, color: T.inkSoft, fontWeight: 600 }}>
          {total > 0 ? `${total} cliente${total !== 1 ? 's' : ''} com foto` : ''}
        </div>
      </div>

      {err && <div style={{ padding: 16, background: '#FDECEC', color: T.danger, borderRadius: 12, fontWeight: 600 }}>{err}</div>}

      {!err && total === 0 && !loading && (
        <div style={{ padding: 28, textAlign: 'center', color: T.inkSoft }}>Nenhuma cliente enviou foto ainda.</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
        {items.map(it => (
          <button
            key={it.id}
            onClick={() => it.photoUrl && setZoom(it)}
            style={{
              padding: 0, border: `1px solid ${T.borderSoft}`, borderRadius: 14, overflow: 'hidden',
              background: T.surface, cursor: it.photoUrl ? 'zoom-in' : 'default', textAlign: 'left',
              boxShadow: '0 1px 3px rgba(42,30,44,0.06)',
            }}
          >
            {it.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.photoUrl} alt={it.name ?? 'cliente'} loading="lazy"
                style={{ width: '100%', aspectRatio: '3 / 4', objectFit: 'cover', display: 'block', background: T.cream }} />
            ) : (
              <div style={{ width: '100%', aspectRatio: '3 / 4', background: gradient.gold }} />
            )}
            <div style={{ padding: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: gradient.pinkToGold, color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {initials(it.name)}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: T.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name ?? 'Cliente'}</div>
                <div style={{ fontSize: 11, color: T.inkMuted }}>{fmtDate(it.takenAt)}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {loading && <div style={{ padding: 20, textAlign: 'center', color: T.inkSoft }}>Carregando…</div>}

      {hasMore && !loading && (
        <div style={{ textAlign: 'center', marginTop: 22 }}>
          <button onClick={() => load(page + 1)} style={{
            background: T.pinkDeep, color: '#fff', border: 'none', borderRadius: 10,
            padding: '11px 26px', fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}>Carregar mais</button>
        </div>
      )}

      {/* Lightbox */}
      {zoom && (
        <div onClick={() => setZoom(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out',
        }}>
          <div style={{ maxWidth: 480, maxHeight: '92vh', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={zoom.photoUrl!} alt={zoom.name ?? ''} style={{ maxWidth: '100%', maxHeight: '82vh', objectFit: 'contain', borderRadius: 12 }} />
            <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>
              {zoom.name ?? 'Cliente'}{zoom.hairType ? ` · ${zoom.hairType}` : ''}{zoom.takenAt ? ` · ${fmtDate(zoom.takenAt)}` : ''}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
