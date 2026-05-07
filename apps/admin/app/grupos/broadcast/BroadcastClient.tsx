'use client'

import { useState } from 'react'

const accent = '#C4607A'
const green  = '#34C759'
const orange = '#FF9500'
const red    = '#FF3B30'

type Broadcast = {
  id: string
  title: string | null
  message: string
  media_url: string | null
  media_type: string | null
  status: string
  sent_at: string | null
  total_groups: number
  success_count: number
  fail_count: number
  created_at: string
}

type Group = {
  id: string
  name: string
  jid: string | null
  status: string
  is_receiving: boolean
  member_count: number
}

export default function BroadcastClient({
  history,
  groups,
}: {
  history: Broadcast[]
  groups: Group[]
}) {
  const [title, setTitle]       = useState('')
  const [message, setMessage]   = useState('')
  const [mediaUrl, setMediaUrl] = useState('')
  const [mediaType, setMediaType] = useState<'' | 'image' | 'video'>('')
  const [sending, setSending]   = useState(false)
  const [result, setResult]     = useState<{ ok: boolean; text: string } | null>(null)
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>(history)

  const activeGroups = groups.filter(g => g.jid)

  async function send() {
    if (!message.trim()) return
    if (!confirm(`Enviar para ${activeGroups.length} grupos ativos?`)) return
    setSending(true)
    setResult(null)
    try {
      const res = await fetch('/api/grupos/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || undefined,
          message: message.trim(),
          media_url: mediaUrl.trim() || undefined,
          media_type: mediaType || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult({ ok: true, text: `✓ Enviado para ${data.success} grupos${data.fail > 0 ? ` (${data.fail} falharam)` : ''}` })
      setTitle('')
      setMessage('')
      setMediaUrl('')
      setMediaType('')
      // Reload history
      const h2 = await fetch('/api/grupos/broadcast')
      const updated = await h2.json()
      if (Array.isArray(updated)) setBroadcasts(updated)
    } catch (err: any) {
      setResult({ ok: false, text: '✗ ' + err.message })
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 900 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#2D1B2E', marginBottom: 4 }}>Broadcast</div>
      <div style={{ fontSize: 14, color: '#8A8A8E', marginBottom: 28 }}>
        Envia mensagem para todos os grupos ativos com JID cadastrado
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, alignItems: 'start' }}>
        {/* Form */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '24px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#2D1B2E', marginBottom: 20 }}>Nova mensagem</div>

          {result && (
            <div style={{
              padding: '10px 16px', borderRadius: 10, marginBottom: 20,
              background: result.ok ? green + '15' : red + '15',
              color: result.ok ? green : red, fontSize: 13, fontWeight: 600,
            }}>
              {result.text}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#8A8A8E', display: 'block', marginBottom: 6 }}>TÍTULO (opcional)</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Ex: Promoção especial de maio"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14, border: '1px solid #E0E0E8', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#8A8A8E', display: 'block', marginBottom: 6 }}>MENSAGEM *</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Digite a mensagem que será enviada para todos os grupos..."
                rows={5}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14, border: '1px solid #E0E0E8', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
              <div style={{ fontSize: 11, color: '#8A8A8E', textAlign: 'right', marginTop: 4 }}>{message.length} caracteres</div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#8A8A8E', display: 'block', marginBottom: 6 }}>MÍDIA (opcional)</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {(['', 'image', 'video'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setMediaType(t)}
                    style={{
                      padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                      background: mediaType === t ? accent : '#F5F5F7',
                      color: mediaType === t ? '#fff' : '#2D1B2E',
                    }}
                  >
                    {t === '' ? 'Sem mídia' : t === 'image' ? '🖼 Imagem' : '🎥 Vídeo'}
                  </button>
                ))}
              </div>
              {mediaType !== '' && (
                <input
                  value={mediaUrl}
                  onChange={e => setMediaUrl(e.target.value)}
                  placeholder="URL pública da mídia (https://...)"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14, border: '1px solid #E0E0E8', outline: 'none', boxSizing: 'border-box' }}
                />
              )}
            </div>

            <button
              onClick={send}
              disabled={sending || !message.trim() || activeGroups.length === 0}
              style={{
                background: accent, color: '#fff', border: 'none', cursor: sending || !message.trim() ? 'default' : 'pointer',
                padding: '12px 24px', borderRadius: 10, fontSize: 15, fontWeight: 700,
                opacity: sending || !message.trim() ? 0.6 : 1,
              }}
            >
              {sending ? '⏳ Enviando…' : `📢 Enviar para ${activeGroups.length} grupos`}
            </button>
          </div>
        </div>

        {/* Grupos alvo */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#2D1B2E', marginBottom: 14 }}>
            Grupos que receberão
          </div>
          {activeGroups.length === 0 ? (
            <div style={{ fontSize: 13, color: '#8A8A8E', textAlign: 'center', padding: '20px 0' }}>
              Nenhum grupo com JID. Configure no Gerenciar.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activeGroups.map(g => (
                <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: g.is_receiving ? green : orange,
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#2D1B2E' }}>{g.name}</div>
                    <div style={{ fontSize: 11, color: '#8A8A8E' }}>{g.member_count} membros</div>
                  </div>
                </div>
              ))}
              {groups.filter(g => !g.jid).length > 0 && (
                <div style={{ fontSize: 11, color: '#8A8A8E', marginTop: 8, paddingTop: 8, borderTop: '1px solid #F0F0F5' }}>
                  {groups.filter(g => !g.jid).length} grupos sem JID (precisam de sync)
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Histórico */}
      {broadcasts.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', marginTop: 28 }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid #F0F0F5', fontSize: 15, fontWeight: 700, color: '#2D1B2E' }}>
            Histórico de broadcasts
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F0F0F5' }}>
                {['Mensagem', 'Enviado em', 'Resultado', 'Status'].map(h => (
                  <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 12, color: '#8A8A8E', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {broadcasts.map(b => (
                <tr key={b.id} style={{ borderBottom: '1px solid #F9F9FC' }}>
                  <td style={{ padding: '12px 20px' }}>
                    {b.title && <div style={{ fontSize: 13, fontWeight: 700, color: '#2D1B2E', marginBottom: 2 }}>{b.title}</div>}
                    <div style={{ fontSize: 13, color: '#555', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.message}
                    </div>
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: 12, color: '#8A8A8E', whiteSpace: 'nowrap' }}>
                    {b.sent_at
                      ? new Date(b.sent_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: 13 }}>
                    <span style={{ color: green, fontWeight: 600 }}>{b.success_count}</span>
                    <span style={{ color: '#8A8A8E' }}> / {b.total_groups}</span>
                    {b.fail_count > 0 && <span style={{ color: red, marginLeft: 4 }}>({b.fail_count} falhas)</span>}
                  </td>
                  <td style={{ padding: '12px 20px' }}>
                    <span style={{
                      fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                      background: b.status === 'done' ? green + '18' : b.status === 'sending' ? orange + '18' : red + '18',
                      color: b.status === 'done' ? green : b.status === 'sending' ? orange : red,
                    }}>
                      {b.status === 'done' ? 'Enviado' : b.status === 'sending' ? 'Enviando' : b.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
