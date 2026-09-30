'use client'

import { useState } from 'react'
import type { NotifDiscord } from './page'

const accent = '#BE185D'
const green  = '#22A06B'
const gray   = '#7C6B7E'
const dark   = '#2A1E2C'

function formatDate(iso: string | null) {
  if (!iso) return 'nunca'
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function Toggle({ checked, onClick }: { checked: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 42, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
        background: checked ? green : '#D9D0D3', position: 'relative', flexShrink: 0,
        transition: 'background 0.15s',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: checked ? 21 : 3,
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
      }} />
    </button>
  )
}

export default function NotificacoesClient({ initialData }: { initialData: NotifDiscord[] }) {
  const [items, setItems] = useState<NotifDiscord[]>(initialData)
  const [editingWebhook, setEditingWebhook] = useState<string | null>(null)
  const [webhookDraft, setWebhookDraft] = useState('')
  const [saving, setSaving] = useState<string | null>(null)

  async function patch(chave: string, updates: Partial<NotifDiscord>) {
    setSaving(chave)
    try {
      const res = await fetch('/api/notificacoes-discord', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave, ...updates }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const updated = await res.json()
      setItems(prev => prev.map(x => x.chave === chave ? updated : x))
    } catch (err: any) {
      alert('Erro: ' + err.message)
    } finally {
      setSaving(null)
    }
  }

  function toggleAtivo(item: NotifDiscord) {
    patch(item.chave, { ativo: !item.ativo })
  }

  function startEditWebhook(item: NotifDiscord) {
    setEditingWebhook(item.chave)
    setWebhookDraft(item.webhook_url ?? '')
  }

  async function saveWebhook(chave: string) {
    await patch(chave, { webhook_url: webhookDraft.trim() || null })
    setEditingWebhook(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {items.map(item => (
        <div key={item.chave} style={{
          background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)',
          padding: '18px 22px', opacity: item.ativo ? 1 : 0.6, transition: 'opacity 0.15s',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <Toggle checked={item.ativo} onClick={() => toggleAtivo(item)} />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: dark }}>{item.nome}</span>
                <code style={{
                  fontSize: 10.5, color: gray, padding: '2px 6px', borderRadius: 4,
                  background: '#FFFAF5', fontFamily: 'monospace',
                }}>{item.chave}</code>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5,
                  color: item.ativo ? green : gray, background: item.ativo ? green + '15' : '#F3EBE1',
                }}>
                  {item.ativo ? 'Ligada' : 'Desligada'}
                </span>
              </div>

              {item.descricao && (
                <p style={{ fontSize: 12.5, color: gray, margin: '6px 0 0', lineHeight: 1.5, maxWidth: 640 }}>
                  {item.descricao}
                </p>
              )}

              <div style={{ display: 'flex', gap: 18, marginTop: 10, fontSize: 12, color: gray, flexWrap: 'wrap' }}>
                <span>⏱ <strong style={{ color: dark, fontWeight: 600 }}>{item.quando}</strong></span>
                <span>📨 último envio: <strong style={{ color: dark, fontWeight: 600 }}>{formatDate(item.last_sent_at)}</strong></span>
              </div>

              <div style={{ marginTop: 10 }}>
                {editingWebhook === item.chave ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      value={webhookDraft}
                      onChange={e => setWebhookDraft(e.target.value)}
                      placeholder="https://discord.com/api/webhooks/... (vazio = usa o padrão do código)"
                      style={{
                        flex: 1, maxWidth: 480, fontSize: 12.5, padding: '7px 10px',
                        borderRadius: 8, border: '1px solid #E0D5D8', fontFamily: 'monospace',
                        color: dark, outline: 'none',
                      }}
                    />
                    <button
                      onClick={() => saveWebhook(item.chave)}
                      disabled={saving === item.chave}
                      style={{
                        fontSize: 12, fontWeight: 700, color: '#fff', background: accent,
                        border: 'none', borderRadius: 7, padding: '7px 14px', cursor: 'pointer',
                      }}
                    >
                      {saving === item.chave ? 'Salvando…' : 'Salvar'}
                    </button>
                    <button
                      onClick={() => setEditingWebhook(null)}
                      style={{
                        fontSize: 12, fontWeight: 600, color: gray, background: 'transparent',
                        border: 'none', cursor: 'pointer',
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startEditWebhook(item)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                      color: gray, background: '#FFFAF5', border: '1px solid #F0E4E6',
                      borderRadius: 8, padding: '6px 11px', cursor: 'pointer', fontFamily: 'monospace',
                    }}
                  >
                    🔗 {item.webhook_url
                      ? item.webhook_url.replace(/^https:\/\/discord\.com\/api\/webhooks\//, '…/').slice(0, 46) + '…'
                      : <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontStyle: 'italic' }}>usando webhook padrão do código</span>}
                    <span style={{ color: accent, fontWeight: 600 }}>editar</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
