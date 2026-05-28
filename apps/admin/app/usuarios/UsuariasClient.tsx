'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'

const accent = '#BE185D'
const green  = '#22A06B'
const orange = '#D97706'
const red    = '#DC2626'
const blue   = '#2563EB'
const gray   = '#7C6B7E'
const purple = '#9333EA'

type User = {
  id: string
  full_name: string | null
  email: string
  phone: string | null
  hair_type: string | null
  porosity: string | null
  chemical_history: string | null
  main_problems: string[] | null
  hair_length_cm: number | null
  quiz_answers: Record<string, unknown> | null
  subscription_type: string
  subscription_status: string
  subscription_expires_at: string | null
  subscription_activated_at: string | null
  quiz_completed_at: string | null
  plan_status: string
  plan_requested_at: string | null
  plan_released_at: string | null
  photo_url: string | null
  photo_taken_at: string | null
  avatar_url: string | null
  is_gift: boolean
  admin_notes: string | null
  refunded_at: string | null
  pagarme_subscription_id: string | null
  pagarme_charge_id: string | null
  created_at: string
  updated_at: string | null
}

const HAIR_LABEL: Record<string, string> = {
  liso: 'Liso', ondulado: 'Ondulado', cacheado: 'Cacheado', crespo: 'Crespo',
}

const SUB_LABEL: Record<string, { label: string; color: string }> = {
  active:    { label: 'Ativa',     color: green   },
  cancelled: { label: 'Cancelada', color: red     },
  refunded:  { label: 'Reembolso', color: '#8B5CF6' },
  expired:   { label: 'Expirada',  color: orange  },
  pending:   { label: 'Pendente',  color: gray    },
}

// Plano de 90 dias (trimestral). Os ids 'annual_*' são legados — mantidos como
// identificador interno; o rótulo exibido reflete o plano atual de 90 dias.
const SUB_TYPE_LABEL: Record<string, string> = {
  annual_card:    '90 dias (cartão)',
  annual_pix:     '90 dias (PIX)',
  quarterly_card: '90 dias (cartão)',
  quarterly_pix:  '90 dias (PIX)',
  one_time_card:  'Único (cartão)',
  none:           '—',
}

const PLAN_LABEL: Record<string, { label: string; color: string }> = {
  pending_photo: { label: 'Aguardando foto', color: orange },
  processing:    { label: 'Processando',     color: blue   },
  ready:         { label: 'Pronto',          color: green  },
}

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#BE185D,#9D174D)',
  'linear-gradient(135deg,#22A06B,#28A745)',
  'linear-gradient(135deg,#2563EB,#0056CC)',
  'linear-gradient(135deg,#9333EA,#8B3DB8)',
  'linear-gradient(135deg,#D97706,#CC7700)',
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
function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}
function isoForDateInput(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toISOString().slice(0, 10)
}

