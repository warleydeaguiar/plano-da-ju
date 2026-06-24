'use client'

import { useEffect, useState, useCallback } from 'react'
import { T, fonts, gradient } from '../../theme'

type Item = {
  id: string; name: string | null; photoUrl: string | null; isInitial: boolean; takenAt: string | null;
  scores: { frizz: number | null; brilho: number | null; hidratacao: number | null; pontas: number | null }
}
type Resp = { items: Item[]; page: number; total: number; hasMore: boolean }

function initials(name: string | null): string {
  if (!name) return '👤'
  const p = name.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '👤'
}
function fmtDate(iso: string | null): string {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) } catch { return '' }
}

export default function ProgressoClient() {
  const [data, setData] = useState<Resp | null>(null)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [zoom, setZoom] = useState<Item | null>(null)

  const load = useCallback(async (p: number) => {
    setLoading(true); setErr(null)
    try {
      const r = await fetch(`/api/progress-photos?page=${p}`)
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'erro')
      setData(d)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro ao carregar') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load(page) }, [page, load])

  const items = data?.items ?? []
  const totalPages = data ? Math.max(1, Math.ceil(data.total / 24)) : 1

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: 26, fontWeight: 600, fontFamily: fonts.display, letterSpacing: -0.5 }}>📈 Fotos de progresso</div>
        {data && <div style={{ fontSize: 12, color: T.inkMuted }}>{data.total} fotos de evolução</div>}
      </div>
      <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 18 }}>Fotos de evolução enviadas pelas alunas (a inicial fica na “Galeria de fotos”).</div>

      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: T.inkMuted }}>Carregando…</div>
      ) : err ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: T.danger }}>{err}</div>
      ) : items.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: T.inkMuted }}>Nenhuma foto de progresso ainda.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14 }}>
          {items.map(it => (
            <button key={it.id} onClick={() => it.photoUrl && setZoom(it)} style={{
              border: `1px solid ${T.borderSoft}`, borderRadius: 14, overflow: 'hidden', padding: 0,
              background: T.surface, cursor: it.photoUrl ? 'zoom-in' : 'default', textAlign: 'left',
            }}>
              {it.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.photoUrl} alt={it.name ?? ''} loading="lazy" style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', display: 'block' }} />
              ) : (
                <div style={{ width: '100%', aspectRatio: '3/4', background: gradient.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.goldDeep, fontSize: 11 }}>sem foto</div>
              )}
              <div style={{ padding: '8px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: gradient.pinkToGold, color: '#fff', fontSize: 9.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initials(it.name)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name ?? 'Aluna'}</div>
                    <div style={{ fontSize: 10, color: T.inkMuted }}>{fmtDate(it.takenAt)}{it.isInitial ? ' · inicial' : ''}</div>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {data && data.total > 24 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 20 }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0 || loading}
            style={{ border: `1px solid ${T.border}`, background: page === 0 ? T.cream : T.surface, color: page === 0 ? T.inkMuted : T.ink, borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: page === 0 ? 'default' : 'pointer', fontFamily: fonts.ui }}>← Anterior</button>
          <span style={{ fontSize: 12, color: T.inkMuted }}>Página {page + 1} de {totalPages}</span>
          <button onClick={() => setPage(p => (data.hasMore ? p + 1 : p))} disabled={!data.hasMore || loading}
            style={{ border: `1px solid ${T.border}`, background: !data.hasMore ? T.cream : T.surface, color: !data.hasMore ? T.inkMuted : T.ink, borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: !data.hasMore ? 'default' : 'pointer', fontFamily: fonts.ui }}>Próxima →</button>
        </div>
      )}

      {zoom && (
        <div onClick={() => setZoom(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out' }}>
          <div style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={zoom.photoUrl!} alt={zoom.name ?? ''} style={{ maxWidth: '100%', maxHeight: '82vh', objectFit: 'contain', borderRadius: 12 }} />
            <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{zoom.name ?? 'Aluna'} · {fmtDate(zoom.takenAt)}</div>
          </div>
        </div>
      )}
    </div>
  )
}
