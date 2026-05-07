'use client'

import { useState, useTransition } from 'react'

type Group = {
  id: string
  name: string
  jid: string | null
  invite_link: string
  invite_code: string
  member_count: number
  capacity: number
  status: 'active' | 'full' | 'archived'
  is_receiving: boolean
  last_synced_at: string | null
  created_at: string
}

const accent  = '#C4607A'
const green   = '#34C759'
const orange  = '#FF9500'
const red     = '#FF3B30'

function badge(g: Group) {
  if (g.status === 'full')     return { label: 'Cheio', color: red }
  if (g.status === 'archived') return { label: 'Arquivado', color: '#8A8A8E' }
  if (g.is_receiving)          return { label: 'Recebendo', color: green }
  return { label: 'Pausado', color: orange }
}

export default function GerenciarClient({ initialGroups }: { initialGroups: Group[] }) {
  const [groups, setGroups] = useState<Group[]>(initialGroups)
  const [showForm, setShowForm] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [groupName, setGroupName] = useState('')
  const [adding, setAdding] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [, startTransition] = useTransition()

  const visible = showArchived ? groups : groups.filter(g => g.status !== 'archived')

  async function addGroup() {
    if (!inviteLink.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/grupos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_link: inviteLink.trim(), name: groupName.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setGroups(prev => [data, ...prev])
      setInviteLink('')
      setGroupName('')
      setShowForm(false)
    } catch (err: any) {
      alert('Erro ao adicionar: ' + err.message)
    } finally {
      setAdding(false)
    }
  }

  async function toggleReceiving(g: Group) {
    const next = !g.is_receiving
    startTransition(() => {
      setGroups(prev => prev.map(x => x.id === g.id ? { ...x, is_receiving: next } : x))
    })
    const res = await fetch(`/api/grupos/${g.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_receiving: next }),
    })
    if (!res.ok) {
      setGroups(prev => prev.map(x => x.id === g.id ? { ...x, is_receiving: !next } : x))
      alert('Erro ao atualizar grupo')
    }
  }

  async function archiveGroup(g: Group) {
    if (!confirm(`Arquivar "${g.name}"? Ele não aparecerá mais na distribuição.`)) return
    startTransition(() => {
      setGroups(prev => prev.map(x => x.id === g.id ? { ...x, status: 'archived', is_receiving: false } : x))
    })
    await fetch(`/api/grupos/${g.id}`, { method: 'DELETE' })
  }

  async function syncAll() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/grupos/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.detail)
      setSyncResult(`✓ ${data.synced} de ${data.total} grupos sincronizados`)
      // Reload groups
      const g2 = await fetch('/api/grupos')
      const updated = await g2.json()
      if (Array.isArray(updated)) setGroups(updated)
    } catch (err: any) {
      setSyncResult('✗ ' + err.message)
    } finally {
      setSyncing(false)
    }
  }

  const publicLink = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/g/entrar`
    : 'plano.julianecost.com/g/entrar'

  return (
    <div style={{ padding: '32px 40px', maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#2D1B2E' }}>Gerenciar Grupos</div>
          <div style={{ fontSize: 13, color: '#8A8A8E', marginTop: 4 }}>
            Adicione grupos e controle quem está recebendo membros
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={syncAll}
            disabled={syncing}
            style={{
              background: '#F5F5F7', color: '#2D1B2E', border: 'none', cursor: syncing ? 'default' : 'pointer',
              padding: '9px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600, opacity: syncing ? 0.6 : 1,
            }}
          >
            {syncing ? '⏳ Sincronizando…' : '🔄 Sincronizar'}
          </button>
          <button
            onClick={() => setShowForm(true)}
            style={{
              background: accent, color: '#fff', border: 'none', cursor: 'pointer',
              padding: '9px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600,
            }}
          >
            + Adicionar grupo
          </button>
        </div>
      </div>

      {/* Sync result */}
      {syncResult && (
        <div style={{
          padding: '10px 16px', borderRadius: 10, marginBottom: 20,
          background: syncResult.startsWith('✓') ? green + '15' : red + '15',
          color: syncResult.startsWith('✓') ? green : red,
          fontSize: 13, fontWeight: 600,
        }}>
          {syncResult}
        </div>
      )}

      {/* Link público */}
      <div style={{
        background: accent + '12', border: `1px solid ${accent}30`,
        borderRadius: 12, padding: '14px 20px', marginBottom: 28,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ fontSize: 20 }}>🔗</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#2D1B2E', marginBottom: 2 }}>Link público de distribuição</div>
          <code style={{ fontSize: 13, color: accent }}>{publicLink}</code>
        </div>
        <button
          onClick={() => navigator.clipboard.writeText(`https://${publicLink}`)}
          style={{ background: accent, color: '#fff', border: 'none', cursor: 'pointer', padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}
        >
          Copiar
        </button>
      </div>

      {/* Form adicionar */}
      {showForm && (
        <div style={{
          background: '#fff', borderRadius: 14, border: `1px solid ${accent}40`,
          padding: '20px 24px', marginBottom: 24,
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#2D1B2E', marginBottom: 16 }}>Novo grupo</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#8A8A8E', display: 'block', marginBottom: 6 }}>
                LINK DE CONVITE *
              </label>
              <input
                type="text"
                placeholder="https://chat.whatsapp.com/XXXXXXXX"
                value={inviteLink}
                onChange={e => setInviteLink(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14,
                  border: '1px solid #E0E0E8', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#8A8A8E', display: 'block', marginBottom: 6 }}>
                NOME DO GRUPO (opcional — preenchido automaticamente via Evolution)
              </label>
              <input
                type="text"
                placeholder="Ex: Plano da Ju — Grupo 1"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14,
                  border: '1px solid #E0E0E8', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowForm(false); setInviteLink(''); setGroupName('') }}
                style={{ background: '#F5F5F7', color: '#2D1B2E', border: 'none', cursor: 'pointer', padding: '9px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600 }}
              >
                Cancelar
              </button>
              <button
                onClick={addGroup}
                disabled={adding || !inviteLink.trim()}
                style={{
                  background: accent, color: '#fff', border: 'none', cursor: adding ? 'default' : 'pointer',
                  padding: '9px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                  opacity: adding || !inviteLink.trim() ? 0.6 : 1,
                }}
              >
                {adding ? 'Adicionando…' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filtro arquivados */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <label style={{ fontSize: 13, color: '#8A8A8E', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
          Mostrar arquivados
        </label>
      </div>

      {/* Lista */}
      {visible.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, padding: '40px 24px', textAlign: 'center', color: '#8A8A8E', fontSize: 14 }}>
          Nenhum grupo cadastrado. Clique em "Adicionar grupo" para começar.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visible.map(g => {
            const b = badge(g)
            const fill = Math.round((g.member_count / (g.capacity ?? 1024)) * 100)
            return (
              <div key={g.id} style={{
                background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)',
                padding: '16px 20px', opacity: g.status === 'archived' ? 0.5 : 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#2D1B2E' }}>{g.name}</div>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                        background: b.color + '18', color: b.color,
                      }}>{b.label}</span>
                    </div>
                    {g.jid && (
                      <div style={{ fontSize: 11, color: '#8A8A8E', marginBottom: 8, fontFamily: 'monospace' }}>{g.jid}</div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: '#F0F0F5', borderRadius: 3, maxWidth: 200 }}>
                        <div style={{
                          height: '100%', borderRadius: 3, width: `${Math.min(fill, 100)}%`,
                          background: fill >= 95 ? red : fill >= 80 ? orange : green,
                        }} />
                      </div>
                      <span style={{ fontSize: 12, color: '#8A8A8E' }}>
                        {g.member_count.toLocaleString('pt-BR')} / {g.capacity ?? 1024} ({fill}%)
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  {g.status !== 'archived' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 20 }}>
                      {/* Toggle is_receiving */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: '#2D1B2E', fontWeight: 500 }}>
                        <div
                          onClick={() => toggleReceiving(g)}
                          style={{
                            width: 44, height: 24, borderRadius: 12, cursor: 'pointer', transition: 'background .2s',
                            background: g.is_receiving ? green : '#D0D0D8', position: 'relative',
                          }}
                        >
                          <div style={{
                            position: 'absolute', top: 3, left: g.is_receiving ? 22 : 3,
                            width: 18, height: 18, borderRadius: '50%', background: '#fff',
                            transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                          }} />
                        </div>
                        {g.is_receiving ? 'Recebendo' : 'Pausado'}
                      </label>

                      <a
                        href={g.invite_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 12, color: accent, fontWeight: 600, textDecoration: 'none' }}
                      >
                        Abrir →
                      </a>

                      <button
                        onClick={() => archiveGroup(g)}
                        style={{
                          fontSize: 12, color: red, background: 'none', border: 'none',
                          cursor: 'pointer', fontWeight: 600, padding: '4px 0',
                        }}
                      >
                        Arquivar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
