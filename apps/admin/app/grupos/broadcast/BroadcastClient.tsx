'use client'

import { useState, useRef } from 'react'

const accent = '#C4607A'
const green  = '#34C759'
const orange = '#FF9500'
const red    = '#FF3B30'
const gray   = '#8A8A8E'
const blue   = '#007AFF'

type EvoInstance = {
  name: string
  connectionStatus: string
  ownerJid: string | null
  profileName: string | null
}

type Broadcast = {
  id: string
  title: string | null
  message: string
  media_url: string | null
  media_type: string | null
  status: string
  scheduled_at: string | null
  sent_at: string | null
  total_groups: number
  success_count: number
  fail_count: number
  instance_name: string | null
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

type SavedMessage = {
  id: string
  title: string
  message: string
  media_url: string | null
  media_type: string | null
  created_at: string
}

type UploadedMedia = {
  base64: string
  mimetype: string
  mediatype: 'image' | 'video' | 'document'
  filename: string
  size: number
  preview?: string
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function toLocalDatetimeInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// ── Modal de mensagem completa ───────────────────────────────────────
function MessageModal({ broadcast, onClose }: { broadcast: Broadcast; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 16, padding: '28px 32px',
          maxWidth: 560, width: '100%', maxHeight: '80vh', overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            {broadcast.title && (
              <div style={{ fontSize: 16, fontWeight: 700, color: '#2D1B2E', marginBottom: 4 }}>{broadcast.title}</div>
            )}
            <div style={{ fontSize: 12, color: gray }}>
              {broadcast.sent_at ? `Enviado em ${formatDate(broadcast.sent_at)}` : '—'}
              {broadcast.instance_name ? ` · via ${broadcast.instance_name}` : ''}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: '#F5F5F7', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#2D1B2E', flexShrink: 0, marginLeft: 16 }}
          >
            Fechar
          </button>
        </div>

        {broadcast.media_type && (
          <div style={{
            background: '#F9F9FC', borderRadius: 10, padding: '10px 14px',
            marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
            fontSize: 13, color: gray,
          }}>
            <span>{broadcast.media_type === 'image' ? '🖼' : broadcast.media_type === 'video' ? '🎥' : '📎'}</span>
            {broadcast.media_url
              ? <a href={broadcast.media_url} target="_blank" rel="noopener noreferrer" style={{ color: blue, fontSize: 12, wordBreak: 'break-all' }}>{broadcast.media_url}</a>
              : <span>Mídia enviada via upload</span>
            }
          </div>
        )}

        <div style={{
          background: '#F5F5F7', borderRadius: 12, padding: '16px 18px',
          fontSize: 14, lineHeight: 1.7, color: '#2D1B2E', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {broadcast.message}
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <span style={{
            fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
            background: broadcast.status === 'done' ? green + '18' : broadcast.status === 'cancelled' ? gray + '18' : orange + '18',
            color: broadcast.status === 'done' ? green : broadcast.status === 'cancelled' ? gray : orange,
          }}>
            {broadcast.status === 'done' ? `✓ Enviado para ${broadcast.success_count}/${broadcast.total_groups} grupos` : broadcast.status === 'cancelled' ? 'Cancelado' : broadcast.status}
          </span>
          {broadcast.fail_count > 0 && (
            <span style={{ fontSize: 12, color: red, fontWeight: 600 }}>{broadcast.fail_count} falhas</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Modal salvar mensagem ────────────────────────────────────────────
function SaveModal({
  message,
  onSave,
  onClose,
}: {
  message: string
  onSave: (title: string) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', maxWidth: 480, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#2D1B2E', marginBottom: 16 }}>💾 Salvar mensagem</div>
        <div style={{ background: '#F5F5F7', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: gray, marginBottom: 20, maxHeight: 100, overflow: 'hidden', lineHeight: 1.5 }}>
          {message.slice(0, 200)}{message.length > 200 ? '…' : ''}
        </div>
        <label style={{ fontSize: 12, fontWeight: 600, color: gray, display: 'block', marginBottom: 6 }}>NOME DA MENSAGEM *</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Ex: Promoção progressiva maio"
          autoFocus
          style={{ width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14, border: '1px solid #E0E0E8', outline: 'none', boxSizing: 'border-box', marginBottom: 20, fontFamily: 'inherit' }}
        />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: '#F5F5F7', border: 'none', cursor: 'pointer', padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600 }}>Cancelar</button>
          <button
            onClick={() => { if (title.trim()) onSave(title.trim()) }}
            disabled={!title.trim()}
            style={{ background: accent, color: '#fff', border: 'none', cursor: title.trim() ? 'pointer' : 'default', padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, opacity: title.trim() ? 1 : 0.5 }}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BroadcastClient({
  history,
  groups,
  instances,
  savedMessages: initialSaved,
}: {
  history: Broadcast[]
  groups: Group[]
  instances: EvoInstance[]
  savedMessages: SavedMessage[]
}) {
  const [title, setTitle]           = useState('')
  const [message, setMessage]       = useState('')
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMedia | null>(null)
  const [mediaUrl, setMediaUrl]     = useState('')
  const [mediaType, setMediaType]   = useState<'' | 'image' | 'video' | 'document'>('')
  const [mediaTab, setMediaTab]     = useState<'none' | 'upload' | 'url'>('none')

  const [instanceName, setInstanceName] = useState('')
  const [scheduleMode, setScheduleMode] = useState(false)
  const [scheduledAt, setScheduledAt]   = useState('')
  const [mentionAll, setMentionAll]     = useState(false)

  const [sending, setSending]       = useState(false)
  const [result, setResult]         = useState<{ ok: boolean; text: string } | null>(null)
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>(history)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)

  // Mensagens salvas
  const [savedMessages, setSavedMessages] = useState<SavedMessage[]>(initialSaved)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [deletingId, setDeletingId]       = useState<string | null>(null)

  // Modal de mensagem completa
  const [viewBroadcast, setViewBroadcast] = useState<Broadcast | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeGroups  = groups.filter(g => g.jid)
  const openInstances = instances.filter(i => i.connectionStatus === 'open')

  const defaultSchedule = () => {
    const d = new Date()
    d.setHours(d.getHours() + 1, 0, 0, 0)
    return toLocalDatetimeInput(d)
  }

  // ── Upload ──
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadProgress('Processando…')
    setUploadedMedia(null)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/grupos/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
      setUploadedMedia({ ...data, preview })
      setMediaType(data.mediatype)
      setUploadProgress(null)
    } catch (err: any) {
      setUploadProgress('✗ Erro: ' + err.message)
    }
  }

  function removeMedia() {
    if (uploadedMedia?.preview) URL.revokeObjectURL(uploadedMedia.preview)
    setUploadedMedia(null)
    setMediaType('')
    setMediaUrl('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Usar mensagem salva ──
  function useSaved(sm: SavedMessage) {
    setTitle(sm.title)
    setMessage(sm.message)
    if (sm.media_url) {
      setMediaTab('url')
      setMediaUrl(sm.media_url)
      setMediaType((sm.media_type as any) || 'image')
    } else {
      setMediaTab('none')
      removeMedia()
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Salvar mensagem ──
  async function saveMessage(savedTitle: string) {
    const res = await fetch('/api/grupos/saved-messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: savedTitle,
        message: message.trim(),
        media_url: mediaTab === 'url' ? mediaUrl : null,
        media_type: mediaTab === 'url' ? mediaType || 'image' : null,
      }),
    })
    if (res.ok) {
      const created = await res.json()
      setSavedMessages(prev => [created, ...prev])
    }
    setShowSaveModal(false)
  }

  // ── Deletar mensagem salva ──
  async function deleteSaved(id: string) {
    if (!confirm('Apagar essa mensagem salva?')) return
    setDeletingId(id)
    const res = await fetch(`/api/grupos/saved-messages?id=${id}`, { method: 'DELETE' })
    if (res.ok) setSavedMessages(prev => prev.filter(m => m.id !== id))
    setDeletingId(null)
  }

  // ── Enviar ──
  async function send() {
    if (!message.trim()) return
    const actionLabel = scheduleMode
      ? `Agendar para ${new Date(scheduledAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} para ${activeGroups.length} grupos?`
      : `Enviar agora para ${activeGroups.length} grupos?`
    if (!confirm(actionLabel)) return
    setSending(true)
    setResult(null)
    try {
      const body: Record<string, any> = {
        title: title.trim() || undefined,
        message: message.trim(),
        instance_name: instanceName || undefined,
        scheduled_at: scheduleMode && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        mention_all: mentionAll,
      }
      if (mediaTab === 'upload' && uploadedMedia) {
        body.media_base64 = uploadedMedia.base64
        body.media_type   = uploadedMedia.mediatype
        body.mimetype     = uploadedMedia.mimetype
      } else if (mediaTab === 'url' && mediaUrl.trim()) {
        body.media_url  = mediaUrl.trim()
        body.media_type = mediaType || 'image'
      }
      const res = await fetch('/api/grupos/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.scheduled) {
        setResult({ ok: true, text: `✓ Agendado para ${formatDate(data.scheduled_at)}` })
      } else {
        setResult({ ok: true, text: `✓ Enviado para ${data.success} grupos${data.fail > 0 ? ` (${data.fail} falharam)` : ''}` })
      }
      setTitle('')
      setMessage('')
      removeMedia()
      setScheduleMode(false)
      setScheduledAt('')
      setMentionAll(false)
      const h2 = await fetch('/api/grupos/broadcast')
      const updated = await h2.json()
      if (Array.isArray(updated)) setBroadcasts(updated)
    } catch (err: any) {
      setResult({ ok: false, text: '✗ ' + err.message })
    } finally {
      setSending(false)
    }
  }

  // ── Cancelar agendado ──
  async function cancelScheduled(b: Broadcast) {
    if (!confirm('Cancelar esse broadcast agendado?')) return
    const res = await fetch(`/api/grupos/broadcast/${b.id}`, { method: 'DELETE' })
    if (res.ok) setBroadcasts(prev => prev.map(x => x.id === b.id ? { ...x, status: 'cancelled' } : x))
  }

  const scheduled = broadcasts.filter(b => b.status === 'scheduled')
  const sent      = broadcasts.filter(b => b.status !== 'scheduled')

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14,
    border: '1px solid #E0E0E8', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 980 }}>
      {/* Modals */}
      {viewBroadcast && <MessageModal broadcast={viewBroadcast} onClose={() => setViewBroadcast(null)} />}
      {showSaveModal && <SaveModal message={message} onSave={saveMessage} onClose={() => setShowSaveModal(false)} />}

      <div style={{ fontSize: 22, fontWeight: 700, color: '#2D1B2E', marginBottom: 4 }}>Enviar mensagem nos grupos</div>
      <div style={{ fontSize: 14, color: gray, marginBottom: 28 }}>Envia ou agenda mensagem para todos os grupos ativos</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 330px', gap: 24, alignItems: 'start' }}>
        {/* ── Formulário ── */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '24px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#2D1B2E', marginBottom: 20 }}>Nova mensagem</div>

          {result && (
            <div style={{
              padding: '10px 16px', borderRadius: 10, marginBottom: 20,
              background: result.ok ? green + '15' : red + '15',
              color: result.ok ? green : red, fontSize: 13, fontWeight: 600,
            }}>{result.text}</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Título */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: gray, display: 'block', marginBottom: 6 }}>TÍTULO (opcional)</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Promoção especial de maio" style={inputStyle} />
            </div>

            {/* Mensagem */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: gray }}>MENSAGEM *</label>
                {message.trim().length > 10 && (
                  <button
                    onClick={() => setShowSaveModal(true)}
                    style={{ fontSize: 11, fontWeight: 600, color: accent, background: accent + '12', border: 'none', cursor: 'pointer', padding: '3px 10px', borderRadius: 7 }}
                  >
                    💾 Salvar mensagem
                  </button>
                )}
              </div>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Digite a mensagem que será enviada para todos os grupos..."
                rows={5}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
              <div style={{ fontSize: 11, color: gray, textAlign: 'right', marginTop: 4 }}>{message.length} caracteres</div>
            </div>

            {/* Mídia */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: gray, display: 'block', marginBottom: 8 }}>MÍDIA (opcional)</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {([['none', 'Sem mídia'], ['upload', '📎 Upload'], ['url', '🔗 URL']] as const).map(([k, l]) => (
                  <button key={k} onClick={() => { setMediaTab(k); if (k !== 'upload') removeMedia() }}
                    style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: mediaTab === k ? accent : '#F5F5F7', color: mediaTab === k ? '#fff' : '#2D1B2E' }}>
                    {l}
                  </button>
                ))}
              </div>
              {mediaTab === 'upload' && (
                <div>
                  {!uploadedMedia ? (
                    <div onClick={() => fileInputRef.current?.click()}
                      style={{ border: `2px dashed ${accent}50`, borderRadius: 12, padding: '24px', textAlign: 'center', cursor: 'pointer', background: accent + '05' }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>📁</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#2D1B2E', marginBottom: 4 }}>Clique para selecionar imagem ou vídeo</div>
                      <div style={{ fontSize: 12, color: gray }}>JPG, PNG, GIF, MP4, MOV — máximo 30 MB</div>
                      {uploadProgress && <div style={{ marginTop: 10, fontSize: 12, color: uploadProgress.startsWith('✗') ? red : accent, fontWeight: 600 }}>{uploadProgress}</div>}
                    </div>
                  ) : (
                    <div style={{ border: `1px solid ${green}40`, borderRadius: 12, padding: '14px 16px', background: green + '06', display: 'flex', alignItems: 'center', gap: 14 }}>
                      {uploadedMedia.preview
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={uploadedMedia.preview} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                        : <div style={{ width: 64, height: 64, borderRadius: 8, background: '#F0F0F5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>{uploadedMedia.mediatype === 'video' ? '🎥' : '📄'}</div>
                      }
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#2D1B2E', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{uploadedMedia.filename}</div>
                        <div style={{ fontSize: 12, color: gray }}>{formatBytes(uploadedMedia.size)} · {uploadedMedia.mimetype}</div>
                      </div>
                      <button onClick={removeMedia} style={{ background: red + '15', color: red, border: 'none', cursor: 'pointer', padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, flexShrink: 0 }}>Remover</button>
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleFileSelect} />
                </div>
              )}
              {mediaTab === 'url' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['image', 'video'] as const).map(t => (
                      <button key={t} onClick={() => setMediaType(t)}
                        style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: mediaType === t ? accent : '#F5F5F7', color: mediaType === t ? '#fff' : '#2D1B2E' }}>
                        {t === 'image' ? '🖼 Imagem' : '🎥 Vídeo'}
                      </button>
                    ))}
                  </div>
                  <input value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} placeholder="https://exemplo.com/imagem.jpg" style={inputStyle} />
                </div>
              )}
            </div>

            {/* Número */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: gray, display: 'block', marginBottom: 6 }}>NÚMERO DE ENVIO</label>
              <select value={instanceName} onChange={e => setInstanceName(e.target.value)} style={{ ...inputStyle, background: '#fff', cursor: 'pointer' }}>
                <option value="">Automático (primeiro conectado)</option>
                {instances.map(i => (
                  <option key={i.name} value={i.name} disabled={i.connectionStatus !== 'open'}>
                    {i.profileName ?? i.name}
                    {i.ownerJid ? ` — ${i.ownerJid.replace('@s.whatsapp.net', '')}` : ''}
                    {i.connectionStatus !== 'open' ? ' (desconectado)' : ''}
                  </option>
                ))}
              </select>
              {openInstances.length === 0 && (
                <div style={{ fontSize: 12, color: orange, marginTop: 6 }}>⚠️ Nenhum número conectado. Configure no Evolution Manager.</div>
              )}
            </div>

            {/* Mencionar todos (@all) */}
            <div style={{ background: mentionAll ? accent + '08' : '#F9F9FC', border: `1px solid ${mentionAll ? accent + '30' : '#E5E5EA'}`, borderRadius: 12, padding: '14px 16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <div onClick={() => setMentionAll(v => !v)}
                  style={{ width: 44, height: 24, borderRadius: 12, cursor: 'pointer', transition: 'background .2s', background: mentionAll ? accent : '#D0D0D8', position: 'relative', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', top: 3, left: mentionAll ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#2D1B2E' }}>
                    Mencionar todos do grupo <span style={{ color: accent, fontWeight: 800 }}>@all</span>
                  </div>
                  <div style={{ fontSize: 11, color: gray, marginTop: 2, lineHeight: 1.4 }}>
                    Todos os membros recebem notificação de menção. Use com moderação para não saturar.
                  </div>
                </div>
              </label>
            </div>

            {/* Agendamento */}
            <div style={{ background: scheduleMode ? accent + '08' : '#F9F9FC', border: `1px solid ${scheduleMode ? accent + '30' : '#E5E5EA'}`, borderRadius: 12, padding: '14px 16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <div onClick={() => { const n = !scheduleMode; setScheduleMode(n); if (n && !scheduledAt) setScheduledAt(defaultSchedule()) }}
                  style={{ width: 44, height: 24, borderRadius: 12, cursor: 'pointer', transition: 'background .2s', background: scheduleMode ? accent : '#D0D0D8', position: 'relative', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', top: 3, left: scheduleMode ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#2D1B2E' }}>Agendar envio</div>
                  <div style={{ fontSize: 11, color: gray }}>Mensagem será enviada automaticamente no horário definido</div>
                </div>
              </label>
              {scheduleMode && (
                <div style={{ marginTop: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: gray, display: 'block', marginBottom: 6 }}>DATA E HORA DE ENVIO</label>
                  <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} min={toLocalDatetimeInput(new Date())} style={{ ...inputStyle, width: 'auto' }} />
                  {scheduledAt && <div style={{ fontSize: 12, color: accent, marginTop: 6, fontWeight: 500 }}>📅 Será enviado {formatDate(new Date(scheduledAt).toISOString())}</div>}
                </div>
              )}
            </div>

            {/* Botão enviar */}
            <button
              onClick={send}
              disabled={sending || !message.trim() || activeGroups.length === 0 || (scheduleMode && !scheduledAt)}
              style={{ background: accent, color: '#fff', border: 'none', cursor: sending || !message.trim() ? 'default' : 'pointer', padding: '13px 24px', borderRadius: 10, fontSize: 15, fontWeight: 700, opacity: sending || !message.trim() || activeGroups.length === 0 ? 0.6 : 1 }}
            >
              {sending ? '⏳ Processando…' : scheduleMode ? `📅 Agendar para ${activeGroups.length} grupos` : `📢 Enviar agora para ${activeGroups.length} grupos`}
            </button>
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* WhatsApp Preview */}
          <WhatsAppPreview
            message={message}
            mediaPreviewUrl={uploadedMedia?.preview || (mediaTab === 'url' && mediaType === 'image' ? mediaUrl : '')}
            mediaType={uploadedMedia?.mediatype || (mediaTab === 'url' ? mediaType : '')}
            mentionAll={mentionAll}
          />

          {/* Mensagens salvas */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#2D1B2E' }}>💾 Mensagens salvas</div>
              <span style={{ fontSize: 11, color: gray }}>{savedMessages.length}/15</span>
            </div>
            {savedMessages.length === 0 ? (
              <div style={{ fontSize: 13, color: gray, textAlign: 'center', padding: '12px 0', lineHeight: 1.5 }}>
                Escreva uma mensagem e clique em<br />
                <strong style={{ color: accent }}>💾 Salvar mensagem</strong>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {savedMessages.map(sm => (
                  <div key={sm.id} style={{ border: '1px solid #F0F0F5', borderRadius: 10, padding: '10px 12px', background: '#FAFAFA' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#2D1B2E', lineHeight: 1.3 }}>{sm.title}</div>
                      <button
                        onClick={() => deleteSaved(sm.id)}
                        disabled={deletingId === sm.id}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: gray, fontSize: 14, flexShrink: 0, padding: 0, lineHeight: 1 }}
                        title="Apagar"
                      >✕</button>
                    </div>
                    <div style={{ fontSize: 11, color: gray, lineHeight: 1.4, marginBottom: 8, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {sm.message}
                    </div>
                    <button
                      onClick={() => useSaved(sm)}
                      style={{ width: '100%', background: accent + '12', color: accent, border: 'none', cursor: 'pointer', padding: '6px 0', borderRadius: 7, fontSize: 12, fontWeight: 700 }}
                    >
                      Usar esta mensagem
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Grupos alvo */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#2D1B2E', marginBottom: 14 }}>Grupos que receberão</div>
            {activeGroups.length === 0 ? (
              <div style={{ fontSize: 13, color: gray, textAlign: 'center', padding: '16px 0' }}>Nenhum grupo com JID.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {activeGroups.map(g => (
                  <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: g.is_receiving ? green : orange }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#2D1B2E' }}>{g.name}</div>
                      <div style={{ fontSize: 11, color: gray }}>{g.member_count.toLocaleString('pt-BR')} membros</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Números */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#2D1B2E', marginBottom: 14 }}>Números</div>
            {instances.map(i => {
              const c = i.connectionStatus === 'open' ? green : i.connectionStatus === 'connecting' ? orange : red
              return (
                <div key={i.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0, display: 'inline-block' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#2D1B2E' }}>{i.profileName ?? i.name}</div>
                    {i.ownerJid && <div style={{ fontSize: 10, color: gray }}>{i.ownerJid.replace('@s.whatsapp.net', '')}</div>}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: c }}>{i.connectionStatus === 'open' ? '● OK' : i.connectionStatus === 'connecting' ? '● …' : '● Off'}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Agendados ── */}
      {scheduled.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${accent}20`, marginTop: 28 }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid #F0F0F5', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#2D1B2E' }}>🕐 Mensagens agendadas</div>
            <span style={{ fontSize: 12, fontWeight: 700, background: accent + '18', color: accent, padding: '2px 9px', borderRadius: 20 }}>{scheduled.length}</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F0F0F5' }}>
                {['Mensagem', 'Agendado para', 'Número', 'Grupos', ''].map(h => (
                  <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 12, color: gray, fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scheduled.map(b => (
                <tr key={b.id} style={{ borderBottom: '1px solid #F9F9FC' }}>
                  <td style={{ padding: '12px 20px' }}>
                    {b.title && <div style={{ fontSize: 13, fontWeight: 700, color: '#2D1B2E', marginBottom: 2 }}>{b.title}</div>}
                    <div style={{ fontSize: 13, color: '#555', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.message}</div>
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: 12, color: '#2D1B2E', fontWeight: 600, whiteSpace: 'nowrap' }}>{b.scheduled_at ? formatDate(b.scheduled_at) : '—'}</td>
                  <td style={{ padding: '12px 20px', fontSize: 12, color: gray }}>{b.instance_name ?? '—'}</td>
                  <td style={{ padding: '12px 20px', fontSize: 12, color: '#2D1B2E' }}>{b.total_groups} grupos</td>
                  <td style={{ padding: '12px 20px' }}>
                    <button onClick={() => cancelScheduled(b)} style={{ fontSize: 12, color: red, background: red + '12', border: 'none', cursor: 'pointer', padding: '4px 10px', borderRadius: 7, fontWeight: 600 }}>Cancelar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Histórico de envios ── */}
      {sent.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', marginTop: 28 }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid #F0F0F5', fontSize: 15, fontWeight: 700, color: '#2D1B2E' }}>
            Histórico de envios
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F0F0F5' }}>
                {['Mensagem', 'Enviado em', 'Número', 'Resultado', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 12, color: gray, fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sent.map(b => (
                <tr key={b.id} style={{ borderBottom: '1px solid #F9F9FC' }}>
                  <td style={{ padding: '12px 20px', maxWidth: 260 }}>
                    {b.title && <div style={{ fontSize: 13, fontWeight: 700, color: '#2D1B2E', marginBottom: 2 }}>{b.title}</div>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {b.media_type && <span style={{ fontSize: 13 }}>{b.media_type === 'image' ? '🖼' : b.media_type === 'video' ? '🎥' : '📎'}</span>}
                      <div style={{ fontSize: 13, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.message}</div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: 12, color: gray, whiteSpace: 'nowrap' }}>{b.sent_at ? formatDate(b.sent_at) : '—'}</td>
                  <td style={{ padding: '12px 20px', fontSize: 12, color: gray }}>{b.instance_name ?? '—'}</td>
                  <td style={{ padding: '12px 20px', fontSize: 13 }}>
                    <span style={{ color: green, fontWeight: 600 }}>{b.success_count}</span>
                    <span style={{ color: gray }}> / {b.total_groups}</span>
                    {b.fail_count > 0 && <span style={{ color: red, marginLeft: 4 }}>({b.fail_count} falhas)</span>}
                  </td>
                  <td style={{ padding: '12px 20px' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: b.status === 'done' ? green + '18' : b.status === 'cancelled' ? gray + '18' : orange + '18', color: b.status === 'done' ? green : b.status === 'cancelled' ? gray : orange }}>
                      {b.status === 'done' ? 'Enviado' : b.status === 'cancelled' ? 'Cancelado' : b.status === 'sending' ? 'Enviando…' : b.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 20px' }}>
                    <button
                      onClick={() => setViewBroadcast(b)}
                      style={{ fontSize: 12, color: blue, background: blue + '12', border: 'none', cursor: 'pointer', padding: '4px 10px', borderRadius: 7, fontWeight: 600, whiteSpace: 'nowrap' }}
                    >
                      Ver completo
                    </button>
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

// ─── WhatsApp Preview ───────────────────────────────────────
function WhatsAppPreview({ message, mediaPreviewUrl, mediaType, mentionAll }: {
  message: string
  mediaPreviewUrl: string
  mediaType: string
  mentionAll: boolean
}) {
  const now = new Date()
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const hasMedia = !!mediaPreviewUrl
  const isImage = mediaType === 'image' || mediaType === ''
  const isVideo = mediaType === 'video'
  const hasText = !!message.trim()

  // Render do texto com @all destacado em azul (estilo WhatsApp)
  const renderMessage = (text: string) => {
    if (!mentionAll) return text
    return (
      <>
        <span style={{ color: '#1F7DBC', fontWeight: 600 }}>@todos </span>
        {text}
      </>
    )
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 18, border: '1px solid rgba(0,0,0,0.06)',
      overflow: 'hidden', boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
      position: 'sticky', top: 20,
    }}>
      <div style={{
        padding: '10px 14px', fontSize: 11, fontWeight: 700,
        color: '#2D1B2E', background: '#FAFAFA',
        borderBottom: '1px solid #F0F0F5',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>👁 Preview da mensagem</span>
        <span style={{ fontSize: 9, color: '#8A8A8E', fontWeight: 500 }}>Como aparece no WhatsApp</span>
      </div>

      {/* WhatsApp chat */}
      <div style={{
        background: '#075E54', padding: '10px 12px',
        display: 'flex', alignItems: 'center', gap: 10,
        color: '#fff',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700,
        }}>
          👥
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>Grupo de Promoções</div>
          <div style={{ fontSize: 10, opacity: 0.7, marginTop: 1 }}>{mentionAll ? 'todos os participantes' : 'preview'}</div>
        </div>
      </div>

      {/* Chat body */}
      <div style={{
        background: '#E5DDD5',
        backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Cdefs%3E%3Cpattern id=\'p\' x=\'0\' y=\'0\' width=\'20\' height=\'20\' patternUnits=\'userSpaceOnUse\'%3E%3Ccircle cx=\'10\' cy=\'10\' r=\'1\' fill=\'%23000\' fill-opacity=\'0.04\'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width=\'100\' height=\'100\' fill=\'url(%23p)\'/%3E%3C/svg%3E")',
        padding: '12px 12px 14px', minHeight: 200, maxHeight: 460, overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <span style={{
            fontSize: 10, color: '#54656F', background: '#E1F2FB',
            padding: '3px 10px', borderRadius: 8, fontWeight: 500,
          }}>HOJE</span>
        </div>

        {!hasMedia && !hasText && (
          <div style={{
            display: 'flex', justifyContent: 'center', padding: '24px 14px',
            color: '#54656F', fontSize: 12, fontStyle: 'italic', textAlign: 'center',
          }}>
            Digite a mensagem para ver o preview…
          </div>
        )}

        {/* Bubble 1 — imagem (ordem fixa: imagem primeiro) */}
        {hasMedia && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
            <div style={{
              maxWidth: '85%', background: '#DCF8C6', borderRadius: 8,
              padding: 3, position: 'relative',
              boxShadow: '0 1px 1px rgba(0,0,0,0.08)',
            }}>
              {isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaPreviewUrl} alt="" style={{
                  width: '100%', maxWidth: 240, borderRadius: 6, display: 'block',
                }} />
              ) : isVideo ? (
                <div style={{
                  width: 240, height: 140, borderRadius: 6,
                  background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 32, position: 'relative',
                }}>
                  ▶
                  <div style={{
                    position: 'absolute', bottom: 4, left: 6,
                    fontSize: 10, color: '#fff', opacity: 0.9,
                  }}>vídeo</div>
                </div>
              ) : (
                <div style={{
                  width: 240, padding: '18px 14px', borderRadius: 6,
                  background: '#F0F2F5', textAlign: 'center', fontSize: 13,
                }}>
                  📄 Documento
                </div>
              )}
              <div style={{
                fontSize: 9, color: '#667781', textAlign: 'right',
                padding: '3px 6px 0', display: 'flex', justifyContent: 'flex-end', gap: 2,
              }}>
                {time} <span style={{ color: '#4FC3F7' }}>✓✓</span>
              </div>
            </div>
          </div>
        )}

        {/* Bubble 2 — texto (segunda mensagem) */}
        {hasText && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: hasMedia ? 6 : 0 }}>
            <div style={{
              maxWidth: '85%', background: '#DCF8C6', borderRadius: 8,
              padding: '6px 9px 6px 10px', position: 'relative',
              boxShadow: '0 1px 1px rgba(0,0,0,0.08)',
            }}>
              <div style={{
                fontSize: 13, color: '#111B21', lineHeight: 1.42,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {renderMessage(message)}
              </div>
              <div style={{
                fontSize: 9, color: '#667781', textAlign: 'right',
                marginTop: 2, display: 'flex', justifyContent: 'flex-end', gap: 2,
              }}>
                {time} <span style={{ color: '#4FC3F7' }}>✓✓</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer info */}
      <div style={{
        padding: '8px 12px', fontSize: 10, color: '#8A8A8E',
        background: '#FAFAFA', borderTop: '1px solid #F0F0F5',
        lineHeight: 1.4,
      }}>
        {hasMedia && hasText && (
          <div>📤 Imagem enviada primeiro, depois o texto (mensagens separadas)</div>
        )}
        {mentionAll && (
          <div style={{ color: '#C4607A', fontWeight: 600 }}>🔔 Todos os membros serão mencionados</div>
        )}
      </div>
    </div>
  )
}
