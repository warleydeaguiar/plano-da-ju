'use client'

import { useState, useMemo } from 'react'

const accent = '#C4607A'
const green  = '#34C759'
const orange = '#FF9500'
const red    = '#FF3B30'
const gray   = '#8A8A8E'

type User = {
  id: string
  full_name: string | null
  email: string
  hair_type: string | null
  subscription_type: string
  subscription_status: string
  subscription_expires_at: string | null
  quiz_completed_at: string | null
  plan_status: string
  created_at: string
}

const HAIR_LABEL: Record<string, string> = {
  liso: 'Liso', ondulado: 'Ondulado', cacheado: 'Cacheado', crespo: 'Crespo',
}

const SUB_LABEL: Record<string, { label: string; color: string }> = {
  active:    { label: 'Ativa',     color: green },
  cancelled: { label: 'Cancelada', color: red },
  expired:   { label: 'Expirada',  color: orange },
  pending:   { label: 'Pendente',  color: gray },
}

const SUB_TYPE_LABEL: Record<string, string> = {
  annual_card: 'Anual (cartão)',
  annual_pix:  'Anual (PIX)',
  none:        '—',
}

const PLAN_LABEL: Record<string, { label: string; color: string }> = {
  pending_photo: { label: 'Aguardando foto', color: orange },
  processing:    { label: 'Processando',     color: '#007AFF' },
  ready:         { label: 'Pronto',          color: green },
}

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#C4607A,#9B4560)',
  'linear-gradient(135deg,#34C759,#28A745)',
  'linear-gradient(135deg,#007AFF,#0056CC)',
  'linear-gradient(135deg,#AF52DE,#8B3DB8)',
  'linear-gradient(135deg,#FF9500,#CC7700)',
]

function gradientForId(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length]
}

function initials(name: string | null, email: string) {
  const n = name ?? email.split('@')[0]
  const parts = n.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '')).toUpperCase()
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return 'hoje'
  if (d === 1) return 'ontem'
  if (d < 30) return `há ${d} dias`
  if (d < 365) return `há ${Math.floor(d / 30)} meses`
  return `há ${Math.floor(d / 365)} anos`
}

