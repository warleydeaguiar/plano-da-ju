'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'

const accent = '#C4607A'
const green  = '#34C759'
const orange = '#FF9500'
const red    = '#FF3B30'
const gray   = '#8A8A8E'
const blue   = '#007AFF'

type ImageSlot = {
  id: string
  key: string
  section: string
  label: string
  description: string | null
  url: string
  sort_order: number
  type: 'image' | 'video'
  updated_at: string
}

const SECTION_LABELS: Record<string, { title: string; subtitle: string; color: string; emoji: string }> = {
  plano_capilar: {
    title: 'Quiz Plano Capilar',
    subtitle: 'Imagens que aparecem ao longo do quiz principal',
    color: '#8B3A6E',
    emoji: '🎯',
  },
  oferta: {
    title: 'Página de Oferta',
    subtitle: 'Imagens da página de oferta após o quiz',
    color: '#22C55E',
    emoji: '🛒',
  },
}

function ImageCard({ slot, onUpdate }: { slot: ImageSlot; onUpdate: (s: ImageSlot) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [urlInput, setUrlInput] = useState(slot.url)
  const [editing, setEditing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [imgError, setImgError] = useState(false)

  const isVideo = slot.type === 'video'

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setProgress('Enviando…')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('key', slot.key)
      const res = await fetch('/api/quiz/images/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onUpdate({ ...slot, url: data.url, updated_at: new Date().toISOString() })
      setUrlInput(data.url)
      setImgError(false)
      setProgress('✓ Imagem atualizada!')
      setTimeout(() => setProgress(null), 2200)
    } catch (err: any) {
      setProgress('✗ Erro: ' + err.message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function saveUrl() {
    if (!urlInput.trim() || urlInput === slot.url) {
      setEditing(false)
      return
    }
    setUploading(true)
    setProgress('Salvando…')
    try {
      const res = await fetch('/api/quiz/images', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: slot.key, url: urlInput.trim() }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error)
      }
      onUpdate({ ...slot, url: urlInput.trim(), updated_at: new Date().toISOString() })
      setImgError(false)
      setProgress('✓ URL atualizada!')
      setTimeout(() => setProgress(null), 2200)
      setEditing(false)
    } catch (err: any) {
      setProgress('✗ Erro: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{
      background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 14,
      padding: 18, display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#2D1B2E', marginBottom: 4 }}>
          {slot.label}
        </div>
        {slot.description && (
          <div style={{ fontSize: 12, color: gray, lineHeight: 1.4 }}>
            {slot.description}
          </div>
        )}
      </div>

      {/* Preview */}
      <div style={{
        width: '100%', aspectRatio: isVideo ? '16/9' : '4/3',
        background: '#F5F5F7', borderRadius: 10, overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '1px solid rgba(0,0,0,0.04)',
      }}>
        {isVideo ? (
          <div style={{ textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: 36, marginBottom: 6 }}>🎥</div>
            <div style={{ fontSize: 11, color: gray, wordBreak: 'break-all', lineHeight: 1.4 }}>
              {slot.url || 'Sem URL'}
            </div>
          </div>
        ) : slot.url && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slot.url}
            alt={slot.label}
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ fontSize: 12, color: gray, textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>🖼</div>
            {imgError ? 'Erro ao carregar imagem' : 'Sem imagem'}
          </div>
        )}
      </div>

      {/* URL atual / editor */}
      {!editing ? (
        <div>
          <div style={{ fontSize: 11, color: gray, marginBottom: 4, fontWeight: 600 }}>URL ATUAL</div>
          <div style={{
            fontSize: 11, color: '#2D1B2E', background: '#F9F9FC', padding: '8px 10px',
            borderRadius: 8, wordBreak: 'break-all', fontFamily: 'monospace', maxHeight: 50,
            overflow: 'hidden',
          }}>
            {slot.url || '—'}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 11, color: gray, marginBottom: 4, fontWeight: 600 }}>NOVA URL</div>
          <input
            type="text"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            placeholder="https://..."
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 12,
              border: '1px solid #E0E0E8', outline: 'none', boxSizing: 'border-box',
              fontFamily: 'monospace',
            }}
          />
        </div>
      )}

      {progress && (
        <div style={{
          fontSize: 12, fontWeight: 600,
          color: progress.startsWith('✗') ? red : progress.startsWith('✓') ? green : accent,
        }}>
          {progress}
        </div>
      )}

      {/* Ações */}
      <div style={{ display: 'flex', gap: 8 }}>
        {!isVideo && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{
                flex: 1, background: accent, color: '#fff', border: 'none',
                padding: '9px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                cursor: uploading ? 'default' : 'pointer', opacity: uploading ? 0.6 : 1,
              }}
            >
              📤 Upload
            </button>
          </>
        )}
        {editing ? (
          <>
            <button
              onClick={saveUrl}
              disabled={uploading}
              style={{
                flex: 1, background: green, color: '#fff', border: 'none',
                padding: '9px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                cursor: uploading ? 'default' : 'pointer', opacity: uploading ? 0.6 : 1,
              }}
            >
              ✓ Salvar
            </button>
            <button
              onClick={() => { setUrlInput(slot.url); setEditing(false) }}
              style={{
                background: '#F5F5F7', color: '#2D1B2E', border: 'none',
                padding: '9px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
          </>
        ) : (
          <button
            onClick={() => setEditing(true)}
            style={{
              flex: !isVideo ? 'unset' : 1,
              background: '#F5F5F7', color: '#2D1B2E', border: 'none',
              padding: '9px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            🔗 {isVideo ? 'Editar URL do vídeo' : 'Usar URL'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function ImagensClient({ initialData }: { initialData: ImageSlot[] }) {
  const [slots, setSlots] = useState<ImageSlot[]>(initialData)

  function updateSlot(updated: ImageSlot) {
    setSlots(prev => prev.map(s => s.key === updated.key ? updated : s))
  }

  // Agrupa por section
  const sections: Record<string, ImageSlot[]> = {}
  for (const s of slots) {
    if (!sections[s.section]) sections[s.section] = []
    sections[s.section].push(s)
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Link href="/quiz" style={{ fontSize: 13, color: gray, textDecoration: 'none' }}>Quiz</Link>
          <span style={{ color: gray }}>›</span>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#2D1B2E' }}>Imagens & Mídia</div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#2D1B2E', marginBottom: 4 }}>
          🖼 Imagens & Mídia do Funil
        </div>
        <div style={{ fontSize: 14, color: gray }}>
          Edite as fotos de depoimentos, da Juliane e o vídeo do quiz. As mudanças aparecem imediatamente em produção.
        </div>
      </div>

      {/* Sections */}
      {Object.entries(sections).map(([sectionKey, sectionSlots]) => {
        const meta = SECTION_LABELS[sectionKey] ?? { title: sectionKey, subtitle: '', color: gray, emoji: '📁' }
        return (
          <div key={sectionKey} style={{ marginBottom: 36 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
              paddingBottom: 12, borderBottom: '1px solid #F0F0F5',
            }}>
              <div style={{ fontSize: 20 }}>{meta.emoji}</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: meta.color }}>{meta.title}</div>
                <div style={{ fontSize: 12, color: gray, marginTop: 2 }}>{meta.subtitle}</div>
              </div>
              <span style={{
                marginLeft: 'auto', fontSize: 11, fontWeight: 700,
                background: meta.color + '15', color: meta.color,
                padding: '3px 10px', borderRadius: 20,
              }}>
                {sectionSlots.length} {sectionSlots.length === 1 ? 'item' : 'itens'}
              </span>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16,
            }}>
              {sectionSlots.map(slot => (
                <ImageCard key={slot.key} slot={slot} onUpdate={updateSlot} />
              ))}
            </div>
          </div>
        )
      })}

      {/* Info box */}
      <div style={{
        marginTop: 8, padding: '18px 22px', background: '#fff', borderRadius: 14,
        border: '1px solid rgba(0,0,0,0.06)', display: 'flex', gap: 14, alignItems: 'flex-start',
      }}>
        <div style={{ fontSize: 22 }}>💡</div>
        <div style={{ fontSize: 13, color: gray, lineHeight: 1.6 }}>
          <strong style={{ color: '#2D1B2E' }}>Upload</strong> sobe sua imagem para o Supabase Storage (público).{' '}
          <strong style={{ color: '#2D1B2E' }}>Usar URL</strong> permite colar uma URL pronta de qualquer lugar.{' '}
          As imagens são <strong style={{ color: '#2D1B2E' }}>cacheadas por 1 minuto</strong>, então pode levar até 1 min para aparecer no quiz e na oferta.
        </div>
      </div>
    </div>
  )
}
