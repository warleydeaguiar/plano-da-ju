'use client'

import { useEffect, useState } from 'react'
import { T, fonts, gradient } from '../theme'

type Item = { id: string; name: string | null; photoUrl: string | null; takenAt: string | null }
type Resp = { items: Item[]; page: number; pageSize: number; total: number; withPhoto: number; hasMore: boolean }

function shortDate(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  } catch {
    return ''
  }
}
function initials(name: string | null): string {
  if (!name) return '👤'
  const p = name.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '👤'
}

export default function InitialHairFeed() {
  const [page, setPage] = useState(0)
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setErr(null)
    fetch(`/api/initial-photos?page=${page}`)
      .then(async (r) => {
        const t = await r.text()
        try { return JSON.parse(t) } catch { throw new Error('invalid') }
      })
      .then((d: Resp) => { if (alive) { setData(d); setLoading(false) } })
      .catch(() => { if (alive) { setErr('Não foi possível carregar.'); setLoading(false) } })
    return () => { alive = false }
  }, [page])

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / (data?.pageSize ?? 5)))
  const items = data?.items ?? []

  return (
    <div style={{ background: T.surface, borderRadius: 18, border: `1px solid ${T.borderSoft}`, padding: 22, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>🌱 Cabelo inicial das últimas clientes</div>
          <div style={{ fontSize: 12, color: T.inkMuted, marginTop: 2 }}>Foto do onboarding das clientes mais recentes</div>
        </div>
        {data && (
          <div style={{ fontSize: 12, color: T.inkMuted }}>
            {data.withPhoto}/{total} com foto inicial
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: T.inkMuted, fontSize: 13 }}>Carregando…</div>
      ) : err ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: T.danger, fontSize: 13 }}>{err}</div>
      ) : items.length === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: T.inkMuted, fontSize: 13 }}>Nenhuma cliente ativa ainda.</div>
      ) : (
        <div className="feed-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
          {items.map((it) => (
            <div key={it.id} style={{ border: `1px solid ${T.borderSoft}`, borderRadius: 12, overflow: 'hidden', background: T.cream }}>
              {it.photoUrl ? (
                <div style={{ width: '100%', aspectRatio: '3 / 4', backgroundImage: `url(${it.photoUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
              ) : (
                <div style={{ width: '100%', aspectRatio: '3 / 4', background: gradient.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.goldDeep, fontSize: 11, fontWeight: 600, textAlign: 'center', padding: 8 }}>
                  sem foto inicial
                </div>
              )}
              <div style={{ padding: '10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: gradient.pinkToGold, color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {initials(it.name)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name ?? 'Cliente'}</div>
                  {it.takenAt && <div style={{ fontSize: 10, color: T.inkMuted }}>desde {shortDate(it.takenAt)}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {total > (data?.pageSize ?? 5) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 16 }}>
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0 || loading}
            style={{ border: `1px solid ${T.border}`, background: page === 0 ? T.cream : T.surface, color: page === 0 ? T.inkMuted : T.ink, borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: page === 0 ? 'default' : 'pointer', fontFamily: fonts.ui }}>
            ← Anterior
          </button>
          <span style={{ fontSize: 12, color: T.inkMuted }}>Página {page + 1} de {totalPages}</span>
          <button onClick={() => setPage((p) => (data?.hasMore ? p + 1 : p))} disabled={!data?.hasMore || loading}
            style={{ border: `1px solid ${T.border}`, background: !data?.hasMore ? T.cream : T.surface, color: !data?.hasMore ? T.inkMuted : T.ink, borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: !data?.hasMore ? 'default' : 'pointer', fontFamily: fonts.ui }}>
            Próxima →
          </button>
        </div>
      )}
    </div>
  )
}
