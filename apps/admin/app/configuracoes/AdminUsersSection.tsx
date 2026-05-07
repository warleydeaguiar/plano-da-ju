'use client'

import { useState, useEffect, useTransition } from 'react'

const accent = '#C4607A'
const green  = '#34C759'
const red    = '#FF3B30'
const gray   = '#8A8A8E'

interface AdminUser { id: string; email: string; name: string; created_at: string }

export default function AdminUsersSection() {
  const [users, setUsers]       = useState<AdminUser[]>([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')
  const [saving, start]         = useTransition()
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  function load() {
    fetch('/api/admin-users').then(r => r.json()).then(setUsers).catch(() => {})
  }

  function handleAdd() {
    if (!email || !password) { setError('Preencha e-mail e senha'); return }
    if (password.length < 6)  { setError('Senha mínimo 6 caracteres'); return }
    setError('')
    start(async () => {
      const res = await fetch('/api/admin-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? 'Erro ao criar'); return }
      setSuccess(`${email} adicionado com sucesso!`)
      setName(''); setEmail(''); setPassword('')
      setShowForm(false)
      load()
      setTimeout(() => setSuccess(''), 4000)
    })
  }

  async function handleDelete(u: AdminUser) {
    if (!confirm(`Remover ${u.email}?`)) return
    setDeleting(u.id)
    await fetch('/api/admin-users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id }) })
    setDeleting(null)
    load()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 13px', borderRadius: 9,
    border: '1px solid #E5E5EA', fontSize: 13, outline: 'none',
    background: '#FAFAFA', color: '#2D1B2E', boxSizing: 'border-box',
  }

  return (
    <div>
      {/* Lista */}
      {users.map(u => (
        <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F5F5F7' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {(u.name ?? u.email).charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#2D1B2E' }}>{u.name}</div>
              <div style={{ fontSize: 11, color: gray }}>{u.email}</div>
            </div>
          </div>
          <button onClick={() => handleDelete(u)} disabled={deleting === u.id} style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 12,
            color: red, fontWeight: 600, padding: '4px 8px', borderRadius: 6,
          }}>
            {deleting === u.id ? '…' : 'Remover'}
          </button>
        </div>
      ))}

      {/* Sucesso */}
      {success && (
        <div style={{ marginTop: 12, padding: '10px 14px', background: green + '15', color: green, borderRadius: 9, fontSize: 13, fontWeight: 500 }}>
          ✓ {success}
        </div>
      )}

      {/* Formulário */}
      {showForm ? (
        <div style={{ marginTop: 16, padding: '16px', background: '#F9F9FC', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input style={inputStyle} placeholder="Nome" value={name} onChange={e => setName(e.target.value)} />
          <input style={inputStyle} type="email" placeholder="E-mail *" value={email} onChange={e => setEmail(e.target.value)} />
          <input style={inputStyle} type="password" placeholder="Senha (mín. 6 caracteres) *" value={password} onChange={e => setPassword(e.target.value)} />
          {error && <div style={{ fontSize: 12, color: red, fontWeight: 500 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleAdd} disabled={saving} style={{ padding: '9px 20px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: saving ? gray : accent, border: 'none', color: '#fff' }}>
              {saving ? 'Criando…' : 'Criar acesso'}
            </button>
            <button onClick={() => { setShowForm(false); setError('') }} style={{ padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#E5E5EA', border: 'none', color: '#2D1B2E' }}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} style={{ marginTop: 14, padding: '9px 18px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#F0F0F5', border: 'none', color: '#2D1B2E' }}>
          + Adicionar administrador
        </button>
      )}
    </div>
  )
}
