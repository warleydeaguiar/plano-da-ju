'use client'

import { useEffect, useState } from 'react'
import { T, fonts, gradient } from '../theme'

type Item = {
  id: string
  photoUrl: string
  name: string | null
  analyzedAt: string
  scores: {
    brilho: number | null
    hidratacao: number | null
    frizz: number | null
    pontas: number | null
    crescimento: number | null
  }
  texto: string | null
}

type Resp = { items: Item[]; page: number; pageSize: number; total: number; hasMore: boolean }

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `há ${hr}h`
  const d = Math.floor(hr / 24)
  return `há ${d} ${d === 1 ? 'dia' : 'dias'}`
}

function initials(name: string | null): string {
  if (!name) return '👤'
  const p = name.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '👤'
}

function Score({ label, value }: { label: string; value: number | null }) {
  if (value === null || value === undefined) return null
  return (
    <span
      style={{
        fontSize: 11,
        color: T.inkSoft,
        background: T.cream,
        borderRadius: 6,
        padding: '2px 7px',
        whiteSpace: 'nowrap',
      }}
    >
      {label} <b style={{ color: T.ink }}>{Number(value).toFixed(label === 'Cresc.' ? 1 : 0)}{label === 'Cresc.' ? 'cm' : ''}</b>
    </span>
  )
}

export default function ProgressFeed() {
  const [page, setPage] = useState(0)
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setErr(null)
    fetch(`/api/checkins?page=${page}`)
      .then(async (r) => {
        const txt = await r.text()
        try {
          return JSON.parse(txt)
        } catch {
          throw new Error('resposta inválida')
        }
      })
      .then((d: Resp) => {
        if (!alive) return
        setData(d)
        setLoading(false)
      })
      .catch(() => {
        if (!alive) return
        setErr('Não foi possível carregar os check-ins.')
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [page])

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / (data?.pageSize ?? 5)))
  const items = data?.items ?? []

  return (
    <div
      style={{
        background: T.surface,
        borderRadius: 18,
        border: `1px solid ${T.borderSoft}`,
        padding: 22,
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>📸 Fotos de progresso das clientes</div>
          <div style={{ fontSize: 12, color: T.inkMuted, marginTop: 2 }}>
            Check-ins adicionados na seção de progresso do app
          </div>
        </div>
        {total > 0 && (
          <div style={{ fontSize: 12, color: T.inkMuted }}>
            {total} {total === 1 ? 'check-in' : 'check-ins'}
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: T.inkMuted, fontSize: 13 }}>Carregando…</div>
      ) : err ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: T.danger, fontSize: 13 }}>{err}</div>
      ) : items.length === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: T.inkMuted, fontSize: 13 }}>
          Nenhuma foto de progresso ainda.
        </div>
      ) : (
        <div className="feed-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
          {items.map((it) => (
            <div
              key={it.id}
              style={{
                border: `1px solid ${T.borderSoft}`,
                borderRadius: 12,
                overflow: 'hidden',
                background: T.cream,
              }}
            >
              <div
                style={{
                  width: '100%',
                  aspectRatio: '3 / 4',
                  background: `${gradient.heroSoft}`,
                  backgroundImage: `url(${it.photoUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              <div style={{ padding: '10px 10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: gradient.pinkToGold,
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {initials(it.name)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: T.ink,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {it.name ?? 'Cliente'}
                    </div>
                    <div style={{ fontSize: 10, color: T.inkMuted }}>{relTime(it.analyzedAt)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  <Score label="Brilho" value={it.scores.brilho} />
                  <Score label="Hidr." value={it.scores.hidratacao} />
                  <Score label="Frizz" value={it.scores.frizz} />
                  <Score label="Pontas" value={it.scores.pontas} />
                  <Score label="Cresc." value={it.scores.crescimento} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {total > (data?.pageSize ?? 5) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 16 }}>
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || loading}
            style={{
              border: `1px solid ${T.border}`,
              background: page === 0 ? T.cream : T.surface,
              color: page === 0 ? T.inkMuted : T.ink,
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: 13,
              cursor: page === 0 ? 'default' : 'pointer',
              fontFamily: fonts.ui,
            }}
          >
            ← Anterior
          </button>
          <span style={{ fontSize: 12, color: T.inkMuted }}>
            Página {page + 1} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => (data?.hasMore ? p + 1 : p))}
            disabled={!data?.hasMore || loading}
            style={{
              border: `1px solid ${T.border}`,
              background: !data?.hasMore ? T.cream : T.surface,
              color: !data?.hasMore ? T.inkMuted : T.ink,
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: 13,
              cursor: !data?.hasMore ? 'default' : 'pointer',
              fontFamily: fonts.ui,
            }}
          >
            Próxima →
          </button>
        </div>
      )}
    </div>
  )
}
