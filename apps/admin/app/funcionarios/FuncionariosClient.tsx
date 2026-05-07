'use client'

import { useState, useTransition, useCallback } from 'react'

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface StaffMember {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: string
  department: string | null
  status: 'active' | 'inactive'
  avatar_color: string
  notes: string | null
  created_at: string
}

// ─── Cores ────────────────────────────────────────────────────────────────────
const accent = '#C4607A'
const green  = '#34C759'
const red    = '#FF3B30'
const gray   = '#8A8A8E'
const orange = '#FF9500'

const AVATAR_COLORS = [
  '#C4607A','#007AFF','#34C759','#FF9500','#AF52DE',
  '#FF3B30','#5AC8FA','#FFCC00','#FF6B35','#4CD964',
]

const ROLES = [
  'Admin', 'Gestor de Tráfego', 'Atendimento', 'Financeiro',
  'Designer', 'Copywriter', 'Desenvolvimento', 'Comercial',
  'RH', 'Marketing', 'Outro',
]

const DEPARTMENTS = [
  'Geral', 'Marketing', 'Vendas', 'Financeiro', 'Tecnologia',
  'Atendimento', 'Operações', 'RH',
]

// ─── Helper ───────────────────────────────────────────────────────────────────
function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

// ─── Modal ────────────────────────────────────────────────────────────────────
interface ModalProps {
  member?: StaffMember | null
  onClose: () => void
  onSaved: () => void
}