export default function UsuariasClient({ initialUsers }: { initialUsers: User[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatus] = useState<string>('all')
  const [giftFilter, setGiftFilter] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [, startTransition] = useTransition()

  const selected = useMemo(() => initialUsers.find(u => u.id === selectedId) ?? null, [initialUsers, selectedId])

  const filtered = useMemo(() => {
    let list = initialUsers
    if (statusFilter !== 'all') list = list.filter(u => u.subscription_status === statusFilter)
    if (giftFilter) list = list.filter(u => u.is_gift)
    if (search.trim()) {
      const q = search.toLowerCase().replace(/\D/g, '')
      const qText = search.toLowerCase()
      list = list.filter(u =>
        (u.full_name ?? '').toLowerCase().includes(qText) ||
        u.email.toLowerCase().includes(qText) ||
        (q && u.phone?.replace(/\D/g, '').includes(q))
      )
    }
    return list
  }, [initialUsers, search, statusFilter, giftFilter])

  const counts = useMemo(() => ({
    all:       initialUsers.length,
    active:    initialUsers.filter(u => u.subscription_status === 'active').length,
    pending:   initialUsers.filter(u => u.subscription_status === 'pending').length,
    cancelled: initialUsers.filter(u => u.subscription_status === 'cancelled').length,
    refunded:  initialUsers.filter(u => u.subscription_status === 'refunded').length,
    expired:   initialUsers.filter(u => u.subscription_status === 'expired').length,
    gifts:     initialUsers.filter(u => u.is_gift).length,
  }), [initialUsers])

  function refresh() {
    setSelectedId(null)
    startTransition(() => router.refresh())
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ flex: 1, padding: '32px 32px', overflowY: 'auto', minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#2A1E2C' }}>Usuárias</div>
            <div style={{ fontSize: 13, color: gray, marginTop: 3 }}>
              {initialUsers.length} cadastradas{counts.gifts > 0 ? ` · ${counts.gifts} presentes 🎁` : ''}
            </div>
          </div>
          <button onClick={() => setShowCreate(true)} style={{
            background: accent, color: '#fff', border: 'none', borderRadius: 10,
            padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(196,96,122,0.30)',
          }}>+ Cadastrar usuária</button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {([
            { key: 'all',       label: `Todas (${counts.all})` },
            { key: 'active',    label: `Ativas (${counts.active})` },
            { key: 'pending',   label: `Pendentes (${counts.pending})` },
            { key: 'cancelled', label: `Canceladas (${counts.cancelled})` },
            { key: 'refunded',  label: `Reembolso (${counts.refunded})` },
            { key: 'expired',   label: `Expiradas (${counts.expired})` },
          ] as const).map(({ key, label }) => (
            <button key={key} onClick={() => setStatus(key)} style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500,
              border: 'none', cursor: 'pointer',
              background: statusFilter === key ? accent : '#fff',
              color: statusFilter === key ? '#fff' : '#2A1E2C',
              boxShadow: statusFilter === key ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
            }}>{label}</button>
          ))}
          {counts.gifts > 0 && (
            <button onClick={() => setGiftFilter(g => !g)} style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500,
              border: 'none', cursor: 'pointer',
              background: giftFilter ? purple : '#fff',
              color: giftFilter ? '#fff' : purple,
              boxShadow: giftFilter ? 'none' : `0 0 0 1px ${purple}40`,
            }}>🎁 Presentes ({counts.gifts})</button>
          )}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: gray }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, email ou telefone…"
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
                <tr style={{ background: '#FFF7EE', borderBottom: '1px solid #F0F0F5' }}>
                  {['Usuária', 'Tipo cabelo', 'Plano', 'Assinatura', 'Status', 'Expira', 'Cadastro'].map(h => (
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
                      onClick={() => setSelectedId(u.id)}
                      style={{
                        borderBottom: '1px solid #F9F9FC', cursor: 'pointer',
                        background: selectedId === u.id ? accent + '08' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                            background: gradientForId(u.id),
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700, color: '#fff',
                          }}>{initials(u.full_name, u.email)}</div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#2A1E2C', display: 'flex', alignItems: 'center', gap: 5 }}>
                              {u.full_name ?? u.email.split('@')[0]}
                              {u.is_gift && <span title="Presente" style={{ fontSize: 12 }}>🎁</span>}
                            </div>
                            <div style={{ fontSize: 11, color: gray }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#2A1E2C' }}>
                        {u.hair_type ? HAIR_LABEL[u.hair_type] ?? u.hair_type : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                          background: plan.color + '18', color: plan.color,
                        }}>{plan.label}</span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#2A1E2C' }}>
                        {SUB_TYPE_LABEL[u.subscription_type] ?? u.subscription_type}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                          background: sub.color + '18', color: sub.color,
                        }}>{sub.label}</span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: gray }}>
                        {fmtDate(u.subscription_expires_at)}
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
      {selected && (
        <EditPanel
          user={selected}
          onClose={() => setSelectedId(null)}
          onChanged={refresh}
        />
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); refresh() }}
        />
      )}
    </div>
  )
}

