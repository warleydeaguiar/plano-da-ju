'use client'

import { useState, useEffect, useCallback } from 'react'

const T = {
  bg: '#F5F5F7', card: '#fff', ink: '#0F172A', inkSoft: '#64748B', border: '#E5E7EB',
  green: '#22C55E', greenSoft: '#DCFCE7', orange: '#F97316', orangeSoft: '#FFEDD5',
  red: '#EF4444', redSoft: '#FEE2E2', gray: '#94A3B8', graySoft: '#F1F5F9',
  pink: '#EC4899', pinkDeep: '#BE185D',
}

interface Instance {
  name: string
  connectionStatus: string
  state: string
  ownerJid: string | null
  ownerPhone: string | null
  profileName: string | null
}

function StateBadge({ state }: { state: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    open:       { bg: T.greenSoft,  fg: '#15803D', label: '🟢 Conectado' },
    close:      { bg: T.redSoft,    fg: '#B91C1C', label: '🔴 Desconectado' },
    connecting: { bg: T.orangeSoft, fg: '#C2410C', label: '🟡 Conectando…' },
  }
  const c = map[state] ?? { bg: T.graySoft, fg: T.inkSoft, label: state }
  return (
    <span style={{
      background: c.bg, color: c.fg, padding: '4px 12px', borderRadius: 99,
      fontSize: 12, fontWeight: 700,
    }}>{c.label}</span>
  )
}

function InstanceCard({ inst, onAction }: { inst: Instance; onAction: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [pairingCode, setPairingCode] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function act(action: 'qr' | 'restart' | 'logout') {
    if (action === 'logout' && !confirm('Fazer logout? Você precisará escanear o QR novamente.')) return
    setBusy(action)
    setMsg(null)
    try {
      const res = await fetch('/api/grupos/conexao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, instance: inst.name }),
      })
      const data = await res.json()
      if (!data.ok && !data.qrBase64) throw new Error(data.error ?? 'Erro')
      if (action === 'qr') {
        setQr(data.qrBase64)
        setPairingCode(data.pairingCode)
        setMsg({ ok: true, text: '✓ QR gerado — escaneie agora (expira em 60s)' })
      } else if (action === 'restart') {
        setMsg({ ok: true, text: '✓ Instância reiniciada' })
        setTimeout(onAction, 1500)
      } else {
        setMsg({ ok: true, text: '✓ Logout feito — clique em "Conectar (QR)" pra reconectar' })
        setTimeout(onAction, 1500)
      }
    } catch (err: any) {
      setMsg({ ok: false, text: '✗ ' + (err.message ?? 'Erro') })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`, borderRadius: 14,
      padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.ink, marginBottom: 4 }}>
            {inst.profileName ?? inst.name}
          </div>
          <div style={{ fontSize: 12, color: T.inkSoft, fontFamily: 'ui-monospace, monospace' }}>
            {inst.name}
          </div>
          {inst.ownerPhone && (
            <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 4 }}>
              📱 +{inst.ownerPhone}
            </div>
          )}
        </div>
        <StateBadge state={inst.state} />
      </div>

      {msg && (
        <div style={{
          padding: '8px 12px', borderRadius: 8,
          background: msg.ok ? T.greenSoft : T.redSoft,
          color: msg.ok ? '#15803D' : '#B91C1C',
          fontSize: 12, fontWeight: 600,
        }}>{msg.text}</div>
      )}

      {qr && (
        <div style={{ textAlign: 'center', padding: 12, background: T.graySoft, borderRadius: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR Code" style={{ maxWidth: 240, height: 'auto' }} />
          {pairingCode && (
            <div style={{ marginTop: 12, fontSize: 13, color: T.inkSoft }}>
              Código de pareamento: <strong style={{ fontFamily: 'monospace', color: T.ink }}>{pairingCode}</strong>
            </div>
          )}
          <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 10, lineHeight: 1.5 }}>
            WhatsApp → 3 pontinhos → <strong>Aparelhos conectados</strong> → Conectar um aparelho
            <br />→ Escaneie o QR acima
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() => act('qr')}
          disabled={!!busy}
          style={{
            flex: 1, background: T.pink, color: '#fff', border: 'none',
            padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700,
            cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit',
          }}
        >
          {busy === 'qr' ? '⏳' : '📷 Conectar (QR)'}
        </button>
        <button
          onClick={() => act('restart')}
          disabled={!!busy}
          style={{
            background: T.graySoft, color: T.ink, border: `1px solid ${T.border}`,
            padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit',
          }}
        >
          {busy === 'restart' ? '⏳' : '🔄 Reiniciar'}
        </button>
        <button
          onClick={() => act('logout')}
          disabled={!!busy}
          style={{
            background: 'transparent', color: T.red, border: `1px solid ${T.redSoft}`,
            padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit',
          }}
        >
          {busy === 'logout' ? '⏳' : 'Logout'}
        </button>
      </div>
    </div>
  )
}

export default function ConexaoClient() {
  const [instances, setInstances] = useState<Instance[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/grupos/conexao')
      const data = await res.json()
      setInstances(data.instances ?? [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  // Auto-refresh a cada 10s para ver mudanças de status
  useEffect(() => {
    const id = setInterval(load, 10_000)
    return () => clearInterval(id)
  }, [load])

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1100 }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: T.ink, marginBottom: 4 }}>
          📡 Conexões Evolution
        </div>
        <div style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.5 }}>
          Gerenciar as conexões WhatsApp das instâncias. Quando uma instância cai (logout do celular),
          clique em "Conectar (QR)" e escaneie com o WhatsApp do número correspondente.
        </div>
      </div>

      <div style={{
        marginBottom: 18, padding: '14px 18px',
        background: '#FEF9C3', borderRadius: 12, border: '1px solid #FDE68A',
        fontSize: 13, color: '#713F12', lineHeight: 1.55,
      }}>
        💡 <strong>Sobre bloqueio do WhatsApp:</strong> Se a instância está "Conectada" mas envios para grupos
        dão timeout, é provável que o WhatsApp tenha limitado temporariamente o número por envio em massa.
        Espere 24-72h, ou tente o <strong>Reiniciar</strong> da instância.
      </div>

      {loading && instances.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: T.inkSoft }}>
          Carregando…
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14 }}>
          {instances.map(inst => (
            <InstanceCard key={inst.name} inst={inst} onAction={load} />
          ))}
        </div>
      )}
    </div>
  )
}