export default function UsuariasClient({ initialUsers }: { initialUsers: User[] }) {
  const [search, setSearch]     = useState('')
  const [statusFilter, setStatus] = useState<string>('all')
  const [selectedUser, setSelected] = useState<User | null>(null)

  const filtered = useMemo(() => {
    let list = initialUsers
    if (statusFilter !== 'all') list = list.filter(u => u.subscription_status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(u =>
        (u.full_name ?? '').toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      )
    }
    return list
  }, [initialUsers, search, statusFilter])

  const counts = useMemo(() => ({
    all:       initialUsers.length,
    active:    initialUsers.filter(u => u.subscription_status === 'active').length,
    pending:   initialUsers.filter(u => u.subscription_status === 'pending').length,
    cancelled: initialUsers.filter(u => u.subscription_status === 'cancelled').length,
    expired:   initialUsers.filter(u => u.subscription_status === 'expired').length,
  }), [initialUsers])

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Main list */}
      <div style={{ flex: 1, padding: '32px 32px', overflowY: 'auto', minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#2D1B2E' }}>Usuárias</div>
            <div style={{ fontSize: 13, color: gray, marginTop: 3 }}>{initialUsers.length} usuárias cadastradas</div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {([
            { key: 'all',       label: `Todas (${counts.all})` },
            { key: 'active',    label: `Ativas (${counts.active})` },
            { key: 'pending',   label: `Pendentes (${counts.pending})` },
            { key: 'cancelled', label: `Canceladas (${counts.cancelled})` },
            { key: 'expired',   label: `Expiradas (${counts.expired})` },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatus(key)}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500,
                border: 'none', cursor: 'pointer',
                background: statusFilter === key ? accent : '#fff',
                color: statusFilter === key ? '#fff' : '#2D1B2E',
                boxShadow: statusFilter === key ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: gray }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou e-mail…"
            style={{
              width: '100%', padding: '10px 14px 10px 36px', borderRadius: 10,
              border: '1px solid #E0E0E8', fontSize: 14, outline: 'none',
              boxSizing: 'border-box', background: '#fff',
            }}
          />
        </div>

        {/* Table */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: gray, fontSize: 14 }}>
              Nenhuma usuária encontrada
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #F0F0F5' }}>
                  {['Usuária', 'Tipo de cabelo', 'Plano', 'Assinatura', 'Status', 'Cadastro'].map(h => (
                    <th key={h} style={{
                      padding: '10px 16px', textAlign: 'left', fontSize: 11,
                      color: gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const sub  = SUB_LABEL[u.subscription_status] ?? { label: u.subscription_status, color: gray }
                  const plan = PLAN_LABEL[u.plan_status] ?? { label: u.plan_status, color: gray }
                  return (
                    <tr
                      key={u.id}
                      onClick={() => setSelected(u)}
                      style={{
                        borderBottom: '1px solid #F9F9FC', cursor: 'pointer',
                        background: selectedUser?.id === u.id ? accent + '08' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                            background: gradientForId(u.id),
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700, color: '#fff',
                          }}>
                            {initials(u.full_name, u.email)}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#2D1B2E' }}>
                              {u.full_name ?? u.email.split('@')[0]}
                            </div>
                            <div style={{ fontSize: 11, color: gray }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#2D1B2E' }}>
                        {u.hair_type ? HAIR_LABEL[u.hair_type] ?? u.hair_type : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                          background: plan.color + '18', color: plan.color,
                        }}>{plan.label}</span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#2D1B2E' }}>
                        {SUB_TYPE_LABEL[u.subscription_type] ?? u.subscription_type}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                          background: sub.color + '18', color: sub.color,
                        }}>{sub.label}</span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: gray }}>
                        {timeAgo(u.created_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Side panel */}
      {selectedUser && (
        <div style={{
          width: 320, flexShrink: 0, background: '#fff', borderLeft: '1px solid #F0F0F5',
          overflowY: 'auto', padding: '24px 20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#2D1B2E' }}>Detalhes</div>
            <button
              onClick={() => setSelected(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: gray, padding: 0 }}
            >✕</button>
          </div>

          {/* Avatar + name */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', margin: '0 auto 10px',
              background: gradientForId(selectedUser.id),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 700, color: '#fff',
            }}>
              {initials(selectedUser.full_name, selectedUser.email)}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#2D1B2E' }}>
              {selectedUser.full_name ?? 'Sem nome'}
            </div>
            <div style={{ fontSize: 12, color: gray, marginTop: 2 }}>{selectedUser.email}</div>
          </div>

          {/* Info rows */}
          {[
            { label: 'ID',             value: selectedUser.id.slice(0, 16) + '…' },
            { label: 'Tipo de cabelo', value: selectedUser.hair_type ? HAIR_LABEL[selectedUser.hair_type] ?? selectedUser.hair_type : '—' },
            { label: 'Assinatura',     value: SUB_TYPE_LABEL[selectedUser.subscription_type] ?? selectedUser.subscription_type },
            { label: 'Status',         value: (SUB_LABEL[selectedUser.subscription_status] ?? { label: selectedUser.subscription_status }).label },
            { label: 'Plano',          value: (PLAN_LABEL[selectedUser.plan_status] ?? { label: selectedUser.plan_status }).label },
            { label: 'Cadastro',       value: new Date(selectedUser.created_at).toLocaleDateString('pt-BR') },
            {
              label: 'Expira em',
              value: selectedUser.subscription_expires_at
                ? new Date(selectedUser.subscription_expires_at).toLocaleDateString('pt-BR')
                : '—',
            },
            {
              label: 'Quiz',
              value: selectedUser.quiz_completed_at
                ? `Concluído em ${new Date(selectedUser.quiz_completed_at).toLocaleDateString('pt-BR')}`
                : 'Não concluído',
            },
          ].map(({ label, value }) => (
            <div key={label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              padding: '10px 0', borderBottom: '1px solid #F5F5F7', gap: 8,
            }}>
              <div style={{ fontSize: 12, color: gray, fontWeight: 500, flexShrink: 0 }}>{label}</div>
              <div style={{ fontSize: 12, color: '#2D1B2E', fontWeight: 500, textAlign: 'right', wordBreak: 'break-all' }}>{value}</div>
            </div>
          ))}

          <a
            href={`/planos?user=${selectedUser.id}`}
            style={{
              display: 'block', marginTop: 16, padding: '10px 16px', textAlign: 'center',
              background: accent, color: '#fff', borderRadius: 10, fontSize: 13,
              fontWeight: 600, textDecoration: 'none',
            }}
          >
            Ver plano capilar →
          </a>
        </div>
      )}
    </div>
  )
}