// ─── EditPanel ───────────────────────────────────────────────────
function EditPanel({ user, onClose, onChanged }: { user: User; onClose: () => void; onChanged: () => void }) {
  const [draft, setDraft] = useState({
    email: user.email,
    full_name: user.full_name ?? '',
    phone: user.phone ?? '',
    subscription_status: user.subscription_status,
    subscription_expires_at: isoForDateInput(user.subscription_expires_at),
    is_gift: user.is_gift,
    admin_notes: user.admin_notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const dirty = useMemo(() => (
    draft.email !== user.email
    || draft.full_name !== (user.full_name ?? '')
    || draft.phone !== (user.phone ?? '')
    || draft.subscription_status !== user.subscription_status
    || draft.subscription_expires_at !== isoForDateInput(user.subscription_expires_at)
    || draft.is_gift !== user.is_gift
    || draft.admin_notes !== (user.admin_notes ?? '')
  ), [draft, user])

  async function save() {
    setSaving(true); setMsg(null)
    const body: Record<string, unknown> = {}
    if (draft.email !== user.email) body.email = draft.email
    if (draft.full_name !== (user.full_name ?? '')) body.full_name = draft.full_name
    if (draft.phone !== (user.phone ?? '')) body.phone = draft.phone
    if (draft.subscription_status !== user.subscription_status) body.subscription_status = draft.subscription_status
    if (draft.subscription_expires_at !== isoForDateInput(user.subscription_expires_at)) {
      body.subscription_expires_at = draft.subscription_expires_at ? new Date(draft.subscription_expires_at + 'T23:59:59').toISOString() : null
    }
    if (draft.is_gift !== user.is_gift) body.is_gift = draft.is_gift
    if (draft.admin_notes !== (user.admin_notes ?? '')) body.admin_notes = draft.admin_notes

    const res = await fetch(`/api/admin/profiles/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const j = await res.json()
    setSaving(false)
    if (res.ok) {
      setMsg({ ok: true, text: j.email_changed ? '✓ Salvo · novo email recebeu acesso' : '✓ Salvo' })
      setTimeout(() => { onChanged() }, 800)
    } else {
      setMsg({ ok: false, text: j.error ?? 'Erro' })
    }
  }

  async function doAction(action: string, label: string, months?: number) {
    if (!confirm(`Confirmar: ${label}?`)) return
    setSaving(true); setMsg(null)
    const res = await fetch(`/api/admin/profiles/${user.id}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, months }),
    })
    const j = await res.json()
    setSaving(false)
    if (res.ok) {
      setMsg({ ok: true, text: `✓ ${label}` })
      setTimeout(() => onChanged(), 800)
    } else {
      setMsg({ ok: false, text: j.error ?? 'Erro' })
    }
  }

  async function doSetPassword() {
    const pwd = prompt(`Definir nova senha para ${user.email}:\n(mínimo 6 caracteres)`)
    if (pwd === null) return
    if (pwd.length < 6) { setMsg({ ok: false, text: 'Senha precisa ter pelo menos 6 caracteres' }); return }
    setSaving(true); setMsg(null)
    const res = await fetch(`/api/admin/profiles/${user.id}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_password', password: pwd }),
    })
    const j = await res.json()
    setSaving(false)
    if (res.ok) setMsg({ ok: true, text: '✓ Senha atualizada' })
    else setMsg({ ok: false, text: j.error ?? 'Erro' })
  }

  const label: React.CSSProperties = { fontSize: 11, color: gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5, display: 'block' }
  const input: React.CSSProperties = { width: '100%', padding: '8px 11px', borderRadius: 8, border: '1px solid #E0E0E8', fontSize: 13, color: '#2A1E2C', fontWeight: 500, outline: 'none', boxSizing: 'border-box', background: '#fff', fontFamily: 'inherit' }

  return (
    <div style={{
      width: 360, flexShrink: 0, background: '#fff', borderLeft: '1px solid #F0F0F5',
      overflowY: 'auto', padding: '20px 18px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#2A1E2C' }}>Editar usuária</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: gray, padding: 0 }}>✕</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
          background: gradientForId(user.id),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 700, color: '#fff',
        }}>{initials(user.full_name, user.email)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#2A1E2C' }}>{user.full_name ?? 'Sem nome'}</div>
          <div style={{ fontSize: 11, color: gray, fontFamily: 'monospace' }}>{user.id.slice(0, 8)}</div>
          {user.is_gift && <div style={{ fontSize: 11, color: purple, fontWeight: 600, marginTop: 2 }}>🎁 Presente</div>}
          {user.refunded_at && <div style={{ fontSize: 11, color: '#8B5CF6', fontWeight: 600, marginTop: 2 }}>Reembolsada {fmtDate(user.refunded_at)}</div>}
        </div>
      </div>

      {/* Form fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={label}>Email <span style={{ color: red }}>⚠ muda login</span></label>
          <input style={input} type="email" value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value.toLowerCase() })} />
        </div>
        <div>
          <label style={label}>Nome</label>
          <input style={input} value={draft.full_name} onChange={e => setDraft({ ...draft, full_name: e.target.value })} />
        </div>
        <div>
          <label style={label}>Telefone</label>
          <input style={input} value={draft.phone} onChange={e => setDraft({ ...draft, phone: e.target.value })} placeholder="só números" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label style={label}>Status</label>
            <select style={{ ...input, cursor: 'pointer' }} value={draft.subscription_status} onChange={e => setDraft({ ...draft, subscription_status: e.target.value })}>
              <option value="active">Ativa</option>
              <option value="pending">Pendente</option>
              <option value="cancelled">Cancelada</option>
              <option value="refunded">Reembolsada</option>
              <option value="expired">Expirada</option>
            </select>
          </div>
          <div>
            <label style={label}>Expira em</label>
            <input style={input} type="date" value={draft.subscription_expires_at} onChange={e => setDraft({ ...draft, subscription_expires_at: e.target.value })} />
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#2A1E2C', cursor: 'pointer' }}>
          <input type="checkbox" checked={draft.is_gift} onChange={e => setDraft({ ...draft, is_gift: e.target.checked })} />
          🎁 Marcar como presente
        </label>
        <div>
          <label style={label}>Notas internas (só você vê)</label>
          <textarea style={{ ...input, minHeight: 60, resize: 'vertical' }} value={draft.admin_notes} onChange={e => setDraft({ ...draft, admin_notes: e.target.value })} />
        </div>
      </div>

      {msg && (
        <div style={{
          marginTop: 12, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
          background: msg.ok ? green + '18' : red + '18',
          color: msg.ok ? green : red,
        }}>{msg.text}</div>
      )}

      <button
        onClick={save}
        disabled={!dirty || saving}
        style={{
          marginTop: 14, width: '100%', padding: '10px 14px', borderRadius: 10,
          background: dirty && !saving ? accent : '#E0E0E8',
          color: dirty && !saving ? '#fff' : gray,
          border: 'none', fontSize: 13, fontWeight: 700,
          cursor: dirty && !saving ? 'pointer' : 'default',
        }}
      >{saving ? 'Salvando…' : dirty ? 'Salvar mudanças' : 'Sem alterações'}</button>

      {/* Detalhes capilares (read-only) */}
      <DetailsSection user={user} />

      {/* Regenerar plano */}
      <RegeneratePlanBtn user={user} onChanged={onChanged} />

      {/* Ações rápidas */}
      <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid #F0F0F5' }}>
        <div style={{ fontSize: 11, color: gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Ações rápidas</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <ActionBtn icon="📧" label="Reenviar email de boas-vindas" onClick={() => doAction('resend_welcome', 'Reenviar email de boas-vindas')} />
          <ActionBtn icon="🔑" label="Definir / redefinir senha" onClick={doSetPassword} />
          <ActionBtn icon="⏱" label="Estender 1 mês (cortesia)" onClick={() => doAction('extend', 'Estender 1 mês', 1)} />
          <ActionBtn icon="⏱" label="Estender 3 meses" onClick={() => doAction('extend', 'Estender 3 meses', 3)} />
          <ActionBtn icon="💸" label="Marcar como reembolso (encerra acesso)" color={red} onClick={() => doAction('refund', 'Reembolso — encerra acesso hoje')} />
          <ActionBtn icon="🚫" label="Cancelar acesso" color={red} onClick={() => doAction('cancel', 'Cancelar acesso')} />
        </div>
      </div>
    </div>
  )
}

// ─── DetailsSection: tudo readonly que está em profiles ─────────────────
function DetailsSection({ user }: { user: User }) {
  const [open, setOpen] = useState<'cabelo' | 'assinatura' | 'quiz' | 'sistema' | null>('cabelo')

  const hair: Array<[string, string]> = [
    ['Tipo de cabelo', user.hair_type ? (HAIR_LABEL[user.hair_type] ?? user.hair_type) : '—'],
    ['Porosidade', user.porosity ?? '—'],
    ['Química', user.chemical_history ?? '—'],
    ['Problemas', (user.main_problems ?? []).join(', ') || '—'],
    ['Comprimento', user.hair_length_cm ? `${user.hair_length_cm} cm` : '—'],
    ['Plano', PLAN_LABEL[user.plan_status]?.label ?? user.plan_status],
    ['Plano gerado em', fmtDate(user.plan_released_at)],
    ['Quiz concluído em', fmtDate(user.quiz_completed_at)],
    ['Última foto em', fmtDate(user.photo_taken_at)],
  ]

  const sub: Array<[string, string]> = [
    ['Tipo plano', SUB_TYPE_LABEL[user.subscription_type] ?? user.subscription_type],
    ['Status', SUB_LABEL[user.subscription_status]?.label ?? user.subscription_status],
    ['Ativada em', fmtDate(user.subscription_activated_at)],
    ['Expira em', fmtDate(user.subscription_expires_at)],
    ['Reembolso em', fmtDate(user.refunded_at)],
    ['Cobrança PagarMe', user.pagarme_charge_id ? user.pagarme_charge_id.slice(0, 16) + '…' : '—'],
    ['Assinatura PagarMe', user.pagarme_subscription_id ? user.pagarme_subscription_id.slice(0, 16) + '…' : '—'],
  ]

  const sys: Array<[string, string]> = [
    ['ID', user.id],
    ['Cadastro', user.created_at ? new Date(user.created_at).toLocaleString('pt-BR') : '—'],
    ['Última atualização', user.updated_at ? new Date(user.updated_at).toLocaleString('pt-BR') : '—'],
    ['Foto de perfil', user.avatar_url ? 'sim' : 'não'],
    ['Foto do cabelo', user.photo_url ? 'sim' : 'não'],
  ]

  return (
    <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid #F0F0F5' }}>
      <Section title="🌸 Cabelo & Diagnóstico" isOpen={open === 'cabelo'} onToggle={() => setOpen(open === 'cabelo' ? null : 'cabelo')}>
        <KVList items={hair} />
      </Section>
      <Section title="💳 Assinatura & Pagamento" isOpen={open === 'assinatura'} onToggle={() => setOpen(open === 'assinatura' ? null : 'assinatura')}>
        <KVList items={sub} />
      </Section>
      <Section title="📝 Respostas do quiz" isOpen={open === 'quiz'} onToggle={() => setOpen(open === 'quiz' ? null : 'quiz')}>
        {user.quiz_answers ? (
          <pre style={{
            fontSize: 11, lineHeight: 1.5, color: '#2A1E2C',
            background: '#F9F9FC', padding: 10, borderRadius: 8,
            maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap',
            fontFamily: 'ui-monospace, Menlo, monospace',
          }}>{JSON.stringify(user.quiz_answers, null, 2)}</pre>
        ) : (
          <div style={{ fontSize: 12, color: gray, padding: '4px 0' }}>Quiz não respondido</div>
        )}
      </Section>
      <Section title="⚙️ Sistema" isOpen={open === 'sistema'} onToggle={() => setOpen(open === 'sistema' ? null : 'sistema')}>
        <KVList items={sys} />
      </Section>
    </div>
  )
}

function Section({ title, isOpen, onToggle, children }: { title: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <button onClick={onToggle} style={{
        width: '100%', textAlign: 'left',
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '6px 0', fontSize: 12, fontWeight: 700, color: '#2A1E2C',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontFamily: 'inherit',
      }}>
        <span>{title}</span>
        <span style={{ fontSize: 11, color: gray }}>{isOpen ? '▾' : '▸'}</span>
      </button>
      {isOpen && <div style={{ padding: '4px 0 8px' }}>{children}</div>}
    </div>
  )
}

function KVList({ items }: { items: Array<[string, string]> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, fontSize: 12, padding: '3px 0' }}>
          <span style={{ color: gray, flexShrink: 0 }}>{k}</span>
          <span style={{ color: '#2A1E2C', textAlign: 'right', wordBreak: 'break-all', fontWeight: 500 }}>{v}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Regenerar plano ────────────────────────────────────────────────────
function RegeneratePlanBtn({ user, onChanged }: { user: User; onChanged: () => void }) {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  async function regenerate() {
    if (!user.quiz_answers && !user.photo_url) {
      setResult({ ok: false, text: 'Usuária não tem quiz respondido nem foto. Sem dados pra IA gerar plano.' })
      return
    }
    const photoNote = user.photo_url ? '' : '\n\n⚠ Sem foto — vou gerar baseado só no quiz.'
    if (!confirm(`Regerar TODO o plano de 12 semanas (90 dias) da ${user.full_name ?? user.email}?\n\nIsso vai sobrescrever o plano atual usando o catálogo Ybera mais novo. Demora ~30s.${photoNote}`)) return
    setRunning(true); setResult(null)
    try {
      const res = await fetch(`/api/admin/profiles/${user.id}/regenerate-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      })
      const j = await res.json()
      if (res.ok) {
        setResult({ ok: true, text: `✓ ${j.weeks_generated} semanas regeradas · usou ${j.catalog_size} produtos do catálogo` })
        setTimeout(onChanged, 1500)
      } else {
        setResult({ ok: false, text: j.error ?? 'Erro' })
      }
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : 'Erro' })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid #F0F0F5' }}>
      <div style={{ fontSize: 11, color: gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
        Plano capilar (IA)
      </div>
      <button onClick={regenerate} disabled={running} style={{
        width: '100%', padding: '10px 12px', borderRadius: 10,
        background: running ? gray : '#fff',
        border: `1px solid ${running ? gray : accent}`,
        color: running ? '#fff' : accent,
        fontSize: 13, fontWeight: 700, cursor: running ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        fontFamily: 'inherit',
      }}>
        {running ? '🧠 Gerando plano… (~30s)' : '✨ Regerar plano com catálogo atual'}
      </button>
      <div style={{ fontSize: 11, color: gray, marginTop: 5, lineHeight: 1.4 }}>
        Usa a foto e respostas do quiz dela, com os produtos Ybera atuais.
      </div>
      {result && (
        <div style={{
          marginTop: 8, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
          background: result.ok ? green + '18' : red + '18',
          color: result.ok ? green : red,
        }}>{result.text}</div>
      )}
    </div>
  )
}

