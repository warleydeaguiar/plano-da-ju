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

type DiscoveredGroup = {
  id: string       // JID
  subject: string
  size: number
  instanceName: string
  already_saved: boolean
}

const accent  = '#C4607A'
const green   = '#34C759'
const orange  = '#FF9500'
const red     = '#FF3B30'
const gray    = '#8A8A8E'

function badge(g: Group) {
  if (g.status === 'full')     return { label: 'Cheio', color: red }
  if (g.status === 'archived') return { label: 'Arquivado', color: gray }
  if (g.is_receiving)          return { label: 'Recebendo', color: green }
  return { label: 'Pausado', color: orange }
}

export default function GerenciarClient({ initialGroups }: { initialGroups: Group[] }) {
  const [groups, setGroups]             = useState<Group[]>(initialGroups)
  const [showForm, setShowForm]         = useState(false)
  const [inviteLink, setInviteLink]     = useState('')
  const [groupName, setGroupName]       = useState('')
  const [adding, setAdding]             = useState(false)
  const [syncing, setSyncing]           = useState(false)
  const [syncResult, setSyncResult]     = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [, startTransition]             = useTransition()

  // Discover
  const [discovering, setDiscovering]       = useState(false)
  const [discoveredGroups, setDiscoveredGroups] = useState<DiscoveredGroup[] | null>(null)
  const [selectedJids, setSelectedJids]     = useState<Set<string>>(new Set())
  const [importing, setImporting]           = useState(false)
  const [importResult, setImportResult]     = useState<string | null>(null)

  const visible = showArchived ? groups : groups.filter(g => g.status !== 'archived')

  // ── Adicionar manualmente ──
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

  // ── Toggle recebendo ──
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

  // ── Arquivar ──
  async function archiveGroup(g: Group) {
    if (!confirm(`Arquivar "${g.name}"? Ele não aparecerá mais na distribuição.`)) return
    startTransition(() => {
      setGroups(prev => prev.map(x => x.id === g.id ? { ...x, status: 'archived', is_receiving: false } : x))
    })
    await fetch(`/api/grupos/${g.id}`, { method: 'DELETE' })
  }

  // ── Sincronizar contagens ──
  async function syncAll() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/grupos/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.detail)
      setSyncResult(`✓ ${data.synced} de ${data.total} grupos sincronizados`)
      const g2 = await fetch('/api/grupos')
      const updated = await g2.json()
      if (Array.isArray(updated)) setGroups(updated)
    } catch (err: any) {
      setSyncResult('✗ ' + err.message)
    } finally {
      setSyncing(false)
    }
  }

  // ── Descobrir grupos do Evolution ──
  async function discoverGroups() {
    setDiscovering(true)
    setDiscoveredGroups(null)
    setSelectedJids(new Set())
    setImportResult(null)
    try {
      const res = await fetch('/api/grupos/discover')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao descobrir grupos')
      setDiscoveredGroups(data)
      // Pré-seleciona todos os novos
      setSelectedJids(new Set(data.filter((g: DiscoveredGroup) => !g.already_saved).map((g: DiscoveredGroup) => g.id)))
    } catch (err: any) {
      alert('Erro: ' + err.message)
    } finally {
      setDiscovering(false)
    }
  }

  function toggleSelected(jid: string) {
    setSelectedJids(prev => {
      const next = new Set(prev)
      if (next.has(jid)) next.delete(jid)
      else next.add(jid)
      return next
    })
  }

  // ── Importar selecionados ──
  async function importSelected() {
    if (!selectedJids.size || !discoveredGroups) return
    setImporting(true)
    setImportResult(null)
    const toImport = discoveredGroups.filter(g => selectedJids.has(g.id) && !g.already_saved)
    let imported = 0
    let errors = 0
    for (const g of toImport) {
      try {
        const res = await fetch('/api/grupos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jid: g.id, name: g.subject, is_receiving: false }),
        })
        if (res.ok) {
          const data = await res.json()
          setGroups(prev => [data, ...prev])
          setDiscoveredGroups(prev => prev ? prev.map(x => x.id === g.id ? { ...x, already_saved: true } : x) : prev)
          imported++
        } else {
          errors++
        }
      } catch { errors++ }
    }
    setImportResult(`✓ ${imported} grupos importados${errors > 0 ? ` (${errors} erros)` : ''}`)
    setSelectedJids(new Set())
    setImporting(false)
  }

  const publicLink = typeof window !== 'undefined' && window.location.origin
    ? `${window.location.origin.replace('admin.', 'plano.')}/g/entrar`
    : 'plano.julianecost.com/g/entrar'

  return (
    <div style={{ padding: '32px 40px', maxWidth: 980 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#2D1B2E' }}>Gerenciar Grupos</div>
          <div style={{ fontSize: 13, color: gray, marginTop: 4 }}>
            Adicione grupos e controle quem está recebendo membros
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={discoverGroups}
            disabled={discovering}
            style={{
              background: '#F0F0F5', color: '#2D1B2E', border: 'none', cursor: discovering ? 'default' : 'pointer',
              padding: '9px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600, opacity: discovering ? 0.6 : 1,
            }}
          >
            {discovering ? '🔍 Buscando…' : '🔍 Descobrir grupos'}
          </button>
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
            style={{ background: accent, color: '#fff', border: 'none', cursor: 'pointer', padding: '9px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600 }}
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
        }}>{syncResult}</div>
      )}

      {/* ── Painel Descobrir grupos ── */}
      {discoveredGroups !== null && (
        <div style={{
          background: '#fff', borderRadius: 14, border: `1px solid ${accent}30`,
          padding: '20px 24px', marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#2D1B2E' }}>
                🔍 Grupos encontrados no Evolution ({discoveredGroups.length})
              </div>
              <div style={{ fontSize: 12, color: gray, marginTop: 2 }}>
                Selecione os grupos de promoção para importar
              </div>
            </div>
            <button
              onClick={() => setDiscoveredGroups(null)}
              style={{ background: '#F5F5F7', border: 'none', cursor: 'pointer', padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#2D1B2E' }}
            >
              Fechar
            </button>
          </div>

          {importResult && (
            <div style={{
              padding: '10px 14px', borderRadius: 9, marginBottom: 14,
              background: green + '15', color: green, fontSize: 13, fontWeight: 600,
            }}>{importResult}</div>
          )}

          {discoveredGroups.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: gray, fontSize: 13 }}>
              Nenhum grupo encontrado. Verifique se algum número está conectado (status "open").
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto', marginBottom: 16 }}>
                {discoveredGroups.map(g => (
                  <label key={g.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                    borderRadius: 10, cursor: g.already_saved ? 'default' : 'pointer',
                    background: g.already_saved ? '#F5F5F7' : selectedJids.has(g.id) ? accent + '10' : '#FAFAFA',
                    border: `1px solid ${g.already_saved ? '#E5E5EA' : selectedJids.has(g.id) ? accent + '40' : '#E5E5EA'}`,
                    opacity: g.already_saved ? 0.6 : 1,
                  }}>
                    <input
                      type="checkbox"
                      checked={g.already_saved || selectedJids.has(g.id)}
                      disabled={g.already_saved}
                      onChange={() => toggleSelected(g.id)}
                      style={{ width: 16, height: 16, flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#2D1B2E', marginBottom: 1 }}>{g.subject}</div>
                      <div style={{ fontSize: 11, color: gray, fontFamily: 'monospace' }}>{g.id}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#2D1B2E' }}>{g.size.toLocaleString('pt-BR')} membros</div>
                      <div style={{ fontSize: 10, color: gray }}>via {g.instanceName}</div>
                    </div>
                    {g.already_saved && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: green, background: green + '15', padding: '2px 8px', borderRadius: 12 }}>
                        Cadastrado
                      </span>
                    )}
                  </label>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 13, color: gray }}>
                  {selectedJids.size} selecionados para importar
                </div>
                <button
                  onClick={importSelected}
                  disabled={importing || selectedJids.size === 0}
                  style={{
                    background: selectedJids.size === 0 ? '#E5E5EA' : accent, color: selectedJids.size === 0 ? gray : '#fff',
                    border: 'none', cursor: importing || selectedJids.size === 0 ? 'default' : 'pointer',
                    padding: '9px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                  }}
                >
                  {importing ? 'Importando…' : `Importar ${selectedJids.size} grupos`}
                </button>
              </div>
            </>
          )}
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
          <code style={{ fontSize: 13, color: accent }}>plano.julianecost.com/g/entrar</code>
        </div>
        <button
          onClick={() => navigator.clipboard.writeText('https://plano.julianecost.com/g/entrar')}
          style={{ background: accent, color: '#fff', border: 'none', cursor: 'pointer', padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}
        >
          Copiar
        </button>
      </div>

      {/* Form adicionar manual */}
      {showForm && (
        <div style={{
          background: '#fff', borderRadius: 14, border: `1px solid ${accent}40`,
          padding: '20px 24px', marginBottom: 24,
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#2D1B2E', marginBottom: 16 }}>Novo grupo (manual)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: gray, display: 'block', marginBottom: 6 }}>
                LINK DE CONVITE *
              </label>
              <input
                type="text"
                placeholder="https://chat.whatsapp.com/XXXXXXXX"
                value={inviteLink}
                onChange={e => setInviteLink(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14, border: '1px solid #E0E0E8', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: gray, display: 'block', marginBottom: 6 }}>
                NOME (opcional — preenchido automaticamente via Evolution)
              </label>
              <input
                type="text"
                placeholder="Ex: Plano da Ju — Grupo 1"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14, border: '1px solid #E0E0E8', outline: 'none', boxSizing: 'border-box' }}
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
        <label style={{ fontSize: 13, color: gray, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
          Mostrar arquivados
        </label>
      </div>

      {/* Lista */}
      {visible.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, padding: '40px 24px', textAlign: 'center', color: gray, fontSize: 14 }}>
          Nenhum grupo cadastrado. Clique em "Descobrir grupos" para importar do Evolution, ou "Adicionar grupo" para inserir manualmente.
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
                      <div style={{ fontSize: 11, color: gray, marginBottom: 8, fontFamily: 'monospace' }}>{g.jid}</div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: '#F0F0F5', borderRadius: 3, maxWidth: 200 }}>
                        <div style={{
                          height: '100%', borderRadius: 3, width: `${Math.min(fill, 100)}%`,
                          background: fill >= 95 ? red : fill >= 80 ? orange : green,
                        }} />
                      </div>
                      <span style={{ fontSize: 12, color: gray }}>
                        {g.member_count.toLocaleString('pt-BR')} / {g.capacity ?? 1024} ({fill}%)
                      </span>
                    </div>
                  </div>

                  {g.status !== 'archived' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 20 }}>
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

                      {g.invite_link && (
                        <a
                          href={g.invite_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 12, color: accent, fontWeight: 600, textDecoration: 'none' }}
                        >
                          Abrir →
                        </a>
                      )}

                      <button
                        onClick={() => archiveGroup(g)}
                        style={{ fontSize: 12, color: red, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: '4px 0' }}
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
