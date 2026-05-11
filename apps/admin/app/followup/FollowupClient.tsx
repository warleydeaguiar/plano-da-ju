'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'

const T = {
  accent:  '#C4607A',
  pink:    '#EC4899',
  pinkDeep:'#BE185D',
  green:   '#22C55E',
  whatsapp:'#25D366',
  orange:  '#F97316',
  red:     '#EF4444',
  gray:    '#8A8A8E',
  ink:     '#2D1B2E',
  inkSoft: '#6B7280',
  border:  'rgba(0,0,0,0.06)',
  bg:      '#F5F5F7',
}

type Rule = 20 | 60 | 120
type Tab = 20 | 60 | 120 | 'history' | 'templates'

const RULE_META: Record<Rule, { label: string; color: string; emoji: string; subtitle: string }> = {
  20:  { label: '20 dias',  color: '#F59E0B', emoji: '🟡', subtitle: 'Primeiro followup' },
  60:  { label: '60 dias',  color: '#F97316', emoji: '🟠', subtitle: 'Reativação' },
  120: { label: '120 dias', color: '#EF4444', emoji: '🔴', subtitle: 'Última tentativa' },
}

interface Lead {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  utm_source: string | null
  utm_campaign: string | null
  created_at: string
  days_since: number
  rule_days?: number
  contacted_at?: string
  notes?: string | null
  outcome?: string | null
  followup_id?: string
  instance_used?: string | null
  send_method?: string | null
}

interface Template {
  rule_days: number
  label: string
  message: string
  default_instance: string | null
  updated_at: string
}

interface EvoInstance {
  name: string
  connectionStatus: string
  profileName?: string
  ownerJid?: string
}

function formatPhone(p: string | null) {
  if (!p) return '—'
  const d = p.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return p
}

function whatsappLink(phone: string | null, message: string) {
  if (!phone) return '#'
  let d = phone.replace(/\D/g, '')
  // Adiciona 55 (BR) se ainda não tiver
  if (d.length === 10 || d.length === 11) d = '55' + d
  return `https://wa.me/${d}?text=${encodeURIComponent(message)}`
}

function fillTemplate(tpl: string, lead: Lead) {
  const firstName = (lead.name ?? '').split(' ')[0] || 'amiga'
  return tpl.replace(/\{nome\}/g, firstName).replace(/\{name\}/g, firstName)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

// ─── KPI Card ────────────────────────────────────────────────
function KpiCard({ rule, count, active, onClick }: {
  rule: Rule; count: number; active: boolean; onClick: () => void
}) {
  const m = RULE_META[rule]
  return (
    <button onClick={onClick} style={{
      flex: 1, background: active ? '#fff' : 'rgba(255,255,255,0.6)',
      border: active ? `2px solid ${m.color}` : `1px solid ${T.border}`,
      borderRadius: 14, padding: '16px 20px', cursor: 'pointer',
      textAlign: 'left', transition: 'all 0.2s', fontFamily: 'inherit',
      boxShadow: active ? `0 8px 20px ${m.color}22` : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 28, fontWeight: 700, color: active ? m.color : T.ink, lineHeight: 1 }}>
          {count}
        </span>
        <span style={{ fontSize: 16 }}>{m.emoji}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, marginTop: 6 }}>{m.label}</div>
      <div style={{ fontSize: 11, color: T.gray, marginTop: 2 }}>{m.subtitle}</div>
    </button>
  )
}