function ActionBtn({ icon, label, onClick, color }: { icon: string; label: string; onClick: () => void; color?: string }) {
  return (
    <button onClick={onClick} style={{
      padding: '9px 11px', borderRadius: 8,
      background: '#fff', border: `1px solid ${color ? color + '40' : '#E0E0E8'}`,
      color: color ?? '#2A1E2C',
      fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
      fontFamily: 'inherit',
    }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      {label}
    </button>
  )
}

// ─── CreateModal ─────────────────────────────────────────────────
function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    email: '',
    full_name: '',
    phone: '',
    password: '',
    subscription_type: 'annual_pix',
    duration_months: 12,
    is_gift: true,
    admin_notes: '',
    send_welcome: true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!form.email || !form.email.includes('@')) {
      setError('Email obrigatório'); return
    }
    setSaving(true); setError(null)
    const res = await fetch('/api/admin/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const j = await res.json()
    setSaving(false)
    if (res.ok) onCreated()
    else setError(j.error ?? 'Erro inesperado')
  }

  const label: React.CSSProperties = { fontSize: 11, color: gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5, display: 'block' }
  const input: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #E0E0E8', fontSize: 13, color: '#2A1E2C', fontWeight: 500, outline: 'none', boxSizing: 'border-box', background: '#fff', fontFamily: 'inherit' }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 460,
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#2A1E2C' }}>Cadastrar usuária</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: gray, padding: 0 }}>✕</button>
        </div>
        <div style={{ fontSize: 12.5, color: gray, marginBottom: 18 }}>
          Cria conta ativada, envia email de acesso e dispara a definição de senha no primeiro login.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={label}>Email *</label>
            <input style={input} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value.toLowerCase() })} placeholder="nome@email.com" />
          </div>
          <div>
            <label style={label}>Nome</label>
            <input style={input} value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Nome completo" />
          </div>
          <div>
            <label style={label}>Telefone (WhatsApp)</label>
            <input style={input} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="só números, com DDD" />
          </div>
          <div>
            <label style={label}>Senha (opcional)</label>
            <input style={input} type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="mín. 6 caracteres — se deixar em branco, gera senha aleatória" />
            <div style={{ fontSize: 11, color: gray, marginTop: 4 }}>
              Em branco = a usuária define no 1º login pelo email de boas-vindas.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={label}>Tipo plano</label>
              <select style={{ ...input, cursor: 'pointer' }} value={form.subscription_type} onChange={e => setForm({ ...form, subscription_type: e.target.value })}>
                <option value="annual_pix">Anual PIX</option>
                <option value="annual_card">Anual Cartão</option>
              </select>
            </div>
            <div>
              <label style={label}>Duração</label>
              <select style={{ ...input, cursor: 'pointer' }} value={form.duration_months} onChange={e => setForm({ ...form, duration_months: Number(e.target.value) })}>
                <option value={1}>1 mês</option>
                <option value={3}>3 meses</option>
                <option value={6}>6 meses</option>
                <option value={12}>12 meses</option>
                <option value={24}>24 meses</option>
              </select>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#2A1E2C', cursor: 'pointer', padding: '6px 0' }}>
            <input type="checkbox" checked={form.is_gift} onChange={e => setForm({ ...form, is_gift: e.target.checked })} />
            <span>🎁 É um presente / cortesia</span>
          </label>

          <div>
            <label style={label}>Nota interna (opcional)</label>
            <textarea
              style={{ ...input, minHeight: 60, resize: 'vertical' }}
              value={form.admin_notes}
              onChange={e => setForm({ ...form, admin_notes: e.target.value })}
              placeholder="ex: presente do aniversário da mãe da Ju"
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#2A1E2C', cursor: 'pointer', padding: '6px 0', borderTop: '1px solid #F0F0F5', paddingTop: 12 }}>
            <input type="checkbox" checked={form.send_welcome} onChange={e => setForm({ ...form, send_welcome: e.target.checked })} />
            <span>Enviar email de boas-vindas agora</span>
          </label>
        </div>

        {error && (
          <div style={{
            marginTop: 14, padding: '8px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 500,
            background: red + '18', color: red,
          }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '10px 14px', borderRadius: 10,
            background: '#fff', color: '#2A1E2C', border: '1px solid #E0E0E8',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>Cancelar</button>
          <button onClick={submit} disabled={saving} style={{
            flex: 2, padding: '10px 14px', borderRadius: 10,
            background: saving ? gray : accent, color: '#fff', border: 'none',
            fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer',
          }}>{saving ? 'Criando…' : 'Criar usuária'}</button>
        </div>
      </div>
    </div>
  )
}