function Modal({ member, onClose, onSaved }: ModalProps) {
  const isEdit = !!member
  const [form, setForm] = useState({
    name:         member?.name         ?? '',
    email:        member?.email        ?? '',
    phone:        member?.phone        ?? '',
    role:         member?.role         ?? 'Funcionário',
    department:   member?.department   ?? '',
    status:       member?.status       ?? 'active' as 'active' | 'inactive',
    avatar_color: member?.avatar_color ?? '#C4607A',
    notes:        member?.notes        ?? '',
  })
  const [saving, startSave] = useTransition()
  const [error, setError] = useState('')

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function handleSave() {
    if (!form.name.trim()) { setError('Nome é obrigatório'); return }
    setError('')
    startSave(async () => {
      const res = await fetch('/api/staff', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? { id: member!.id, ...form } : form),
      })
      if (res.ok) { onSaved(); onClose() }
      else { const d = await res.json(); setError(d.error ?? 'Erro ao salvar') }
    })
  }

  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: gray, textTransform: 'uppercase' as const, letterSpacing: 0.3, marginBottom: 6, display: 'block' }
  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #E5E5EA', fontSize: 14, color: '#2D1B2E', background: '#FAFAFA', outline: 'none', boxSizing: 'border-box' as const }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#fff', borderRadius: 18, width: '100%', maxWidth: 520,
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
      }}>
        {/* Header */}
        <div style={{ padding: '22px 28px 18px', borderBottom: '1px solid #F0F0F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#2D1B2E' }}>
            {isEdit ? 'Editar funcionário' : 'Novo funcionário'}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: gray, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Avatar preview + cor */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%', background: form.avatar_color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>
              {form.name ? initials(form.name) : '?'}
            </div>
            <div>
              <div style={{ fontSize: 12, color: gray, marginBottom: 8 }}>Cor do avatar</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {AVATAR_COLORS.map(c => (
                  <div key={c} onClick={() => set('avatar_color', c)} style={{
                    width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer',
                    border: form.avatar_color === c ? `2px solid #2D1B2E` : '2px solid transparent',
                    boxSizing: 'border-box',
                  }} />
                ))}
              </div>
            </div>
          </div>

          {/* Nome */}
          <div>
            <label style={labelStyle}>Nome *</label>
            <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nome completo" />
          </div>

          {/* Email + Telefone */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>E-mail</label>
              <input style={inputStyle} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@empresa.com" />
            </div>
            <div>
              <label style={labelStyle}>Telefone / WhatsApp</label>
              <input style={inputStyle} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(11) 99999-0000" />
            </div>
          </div>

          {/* Cargo + Departamento */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Cargo / Função *</label>
              <select style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }} value={form.role} onChange={e => set('role', e.target.value)}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Departamento</label>
              <select style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }} value={form.department} onChange={e => set('department', e.target.value)}>
                <option value="">— Selecionar —</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {/* Status */}
          <div>
            <label style={labelStyle}>Status</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {(['active', 'inactive'] as const).map(s => (
                <button key={s} onClick={() => set('status', s)} style={{
                  padding: '8px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
                  background: form.status === s ? (s === 'active' ? green : red) : '#F0F0F5',
                  color: form.status === s ? '#fff' : gray,
                }}>
                  {s === 'active' ? 'Ativo' : 'Inativo'}
                </button>
              ))}
            </div>
          </div>

          {/* Observações */}
          <div>
            <label style={labelStyle}>Observações</label>
            <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Informações adicionais..." />
          </div>

          {error && (
            <div style={{ background: red + '15', color: red, fontSize: 13, padding: '10px 14px', borderRadius: 10, fontWeight: 500 }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 28px 22px', borderTop: '1px solid #F0F0F5', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '10px 22px', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            background: '#F0F0F5', border: 'none', color: '#2D1B2E',
          }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '10px 28px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
            background: saving ? gray : accent, border: 'none', color: '#fff',
          }}>
            {saving ? 'Salvando…' : isEdit ? 'Salvar' : 'Cadastrar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Delete confirm ───────────────────────────────────────────────────────────
function DeleteConfirm({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 380, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🗑</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#2D1B2E', marginBottom: 8 }}>Remover funcionário?</div>
        <div style={{ fontSize: 14, color: gray, marginBottom: 24 }}>
          <strong>{name}</strong> será removido permanentemente. Essa ação não pode ser desfeita.
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={onCancel} style={{ padding: '10px 22px', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', background: '#F0F0F5', border: 'none', color: '#2D1B2E' }}>Cancelar</button>
          <button onClick={onConfirm} style={{ padding: '10px 22px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', background: red, border: 'none', color: '#fff' }}>Remover</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function FuncionariosClient({ initial }: { initial: StaffMember[] }) {
  const [members, setMembers]   = useState<StaffMember[]>(initial)
  const [search, setSearch]     = useState('')
  const [filterRole, setRole]   = useState('Todos')
  const [filterStatus, setStatus] = useState('Todos')
  const [modal, setModal]       = useState<'new' | StaffMember | null>(null)
  const [deleting, setDeleting] = useState<StaffMember | null>(null)
  const [, startT]              = useTransition()

  const reload = useCallback(() => {
    startT(async () => {
      const r = await fetch('/api/staff')
      if (r.ok) setMembers(await r.json())
    })
  }, [])

  async function handleDelete(m: StaffMember) {
    await fetch('/api/staff', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: m.id }) })
    setDeleting(null)
    reload()
  }

  async function toggleStatus(m: StaffMember) {
    await fetch('/api/staff', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: m.id, status: m.status === 'active' ? 'inactive' : 'active' }),
    })
    reload()
  }

  // Filtros
  const allRoles = ['Todos', ...Array.from(new Set(members.map(m => m.role)))]
  const filtered = members.filter(m => {
    const q = search.toLowerCase()
    const matchQ = !q || m.name.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q) || m.role.toLowerCase().includes(q)
    const matchR = filterRole === 'Todos' || m.role === filterRole
    const matchS = filterStatus === 'Todos' || m.status === filterStatus
    return matchQ && matchR && matchS
  })

  const activeCount   = members.filter(m => m.status === 'active').length
  const inactiveCount = members.filter(m => m.status === 'inactive').length

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100, fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#2D1B2E' }}>Equipe</div>
          <div style={{ fontSize: 13, color: gray, marginTop: 4 }}>
            {activeCount} {activeCount === 1 ? 'funcionário ativo' : 'funcionários ativos'}
            {inactiveCount > 0 && ` · ${inactiveCount} inativo${inactiveCount > 1 ? 's' : ''}`}
          </div>
        </div>
        <button onClick={() => setModal('new')} style={{
          background: accent, color: '#fff', padding: '10px 20px',
          borderRadius: 10, fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          + Novo funcionário
        </button>
      </div>

      {/* Filtros */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '16px 20px', marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Busca */}
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: gray }}>🔍</span>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, e-mail ou cargo…"
            style={{ width: '100%', padding: '9px 12px 9px 36px', borderRadius: 10, border: '1px solid #E5E5EA', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#FAFAFA' }}
          />
        </div>

        {/* Cargo */}
        <select value={filterRole} onChange={e => setRole(e.target.value)} style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid #E5E5EA', fontSize: 13, background: '#FAFAFA', cursor: 'pointer', outline: 'none', color: '#2D1B2E' }}>
          {allRoles.map(r => <option key={r}>{r}</option>)}
        </select>

        {/* Status */}
        <div style={{ display: 'flex', gap: 6 }}>
          {['Todos', 'Ativos', 'Inativos'].map(s => (
            <button key={s} onClick={() => setStatus(s === 'Ativos' ? 'active' : s === 'Inativos' ? 'inactive' : 'Todos')} style={{
              padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
              background: filterStatus === (s === 'Ativos' ? 'active' : s === 'Inativos' ? 'inactive' : 'Todos') ? '#2D1B2E' : '#F0F0F5',
              color:      filterStatus === (s === 'Ativos' ? 'active' : s === 'Inativos' ? 'inactive' : 'Todos') ? '#fff' : gray,
            }}>{s}</button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '60px 24px', textAlign: 'center', color: gray, fontSize: 14 }}>
          {members.length === 0
            ? <><div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>Nenhum funcionário cadastrado ainda.<br /><span style={{ fontSize: 13 }}>Clique em "+ Novo funcionário" para começar.</span></>
            : 'Nenhum resultado para os filtros aplicados.'}
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #F0F0F5' }}>
                {['Funcionário', 'Cargo', 'Departamento', 'Contato', 'Status', 'Ações'].map(h => (
                  <th key={h} style={{ padding: '11px 20px', textAlign: 'left', fontSize: 11, color: gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m.id} style={{ borderBottom: '1px solid #F9F9FC', transition: 'background 0.1s' }}>
                  {/* Nome + avatar */}
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%', background: m.avatar_color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0,
                      }}>{initials(m.name)}</div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#2D1B2E' }}>{m.name}</div>
                        {m.notes && <div style={{ fontSize: 11, color: gray, marginTop: 1 }}>{m.notes.slice(0, 40)}{m.notes.length > 40 ? '…' : ''}</div>}
                      </div>
                    </div>
                  </td>

                  {/* Cargo */}
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#2D1B2E', background: '#F5F5F7', padding: '3px 10px', borderRadius: 20 }}>
                      {m.role}
                    </span>
                  </td>

                  {/* Departamento */}
                  <td style={{ padding: '14px 20px', fontSize: 13, color: m.department ? '#2D1B2E' : gray }}>
                    {m.department || '—'}
                  </td>

                  {/* Contato */}
                  <td style={{ padding: '14px 20px' }}>
                    {m.email && <div style={{ fontSize: 13, color: '#2D1B2E' }}>{m.email}</div>}
                    {m.phone && <div style={{ fontSize: 12, color: gray, marginTop: 2 }}>{m.phone}</div>}
                    {!m.email && !m.phone && <span style={{ color: gray, fontSize: 13 }}>—</span>}
                  </td>

                  {/* Status */}
                  <td style={{ padding: '14px 20px' }}>
                    <button onClick={() => toggleStatus(m)} style={{
                      fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20,
                      background: m.status === 'active' ? green + '18' : red + '18',
                      color: m.status === 'active' ? green : red,
                      border: 'none', cursor: 'pointer',
                    }}>
                      {m.status === 'active' ? '● Ativo' : '● Inativo'}
                    </button>
                  </td>

                  {/* Ações */}
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setModal(m)} style={{
                        padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        background: '#F0F0F5', border: 'none', color: '#2D1B2E',
                      }}>✏️ Editar</button>
                      <button onClick={() => setDeleting(m)} style={{
                        padding: '6px 10px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                        background: red + '15', border: 'none', color: red,
                      }}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modais */}
      {modal && (
        <Modal
          member={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={reload}
        />
      )}
      {deleting && (
        <DeleteConfirm
          name={deleting.name}
          onConfirm={() => handleDelete(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