// ─── Lead Card (pending) ──────────────────────────────────────
function LeadRow({ lead, rule, template, instances, onMark, onUndo, onSend }: {
  lead: Lead
  rule: Rule | null
  template: Template | undefined
  instances: EvoInstance[]
  onMark: (leadId: string, ruleDays: number, notes?: string) => Promise<void>
  onUndo?: (leadId: string, ruleDays: number) => Promise<void>
  onSend: (leadId: string, ruleDays: number, instanceName: string) => Promise<{ ok: boolean; error?: string }>
}) {
  const [marking, setMarking] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [showNotes, setShowNotes] = useState(false)
  const [notes, setNotes] = useState('')
  const [pickedInstance, setPickedInstance] = useState<string>(
    template?.default_instance ?? instances[0]?.name ?? ''
  )

  // Sync instância default quando template muda
  useEffect(() => {
    if (template?.default_instance) setPickedInstance(template.default_instance)
    else if (!pickedInstance && instances[0]) setPickedInstance(instances[0].name)
  }, [template?.default_instance, instances]) // eslint-disable-line react-hooks/exhaustive-deps

  const isHistory = !!lead.followup_id
  const effectiveRule = (lead.rule_days ?? rule ?? 20) as Rule
  const m = RULE_META[effectiveRule]
  const tplMessage = template ? fillTemplate(template.message, lead) : ''
  const waLink = whatsappLink(lead.phone, tplMessage)

  const doMark = async () => {
    setMarking(true)
    await onMark(lead.id, effectiveRule, notes.trim() || undefined)
    setMarking(false)
    setShowNotes(false)
    setNotes('')
  }

  const doSend = async () => {
    setSending(true)
    setSendError(null)
    const res = await onSend(lead.id, effectiveRule, pickedInstance)
    if (!res.ok) setSendError(res.error ?? 'Erro ao enviar')
    setSending(false)
  }

  return (
    <div style={{
      background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12,
      padding: '14px 16px', marginBottom: 10,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Avatar */}
        <div style={{
          width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
          background: `linear-gradient(135deg, ${m.color}, ${T.pinkDeep})`,
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 700,
        }}>
          {(lead.name ?? '?').charAt(0).toUpperCase()}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{lead.name ?? '—'}</span>
            {lead.utm_source && (
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                background: '#F0F0F5', color: T.gray, textTransform: 'uppercase', letterSpacing: 0.4,
              }}>{lead.utm_source}</span>
            )}
            {isHistory && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                background: m.color + '20', color: m.color,
              }}>{m.label}</span>
            )}
          </div>
          {lead.email && (
            <div style={{ fontSize: 12, color: T.gray, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.email}</div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, fontSize: 12, color: T.inkSoft }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'monospace' }}>📱 {formatPhone(lead.phone)}</span>
            <span>•</span>
            <span>1º contato: {formatDate(lead.created_at)}</span>
          </div>
          {isHistory && lead.contacted_at && (
            <div style={{ fontSize: 11, color: T.gray, marginTop: 4 }}>
              ✓ Contatado em {formatDateTime(lead.contacted_at)}
              {lead.instance_used && (
                <> · via <strong style={{ color: T.whatsapp }}>📱 {lead.instance_used}</strong></>
              )}
              {lead.send_method === 'evolution' && <> 🚀</>}
              {lead.notes && <> · <em>"{lead.notes}"</em></>}
            </div>
          )}
        </div>

        {/* Days badge */}
        <div style={{
          flexShrink: 0, textAlign: 'center', padding: '6px 10px',
          background: m.color + '15', borderRadius: 10,
          minWidth: 64,
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: m.color, lineHeight: 1 }}>{lead.days_since}</div>
          <div style={{ fontSize: 9, color: m.color, fontWeight: 600, letterSpacing: 0.3, marginTop: 2 }}>DIAS</div>
        </div>
      </div>

      {/* Actions */}
      {!isHistory && (
        <>
          {/* Linha 1: Seletor de número + Enviar via Evolution */}
          <div style={{
            display: 'flex', gap: 8, alignItems: 'stretch',
            background: '#F9F9FC', padding: 8, borderRadius: 10,
            border: `1px solid ${T.border}`,
          }}>
            <select
              value={pickedInstance}
              onChange={e => setPickedInstance(e.target.value)}
              disabled={sending || instances.length === 0}
              style={{
                flex: 1, padding: '10px 12px', fontSize: 13,
                border: `1px solid ${T.border}`, borderRadius: 8, outline: 'none',
                background: '#fff', fontFamily: 'inherit', cursor: 'pointer',
              }}
            >
              {instances.length === 0 && <option value="">— sem instâncias conectadas —</option>}
              {instances.map(i => (
                <option key={i.name} value={i.name}>
                  📱 {i.name}{i.connectionStatus !== 'open' ? ' (offline)' : ''}
                </option>
              ))}
            </select>
            <button
              onClick={doSend}
              disabled={sending || !pickedInstance}
              style={{
                background: sending ? '#A7F3D0' : T.whatsapp, color: '#fff',
                border: 'none', padding: '10px 16px', borderRadius: 8,
                fontSize: 13, fontWeight: 700,
                cursor: sending || !pickedInstance ? 'default' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {sending ? '⏳ Enviando…' : '🚀 Enviar via Evolution'}
            </button>
          </div>
          {sendError && (
            <div style={{
              fontSize: 12, color: T.red, padding: '8px 12px',
              background: '#FEF2F2', borderRadius: 8, border: '1px solid #FECACA',
            }}>
              ✗ {sendError}
            </div>
          )}

          {/* Linha 2: WhatsApp manual + marcar manualmente */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1, minWidth: 0,
                background: 'transparent', color: T.ink,
                padding: '8px 12px', borderRadius: 10,
                fontSize: 12, fontWeight: 600, textDecoration: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                border: `1px solid ${T.border}`, cursor: 'pointer',
              }}
            >
              💬 Abrir wa.me (manual)
            </a>
            {showNotes ? (
              <>
                <button onClick={doMark} disabled={marking} style={{
                  flex: 1, background: T.green, color: '#fff', border: 'none',
                  padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                  cursor: marking ? 'default' : 'pointer', opacity: marking ? 0.6 : 1,
                }}>
                  {marking ? 'Salvando…' : '✓ Confirmar'}
                </button>
                <button onClick={() => setShowNotes(false)} style={{
                  background: '#F5F5F7', color: T.ink, border: 'none',
                  padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>
                  Cancelar
                </button>
              </>
            ) : (
              <button onClick={() => setShowNotes(true)} style={{
                flex: 1,
                background: 'transparent', color: T.inkSoft, border: `1px solid ${T.border}`,
                padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>
                ✓ Marcar como contatado (manual)
              </button>
            )}
          </div>
        </>
      )}
      {showNotes && !isHistory && (
        <input
          type="text"
          placeholder="Notas opcionais sobre o contato (ex: respondeu, comprou…)"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          autoFocus
          style={{
            width: '100%', padding: '10px 14px', fontSize: 13,
            border: `1px solid ${T.border}`, borderRadius: 10, outline: 'none',
            fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />
      )}

      {isHistory && onUndo && (
        <div>
          <button onClick={() => onUndo(lead.id, effectiveRule)} style={{
            background: 'transparent', color: T.gray, border: `1px solid ${T.border}`,
            padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
          }}>
            ↶ Desfazer contato
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Templates editor ────────────────────────────────────────
function TemplatesPanel({ templates, instances, onUpdate, onUpdateInstance }: {
  templates: Template[]
  instances: EvoInstance[]
  onUpdate: (rule: number, message: string) => Promise<void>
  onUpdateInstance: (rule: number, instanceName: string) => Promise<void>
}) {
  const [editing, setEditing] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState<number | null>(null)
  const [savingInst, setSavingInst] = useState<number | null>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{
        padding: 14, background: '#FEF9C3', borderRadius: 10,
        border: '1px solid #FDE68A', fontSize: 13, color: '#713F12',
      }}>
        💡 Use <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 4, fontSize: 12 }}>{'{nome}'}</code> para inserir o primeiro nome do lead automaticamente.
      </div>
      {templates.map(tpl => {
        const m = RULE_META[tpl.rule_days as Rule]
        const value = editing[tpl.rule_days] ?? tpl.message
        const dirty = value !== tpl.message
        const isSaving = saving === tpl.rule_days
        return (
          <div key={tpl.rule_days} style={{
            background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12,
            padding: '16px 18px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <div style={{
                fontSize: 14, fontWeight: 700, color: m.color,
                padding: '4px 12px', background: m.color + '15', borderRadius: 99,
              }}>
                {m.emoji} {m.label}
              </div>
              <div style={{ fontSize: 12, color: T.gray }}>{m.subtitle}</div>
              <div style={{ flex: 1 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: T.gray, fontWeight: 600 }}>Número default:</span>
                <select
                  value={tpl.default_instance ?? ''}
                  disabled={savingInst === tpl.rule_days}
                  onChange={async e => {
                    setSavingInst(tpl.rule_days)
                    await onUpdateInstance(tpl.rule_days, e.target.value)
                    setSavingInst(null)
                  }}
                  style={{
                    padding: '5px 9px', fontSize: 12, borderRadius: 6,
                    border: `1px solid ${T.border}`, background: '#fff',
                    fontFamily: 'inherit', cursor: 'pointer',
                  }}
                >
                  <option value="">— escolher na hora —</option>
                  {instances.map(i => (
                    <option key={i.name} value={i.name}>
                      📱 {i.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <textarea
              value={value}
              onChange={e => setEditing({ ...editing, [tpl.rule_days]: e.target.value })}
              rows={4}
              style={{
                width: '100%', padding: '12px 14px', fontSize: 13,
                border: `1px solid ${T.border}`, borderRadius: 10, outline: 'none',
                fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5,
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
              {dirty && (
                <button onClick={() => setEditing(e => { const n = { ...e }; delete n[tpl.rule_days]; return n })} style={{
                  background: '#F5F5F7', color: T.ink, border: 'none',
                  padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>
                  Cancelar
                </button>
              )}
              <button
                disabled={!dirty || isSaving}
                onClick={async () => {
                  setSaving(tpl.rule_days)
                  await onUpdate(tpl.rule_days, value)
                  setEditing(e => { const n = { ...e }; delete n[tpl.rule_days]; return n })
                  setSaving(null)
                }}
                style={{
                  background: dirty ? T.accent : '#E5E5E8',
                  color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8,
                  fontSize: 12, fontWeight: 700, cursor: dirty && !isSaving ? 'pointer' : 'default',
                }}
              >
                {isSaving ? 'Salvando…' : '💾 Salvar'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════╗
// ║                     Main                                 ║
// ╚══════════════════════════════════════════════════════════╝
export default function FollowupClient() {
  const [tab, setTab] = useState<Tab>(20)
  const [leads, setLeads] = useState<Lead[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({ '20': 0, '60': 0, '120': 0 })
  const [templates, setTemplates] = useState<Template[]>([])
  const [instances, setInstances] = useState<EvoInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const templateMap = useMemo(() => {
    const m = new Map<number, Template>()
    for (const t of templates) m.set(t.rule_days, t)
    return m
  }, [templates])

  const loadLeads = useCallback(async (currentTab: Tab) => {
    setLoading(true)
    const rule = currentTab === 'templates' ? '20' : (currentTab === 'history' ? 'history' : String(currentTab))
    try {
      const res = await fetch(`/api/followup?rule=${rule}`)
      const data = await res.json()
      setLeads(data.leads ?? [])
      if (data.counts) setCounts(data.counts)
    } catch (err) {
      setLeads([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/followup/templates')
      const data = await res.json()
      if (Array.isArray(data)) setTemplates(data)
    } catch {}
  }, [])

  const loadInstances = useCallback(async () => {
    try {
      const res = await fetch('/api/grupos/instances')
      const data = await res.json()
      if (Array.isArray(data)) {
        // Prioriza instâncias conectadas
        const sorted = [...data].sort((a, b) => {
          if (a.connectionStatus === 'open' && b.connectionStatus !== 'open') return -1
          if (b.connectionStatus === 'open' && a.connectionStatus !== 'open') return 1
          return 0
        })
        setInstances(sorted)
      }
    } catch {}
  }, [])

  useEffect(() => { loadTemplates(); loadInstances() }, [loadTemplates, loadInstances])
  useEffect(() => { loadLeads(tab) }, [tab, loadLeads])

  const handleMark = useCallback(async (leadId: string, ruleDays: number, notes?: string) => {
    const res = await fetch('/api/followup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: leadId, rule_days: ruleDays, notes }),
    })
    if (res.ok) await loadLeads(tab)
  }, [tab, loadLeads])

  const handleUndo = useCallback(async (leadId: string, ruleDays: number) => {
    const ok = confirm('Desfazer o registro deste contato? O lead voltará para a régua pendente.')
    if (!ok) return
    const res = await fetch(`/api/followup?lead_id=${leadId}&rule_days=${ruleDays}`, { method: 'DELETE' })
    if (res.ok) await loadLeads(tab)
  }, [tab, loadLeads])

  const handleUpdateTemplate = useCallback(async (rule: number, message: string) => {
    await fetch('/api/followup/templates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rule_days: rule, message }),
    })
    await loadTemplates()
  }, [loadTemplates])

  const handleUpdateTemplateInstance = useCallback(async (rule: number, instanceName: string) => {
    await fetch('/api/followup/templates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rule_days: rule, default_instance: instanceName }),
    })
    await loadTemplates()
  }, [loadTemplates])

  const handleSend = useCallback(async (leadId: string, ruleDays: number, instanceName: string) => {
    try {
      const res = await fetch('/api/followup/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, rule_days: ruleDays, instance_name: instanceName }),
      })
      const data = await res.json()
      if (!res.ok) return { ok: false, error: data.error ?? 'Erro desconhecido' }
      await loadLeads(tab)
      return { ok: true }
    } catch (err: any) {
      return { ok: false, error: err?.message ?? 'Erro de rede' }
    }
  }, [tab, loadLeads])

  const filteredLeads = useMemo(() => {
    if (!search.trim()) return leads
    const s = search.toLowerCase()
    return leads.filter(l =>
      (l.name ?? '').toLowerCase().includes(s) ||
      (l.email ?? '').toLowerCase().includes(s) ||
      (l.phone ?? '').replace(/\D/g, '').includes(s.replace(/\D/g, ''))
    )
  }, [leads, search])

  const totalPending = counts['20'] + counts['60'] + counts['120']
  const currentRule = (tab === 'templates' || tab === 'history') ? null : tab

  return (
    <div style={{ padding: '32px 40px', maxWidth: 980 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: T.ink, marginBottom: 4 }}>
          📞 Followup de Leads
        </div>
        <div style={{ fontSize: 14, color: T.gray }}>
          Régua de relacionamento — contate os leads do quiz Fashion Gold após 20, 60 e 120 dias do primeiro contato.
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {([20, 60, 120] as Rule[]).map(r => (
          <KpiCard
            key={r}
            rule={r}
            count={counts[String(r)] ?? 0}
            active={tab === r}
            onClick={() => setTab(r)}
          />
        ))}
        <button onClick={() => setTab('history')} style={{
          flex: 1, background: tab === 'history' ? '#fff' : 'rgba(255,255,255,0.6)',
          border: tab === 'history' ? `2px solid ${T.accent}` : `1px solid ${T.border}`,
          borderRadius: 14, padding: '16px 20px', cursor: 'pointer',
          textAlign: 'left', transition: 'all 0.2s', fontFamily: 'inherit',
          boxShadow: tab === 'history' ? `0 8px 20px ${T.accent}22` : 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: tab === 'history' ? T.accent : T.ink, lineHeight: 1 }}>
              {totalPending}
            </span>
            <span style={{ fontSize: 16 }}>📋</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, marginTop: 6 }}>Histórico</div>
          <div style={{ fontSize: 11, color: T.gray, marginTop: 2 }}>Já contatados</div>
        </button>
      </div>

      {/* Templates tab button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button onClick={() => setTab('templates')} style={{
          background: tab === 'templates' ? T.accent : 'transparent',
          color: tab === 'templates' ? '#fff' : T.accent,
          border: `1px solid ${T.accent}`, padding: '6px 14px', borderRadius: 99,
          fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          ✏️ Editar mensagens
        </button>
      </div>

      {/* Search bar */}
      {tab !== 'templates' && (
        <div style={{ marginBottom: 14 }}>
          <input
            type="text"
            placeholder="🔍 Buscar por nome, e-mail ou telefone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '12px 16px', fontSize: 14,
              border: `1px solid ${T.border}`, borderRadius: 10, outline: 'none',
              fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box',
            }}
          />
        </div>
      )}

      {/* Content */}
      {tab === 'templates' ? (
        <TemplatesPanel
          templates={templates}
          instances={instances}
          onUpdate={handleUpdateTemplate}
          onUpdateInstance={handleUpdateTemplateInstance}
        />
      ) : loading ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: T.gray }}>Carregando…</div>
      ) : filteredLeads.length === 0 ? (
        <div style={{
          padding: '60px 24px', textAlign: 'center', color: T.gray,
          background: '#fff', borderRadius: 14, border: `1px solid ${T.border}`,
        }}>
          {tab === 'history'
            ? 'Nenhum followup registrado ainda. Marque um lead como contatado para começar.'
            : `Nenhum lead na régua de ${tab} dias pendente. ✨`}
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 12, color: T.gray, marginBottom: 10, fontWeight: 600 }}>
            {filteredLeads.length} {filteredLeads.length === 1 ? 'lead' : 'leads'}
            {tab !== 'history' && currentRule && (
              <> · ordenados por dias desde primeiro contato</>
            )}
          </div>
          {filteredLeads.map((lead, i) => (
            <LeadRow
              key={lead.followup_id ?? `${lead.id}-${tab}`}
              lead={lead}
              rule={currentRule}
              template={currentRule ? templateMap.get(currentRule) : (lead.rule_days ? templateMap.get(lead.rule_days) : undefined)}
              instances={instances}
              onMark={handleMark}
              onUndo={tab === 'history' ? handleUndo : undefined}
              onSend={handleSend}
            />
          ))}
        </div>
      )}
    </div>
  )
}
