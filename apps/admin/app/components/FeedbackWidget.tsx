'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'

const BLUE = '#2563EB'
const RED = '#DC2626'

export default function FeedbackWidget() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<'bug' | 'suggestion'>('bug')
  const [message, setMessage] = useState('')
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  // Não mostra na tela de login.
  const hidden = pathname === '/login' || pathname?.startsWith('/login')

  const reset = () => { setType('bug'); setMessage(''); setScreenshot(null); setError(null); setDone(false) }

  const fileToDataUrl = (file: File): Promise<string> => new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(file)
  })

  const handleFile = useCallback(async (file: File | null | undefined) => {
    if (!file || !file.type.startsWith('image/')) return
    if (file.size > 6 * 1024 * 1024) { setError('Imagem muito grande (máx. 6 MB).'); return }
    setScreenshot(await fileToDataUrl(file))
    setError(null)
  }, [])

  // Colar print com Ctrl+V enquanto o modal está aberto.
  useEffect(() => {
    if (!open) return
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/'))
      if (item) { e.preventDefault(); handleFile(item.getAsFile()) }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [open, handleFile])

  const submit = async () => {
    if (!message.trim()) { setError('Escreva o que aconteceu.'); return }
    setSending(true); setError(null)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, message: message.trim(), page_url: window.location.href, screenshot }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Falha ao enviar')
      setDone(true)
      setTimeout(() => { setOpen(false); reset() }, 1600)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao enviar')
    } finally {
      setSending(false)
    }
  }

  if (hidden) return null

  return (
    <>
      {/* Botão flutuante */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            position: 'fixed', right: 22, bottom: 22, zIndex: 9998,
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '13px 20px', borderRadius: 999, border: 'none', cursor: 'pointer',
            background: BLUE, color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
            boxShadow: '0 8px 24px rgba(37,99,235,0.35)',
          }}
        >
          <span style={{ fontSize: 17 }}>💬</span> Feedback
        </button>
      )}

      {/* Modal */}
      {open && (
        <div
          onClick={() => !sending && setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(20,15,25,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: 18, boxShadow: '0 20px 60px rgba(0,0,0,0.28)', fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid #F0ECF2' }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#1A1420', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: BLUE }}>✦</span> Sugestão ou problema
              </div>
              <button onClick={() => !sending && setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9A8A9C', lineHeight: 1 }}>×</button>
            </div>

            {done ? (
              <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1A1420', marginBottom: 4 }}>Recebido, obrigada!</div>
                <div style={{ fontSize: 13.5, color: '#7C6B7E' }}>Vou dar uma olhada e, se for um bug claro, já corrijo.</div>
              </div>
            ) : (
              <div style={{ padding: '18px 22px 22px' }}>
                {/* Tipo */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                  {([['bug', '🐞 Problema / bug', RED], ['suggestion', '💡 Sugestão', BLUE]] as const).map(([val, label, color]) => {
                    const active = type === val
                    return (
                      <button
                        key={val}
                        onClick={() => setType(val)}
                        style={{
                          flex: 1, padding: '12px 10px', borderRadius: 12, cursor: 'pointer', fontSize: 14.5, fontWeight: 700, fontFamily: 'inherit',
                          border: `1.5px solid ${active ? color : '#E6E0EA'}`,
                          background: active ? (val === 'bug' ? '#FEF2F2' : '#EFF6FF') : '#fff',
                          color: active ? color : '#6B5B6D',
                        }}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>

                {/* Mensagem */}
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="O que aconteceu? Em qual tela? Pode colar um print (Ctrl+V)."
                  rows={5}
                  autoFocus
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #DCE3F0', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5, background: '#FAFAFB', color: '#1A1420', outline: 'none' }}
                />

                {/* Print */}
                <div style={{ marginTop: 12 }}>
                  {screenshot ? (
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={screenshot} alt="print" style={{ maxHeight: 120, borderRadius: 10, border: '1px solid #E6E0EA', display: 'block' }} />
                      <button onClick={() => setScreenshot(null)} style={{ position: 'absolute', top: -8, right: -8, width: 24, height: 24, borderRadius: '50%', border: 'none', background: '#1A1420', color: '#fff', cursor: 'pointer', fontSize: 13 }}>×</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileRef.current?.click()}
                      style={{ width: 96, height: 84, borderRadius: 12, border: '1.5px dashed #CBD5E1', background: '#fff', cursor: 'pointer', color: '#8A7A8C', fontSize: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit' }}
                    >
                      <span style={{ fontSize: 20 }}>🖼️</span> Print
                    </button>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => handleFile(e.target.files?.[0])} />
                  <div style={{ fontSize: 12, color: '#9A8A9C', marginTop: 8 }}>Dica: você pode colar um print direto com Ctrl+V.</div>
                </div>

                {error && <div style={{ marginTop: 12, fontSize: 13, color: RED, background: '#FEF2F2', padding: '8px 12px', borderRadius: 8 }}>{error}</div>}

                <button
                  onClick={submit}
                  disabled={sending || !message.trim()}
                  style={{
                    width: '100%', marginTop: 16, padding: '14px', borderRadius: 12, border: 'none', cursor: sending || !message.trim() ? 'default' : 'pointer',
                    background: BLUE, color: '#fff', fontSize: 15.5, fontWeight: 700, fontFamily: 'inherit',
                    opacity: sending || !message.trim() ? 0.55 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  {sending ? 'Enviando…' : <>➤ Enviar</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
