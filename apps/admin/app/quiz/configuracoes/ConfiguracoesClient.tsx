'use client'

import { useState } from 'react'
import Link from 'next/link'

type Testimonial = {
  id: string
  quiz_slug: string
  type: 'review' | 'toast' | 'winner'
  sort_order: number
  name: string
  city: string | null
  stars: number
  text: string | null
  photo_url: string | null
  is_active: boolean
}

const accent = '#C4607A'
const green  = '#34C759'
const gray   = '#8A8A8E'
const orange = '#FF9500'

const TYPE_LABELS: Record<string, string> = {
  review:  '⭐ Depoimentos (Etapa 4)',
  toast:   '🔔 Notificações de entrada (Etapa 1)',
  winner:  '🏆 Último ganhador (Etapa 3)',
}

function Avatar({ url, name, size = 44 }: { url: string | null; name: string; size?: number }) {
  const [error, setError] = useState(false)
  if (url && !error) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url} alt={name} onError={() => setError(true)}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid #F0F0F5' }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: '#E5E5EA', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 700, color: gray,
    }}>{name[0]}</div>
  )
}

type EditState = Partial<Testimonial> & { id: string }

export default function ConfiguracoesClient({ initialData }: { initialData: Testimonial[] }) {
  const [items, setItems] = useState<Testimonial[]>(initialData)
  const [editing, setEditing] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState<{ type: string } | null>(null)
  const [newItem, setNewItem] = useState<Partial<Testimonial>>({})
  const [savingNew, setSavingNew] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Group by type
  const grouped = items.reduce<Record<string, Testimonial[]>>((acc, t) => {
    ;(acc[t.type] ??= []).push(t)
    return acc
  }, {})

  async function saveEdit() {
    if (!editing) return
    setSaving(true)
    try {
      const res = await fetch('/api/quiz/testimonials', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const updated = await res.json()
      setItems(prev => prev.map(x => x.id === updated.id ? updated : x))
      setEditing(null)
    } catch (err: any) {
      alert('Erro: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function saveNew() {
    if (!adding) return
    setSavingNew(true)
    try {
      const res = await fetch('/api/quiz/testimonials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newItem, type: adding.type, quiz_slug: 'fashion-gold', is_active: true }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const created = await res.json()
      setItems(prev => [...prev, created])
      setAdding(null)
      setNewItem({})
    } catch (err: any) {
      alert('Erro: ' + err.message)
    } finally {
      setSavingNew(false)
    }
  }

  async function toggleActive(item: Testimonial) {
    const res = await fetch('/api/quiz/testimonials', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, is_active: !item.is_active }),
    })
    if (res.ok) {
      setItems(prev => prev.map(x => x.id === item.id ? { ...x, is_active: !item.is_active } : x))
    }
  }

  async function deleteItem(id: string) {
    const res = await fetch(`/api/quiz/testimonials?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setItems(prev => prev.filter(x => x.id !== id))
      setDeleteConfirm(null)
    }
  }

  function EditModal({ t }: { t: EditState }) {
    const isReview = t.type === 'review'
    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }} onClick={e => { if (e.target === e.currentTarget) setEditing(null) }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#2D1B2E', marginBottom: 24 }}>
            Editar · {t.type === 'review' ? 'Depoimento' : t.type === 'toast' ? 'Notificação' : 'Ganhador'}
          </div>

          <div style={{ display: 'flex', gap: 16, marginBottom: 24, alignItems: 'center' }}>
            <Avatar url={t.photo_url ?? null} name={t.name ?? '?'} size={64} />
            <div style={{ flex: 1 }}>
              <FieldInput label="URL da foto" value={t.photo_url ?? ''} onChange={v => setEditing(e => e && ({ ...e, photo_url: v || null }))} placeholder="https://..." />
              <div style={{ fontSize: 11, color: gray, marginTop: 4 }}>
                Dica: use <a href="https://randomuser.me/photos" target="_blank" rel="noopener noreferrer" style={{ color: accent }}>randomuser.me</a> para fotos reais ou cole qualquer URL de imagem
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}><FieldInput label="Nome" value={t.name ?? ''} onChange={v => setEditing(e => e && ({ ...e, name: v }))} placeholder="Juliana M." /></div>
            <div style={{ flex: 1 }}><FieldInput label="Cidade" value={t.city ?? ''} onChange={v => setEditing(e => e && ({ ...e, city: v || null }))} placeholder="São Paulo/SP" /></div>
          </div>

          {isReview && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#2D1B2E' }}>Depoimento</div>
              <textarea
                value={t.text ?? ''}
                onChange={e => setEditing(prev => prev && ({ ...prev, text: e.target.value || null }))}
                rows={4}
                placeholder="Escreva o depoimento..."
                style={{
                  width: '100%', border: '1.5px solid #E5E5EA', borderRadius: 12, padding: '10px 14px',
                  fontFamily: 'inherit', fontSize: 14, color: '#2D1B2E', resize: 'vertical',
                  outline: 'none', boxSizing: 'border-box', background: '#fff',
                }}
              />
            </div>
          )}

          <div style={{ marginBottom: 24 }}>
            <FieldInput label="Ordem" value={String(t.sort_order ?? 0)} onChange={v => setEditing(e => e && ({ ...e, sort_order: parseInt(v) || 0 }))} placeholder="1" type="number" />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={saveEdit} disabled={saving} style={{
              flex: 1, height: 48, borderRadius: 12, border: 'none', background: accent, color: '#fff',
              fontWeight: 600, fontSize: 15, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1,
            }}>{saving ? 'Salvando…' : 'Salvar'}</button>
            <button onClick={() => setEditing(null)} style={{
              height: 48, borderRadius: 12, border: '1.5px solid #E5E5EA', background: '#fff',
              color: gray, fontWeight: 600, fontSize: 14, padding: '0 20px', cursor: 'pointer',
            }}>Cancelar</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Link href="/quiz" style={{ fontSize: 13, color: gray, textDecoration: 'none' }}>← Quiz</Link>
            <span style={{ color: gray, fontSize: 13 }}>/</span>
            <span style={{ fontSize: 13, color: '#2D1B2E', fontWeight: 600 }}>Depoimentos & Fotos</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#2D1B2E' }}>📸 Depoimentos & Fotos</div>
          <div style={{ fontSize: 14, color: gray, marginTop: 4 }}>Edite fotos, textos e nomes que aparecem no quiz</div>
        </div>
      </div>

      {/* Groups */}
      {(['review', 'toast', 'winner'] as const).map(type => {
        const list = grouped[type] ?? []
        return (
          <div key={type} style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#2D1B2E' }}>{TYPE_LABELS[type]}</div>
              {type !== 'winner' && (
                <button
                  onClick={() => { setAdding({ type }); setNewItem({ sort_order: list.length + 1 }) }}
                  style={{
                    background: '#F5F5F7', border: 'none', borderRadius: 8, padding: '6px 14px',
                    fontSize: 12, fontWeight: 600, color: '#2D1B2E', cursor: 'pointer',
                  }}
                >+ Adicionar</button>
              )}
            </div>

            {/* Add new form inline */}
            {adding?.type === type && (
              <div style={{
                background: '#F9F9FC', borderRadius: 14, border: '1.5px dashed #C4607A40',
                padding: 20, marginBottom: 12,
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: accent, marginBottom: 16 }}>Nova entrada</div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
                  <Avatar url={newItem.photo_url ?? null} name={newItem.name ?? '?'} size={48} />
                  <div style={{ flex: 1 }}>
                    <FieldInput label="URL da foto" value={newItem.photo_url ?? ''} onChange={v => setNewItem(p => ({ ...p, photo_url: v || null }))} placeholder="https://randomuser.me/api/portraits/women/1.jpg" />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}><FieldInput label="Nome" value={newItem.name ?? ''} onChange={v => setNewItem(p => ({ ...p, name: v }))} placeholder="Nome" /></div>
                  <div style={{ flex: 1 }}><FieldInput label="Cidade" value={newItem.city ?? ''} onChange={v => setNewItem(p => ({ ...p, city: v }))} placeholder="Cidade/UF" /></div>
                </div>
                {type === 'review' && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#2D1B2E' }}>Depoimento</div>
                    <textarea
                      value={newItem.text ?? ''}
                      onChange={e => setNewItem(p => ({ ...p, text: e.target.value }))}
                      rows={3}
                      placeholder="Depoimento..."
                      style={{
                        width: '100%', border: '1.5px solid #E5E5EA', borderRadius: 12, padding: '10px 14px',
                        fontFamily: 'inherit', fontSize: 14, resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={saveNew} disabled={savingNew || !newItem.name} style={{
                    background: accent, color: '#fff', border: 'none', borderRadius: 10,
                    padding: '8px 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                    opacity: !newItem.name ? 0.5 : 1,
                  }}>{savingNew ? 'Salvando…' : 'Salvar'}</button>
                  <button onClick={() => { setAdding(null); setNewItem({}) }} style={{
                    background: '#fff', color: gray, border: '1.5px solid #E5E5EA',
                    borderRadius: 10, padding: '8px 16px', fontSize: 13, cursor: 'pointer',
                  }}>Cancelar</button>
                </div>
              </div>
            )}

            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              {list.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: gray, fontSize: 13 }}>Nenhuma entrada. Clique em + Adicionar.</div>
              ) : (
                list.map((item, i) => (
                  <div key={item.id} style={{
                    padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14,
                    borderBottom: i < list.length - 1 ? '1px solid #F0F0F5' : 'none',
                    opacity: item.is_active ? 1 : 0.5,
                  }}>
                    <Avatar url={item.photo_url} name={item.name} size={44} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#2D1B2E' }}>{item.name}</div>
                      {item.city && <div style={{ fontSize: 12, color: gray }}>{item.city}</div>}
                      {item.text && (
                        <div style={{ fontSize: 12, color: '#2D1B2E', marginTop: 4, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          "{item.text}"
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button
                        onClick={() => toggleActive(item)}
                        title={item.is_active ? 'Desativar' : 'Ativar'}
                        style={{
                          background: item.is_active ? green + '18' : '#F5F5F7',
                          color: item.is_active ? green : gray,
                          border: 'none', borderRadius: 8, padding: '5px 10px',
                          fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        }}
                      >{item.is_active ? '✓ Ativo' : 'Inativo'}</button>
                      <button
                        onClick={() => setEditing({ ...item })}
                        style={{
                          background: '#F5F5F7', border: 'none', borderRadius: 8,
                          padding: '5px 12px', fontSize: 12, fontWeight: 600,
                          color: '#2D1B2E', cursor: 'pointer',
                        }}
                      >✏️ Editar</button>
                      <button
                        onClick={() => setDeleteConfirm(item.id)}
                        style={{
                          background: '#FFF0F0', border: 'none', borderRadius: 8,
                          padding: '5px 10px', fontSize: 12, color: '#FF3B30', cursor: 'pointer',
                        }}
                      >🗑</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )
      })}

      {/* Edit modal */}
      {editing && <EditModal t={editing} />}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 360, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: '#2D1B2E' }}>Excluir este item?</div>
            <div style={{ fontSize: 13, color: gray, marginBottom: 24 }}>Esta ação não pode ser desfeita.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => deleteItem(deleteConfirm)} style={{
                flex: 1, height: 44, borderRadius: 10, border: 'none', background: '#FF3B30',
                color: '#fff', fontWeight: 600, cursor: 'pointer',
              }}>Excluir</button>
              <button onClick={() => setDeleteConfirm(null)} style={{
                flex: 1, height: 44, borderRadius: 10, border: '1.5px solid #E5E5EA',
                background: '#fff', color: gray, fontWeight: 600, cursor: 'pointer',
              }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FieldInput({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#2D1B2E', marginBottom: 5, letterSpacing: 0.2 }}>{label}</div>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', height: 40, border: '1.5px solid #E5E5EA', borderRadius: 10,
          padding: '0 12px', fontFamily: 'inherit', fontSize: 13, color: '#2D1B2E',
          outline: 'none', boxSizing: 'border-box', background: '#fff',
        }}
      />
    </label>
  )
}
