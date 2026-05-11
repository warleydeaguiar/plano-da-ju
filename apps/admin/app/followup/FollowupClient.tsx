'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'

// ─── Design tokens ───────────────────────────────────────────
const T = {
  bg:        '#F9FAFB',
  card:      '#FFFFFF',
  ink:       '#0F172A',
  inkSoft:   '#64748B',
  inkMuted:  '#94A3B8',
  border:    '#E5E7EB',
  borderSoft:'#F1F5F9',
  whatsapp:  '#22C55E',
  whatsappDeep: '#16A34A',
  bgWhats:   '#F0FDF4',

  red:       '#EF4444',
  redSoft:   '#FEE2E2',
  redBg:     '#FEF2F2',

  orange:    '#F97316',
  orangeSoft:'#FFEDD5',
  orangeBg:  '#FFF7ED',

  blue:      '#3B82F6',
  blueSoft:  '#DBEAFE',
  blueBg:    '#EFF6FF',

  yellow:    '#F59E0B',
  yellowSoft:'#FEF3C7',
  yellowBg:  '#FFFBEB',

  purple:    '#A855F7',
  purpleSoft:'#F3E8FF',
  purpleBg:  '#FAF5FF',

  gray:      '#94A3B8',
  graySoft:  '#F1F5F9',
}

type Rule = 20 | 60 | 120
type RuleFilter = 'todos' | 20 | 60 | 120
type View = 'kanban' | 'history' | 'templates'

const RULE_META: Record<Rule, { label: string; bg: string; text: string; dot: string }> = {
  20:  { label: '20 dias',  bg: T.yellowSoft, text: '#B45309', dot: T.yellow },
  60:  { label: '60 dias',  bg: T.orangeSoft, text: '#9A3412', dot: T.orange },
  120: { label: '120 dias', bg: T.redSoft,    text: '#991B1B', dot: T.red    },
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
  rule_days: Rule
  status?: 'atrasados' | 'hoje' | 'amanha'
  days_overdue?: number
  contacted_at?: string
  notes?: string | null
  instance_used?: string | null
  send_method?: string | null
  followup_id?: string
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
}

// ─── Helpers ─────────────────────────────────────────────────
function formatPhone(p: string | null) {
  if (!p) return '—'
  const d = p.replace(/\D/g, '')
  if (d.length === 13 && d.startsWith('55')) {
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`
  }
  if (d.length === 11) return `+55 (${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `+55 (${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return p
}
function whatsappLink(phone: string | null, message: string) {
  if (!phone) return '#'
  let d = phone.replace(/\D/g, '')
  if (d.length === 10 || d.length === 11) d = '55' + d
  return `https://wa.me/${d}?text=${encodeURIComponent(message)}`
}
function fillTemplate(tpl: string, lead: Lead) {
  const firstName = (lead.name ?? '').split(' ')[0] || 'amiga'
  return tpl.replace(/\{nome\}/g, firstName).replace(/\{name\}/g, firstName)
}
function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

// ─── Card ────────────────────────────────────────────────────
function FollowupCard({ lead, template, instances, onSend, onMark, onUndo, isHistory }: {
  lead: Lead
  template: Template | undefined
  instances: EvoInstance[]
  onSend: (leadId: string, rule: Rule, instance: string) => Promise<{ ok: boolean; error?: string }>
  onMark: (leadId: string, rule: Rule) => Promise<void>
  onUndo?: (leadId: string, rule: Rule) => Promise<void>
  isHistory?: boolean
}) {
  const [sending, setSending] = useState(false)
  const [marking, setMarking] = useState(false)
  const [copied, setCopied] = useState(false)
  const [pickedInstance, setPickedInstance] = useState<string>(
    template?.default_instance ?? instances.find(i => i.connectionStatus === 'open')?.name ?? instances[0]?.name ?? ''
  )
  const [showInstanceDropdown, setShowInstanceDropdown] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  useEffect(() => {
    if (template?.default_instance && !pickedInstance) setPickedInstance(template.default_instance)
  }, [template?.default_instance]) // eslint-disable-line react-hooks/exhaustive-deps

  const rule = lead.rule_days
  const meta = RULE_META[rule]
  const message = template ? fillTemplate(template.message, lead) : ''
  const waLink = whatsappLink(lead.phone, message)

  const statusText = isHistory
    ? `Contatado em ${lead.contacted_at ? formatDateTime(lead.contacted_at) : '—'}`
    : lead.status === 'atrasados'
      ? `${meta.label} — atrasado ${lead.days_overdue} ${lead.days_overdue === 1 ? 'dia' : 'dias'}`
      : lead.status === 'hoje'
        ? `${meta.label} — hoje`
        : `${meta.label} — amanhã`

  const handleSend = async () => {
    setSending(true); setSendError(null)
    const res = await onSend(lead.id, rule, pickedInstance)
    if (!res.ok) setSendError(res.error ?? 'Erro')
    setSending(false)
  }
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {}
  }
  const handleMark = async () => {
    setMarking(true)
    await onMark(lead.id, rule)
    setMarking(false)
  }

  return (
    <div style={{
      background: T.card,
      border: `1px solid ${T.border}`,
      borderRadius: 16,
      padding: '18px 18px 16px',
      marginBottom: 12,
      boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
    }}>
      {/* Top row: name + phone + badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 16, fontWeight: 700, color: T.ink,
            lineHeight: 1.2, marginBottom: 4,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {lead.name ?? '— sem nome —'}
          </div>
          <div style={{ fontSize: 13, color: T.inkSoft, fontFamily: 'ui-monospace, monospace' }}>
            {formatPhone(lead.phone)}
          </div>
        </div>
        {/* Rule badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: meta.bg, color: meta.text,
          padding: '4px 10px', borderRadius: 99,
          fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.dot }} />
          {meta.label}
        </div>
      </div>

      {/* Status pill */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: isHistory ? T.bgWhats : meta.bg,
        color: isHistory ? T.whatsappDeep : meta.text,
        padding: '5px 12px', borderRadius: 99,
        fontSize: 12, fontWeight: 600,
        marginBottom: 12,
      }}>
        <span style={{ fontSize: 11 }}>{isHistory ? '✓' : '📅'}</span>
        {statusText}
      </div>

      {/* Notes/instance for history */}
      {isHistory && (
        <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 12, lineHeight: 1.5 }}>
          {lead.instance_used && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: T.bgWhats, color: T.whatsappDeep,
              padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
              marginRight: 6,
            }}>
              📱 {lead.instance_used} {lead.send_method === 'evolution' && '🚀'}
            </span>
          )}
          {lead.notes && <em>"{lead.notes}"</em>}
        </div>
      )}

      {/* Message preview */}
      {!isHistory && message && (
        <div style={{
          background: T.purpleBg, border: `1px solid ${T.purpleSoft}`,
          borderRadius: 10, padding: '10px 14px',
          fontSize: 13, color: T.ink, lineHeight: 1.5, marginBottom: 12,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          maxHeight: 90, overflow: 'hidden', position: 'relative',
        }}>
          {message.slice(0, 200)}{message.length > 200 ? '…' : ''}
        </div>
      )}

      {/* Instance selector (compact) */}
      {!isHistory && instances.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {showInstanceDropdown ? (
            <select
              value={pickedInstance}
              onChange={e => { setPickedInstance(e.target.value); setShowInstanceDropdown(false) }}
              onBlur={() => setShowInstanceDropdown(false)}
              autoFocus
              style={{
                width: '100%', padding: '8px 10px', fontSize: 12,
                border: `1px solid ${T.border}`, borderRadius: 8,
                background: '#fff', fontFamily: 'inherit', outline: 'none',
              }}
            >
              {instances.map(i => (
                <option key={i.name} value={i.name}>
                  📱 {i.name}{i.connectionStatus !== 'open' ? ' (offline)' : ''}
                </option>
              ))}
            </select>
          ) : (
            <button
              onClick={() => setShowInstanceDropdown(true)}
              style={{
                background: 'transparent', border: 'none', padding: 0,
                fontSize: 11, color: T.inkSoft, cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              📱 Enviar via: <strong style={{ color: T.whatsappDeep }}>{pickedInstance || '—'}</strong> <span style={{ textDecoration: 'underline' }}>trocar</span>
            </button>
          )}
        </div>
      )}

      {sendError && (
        <div style={{
          fontSize: 12, color: T.red, padding: '6px 10px',
          background: T.redBg, borderRadius: 8,
          border: `1px solid ${T.redSoft}`, marginBottom: 10,
        }}>
          ✗ {sendError}
        </div>
      )}

      {/* Actions */}
      {isHistory ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <a
            href={waLink} target="_blank" rel="noopener noreferrer"
            style={{
              flex: 1, background: T.bgWhats, color: T.whatsappDeep,
              border: `1px solid ${T.whatsapp}40`, borderRadius: 10,
              padding: '10px 12px', fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              textDecoration: 'none', cursor: 'pointer',
            }}
          >
            💬 Reabrir WhatsApp
          </a>
          {onUndo && (
            <button
              onClick={() => onUndo(lead.id, rule)}
              style={{
                background: T.graySoft, color: T.inkSoft,
                border: `1px solid ${T.border}`, borderRadius: 10,
                padding: '10px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              ↶ Desfazer
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleSend}
            disabled={sending || !pickedInstance}
            style={{
              flex: 1, background: sending ? '#A7F3D0' : T.whatsapp, color: '#fff',
              border: 'none', borderRadius: 10, padding: '10px 12px',
              fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
              cursor: sending || !pickedInstance ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              boxShadow: sending ? 'none' : `0 2px 6px ${T.whatsapp}55`,
            }}
          >
            <span style={{ fontSize: 14 }}>💬</span>
            {sending ? 'Enviando…' : 'WhatsApp'}
          </button>
          <button
            onClick={handleCopy}
            style={{
              flex: 1, background: copied ? T.bgWhats : T.graySoft,
              color: copied ? T.whatsappDeep : T.ink,
              border: `1px solid ${copied ? T.whatsapp + '40' : T.border}`,
              borderRadius: 10, padding: '10px 12px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'all 0.2s',
            }}
          >
            <span style={{ fontSize: 14 }}>{copied ? '✓' : '📋'}</span>
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
          <button
            onClick={handleMark}
            disabled={marking}
            title="Marcar como contatado (sem enviar)"
            style={{
              width: 42, background: T.graySoft, color: T.inkSoft,
              border: `1px solid ${T.border}`, borderRadius: 10,
              fontSize: 16, cursor: marking ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'inherit',
            }}
          >
            ✓
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Column ──────────────────────────────────────────────────
function KanbanColumn({ title, count, icon, iconColor, iconBg, accentColor, children, collapsible, collapsed, onToggleCollapse }: {
  title: string
  count: number
  icon: string
  iconColor: string
  iconBg: string
  accentColor: string
  children: React.ReactNode
  collapsible?: boolean
  collapsed?: boolean
  onToggleCollapse?: () => void
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <button
        onClick={onToggleCollapse}
        disabled={!collapsible}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px', marginBottom: 14,
          background: '#fff', border: `1px solid ${T.border}`,
          borderRadius: 12, cursor: collapsible ? 'pointer' : 'default',
          fontFamily: 'inherit',
        }}
      >
        <div style={{
          width: 26, height: 26, borderRadius: 8,
          background: iconBg, color: iconColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, flexShrink: 0,
        }}>
          {icon}
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: T.ink, flex: 1, textAlign: 'left' }}>
          {title}
        </span>
        <span style={{
          background: T.graySoft, color: T.inkSoft,
          padding: '3px 10px', borderRadius: 99,
          fontSize: 12, fontWeight: 700, minWidth: 26, textAlign: 'center',
        }}>
          {count}
        </span>
      </button>
      {!collapsed && <div>{children}</div>}
    </div>
  )
}

// ─── Pill filter ─────────────────────────────────────────────
function FilterPill({ label, active, onClick, icon, count }: {
  label: string
  active: boolean
  onClick: () => void
  icon?: string
  count?: number
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? '#fff' : 'transparent',
        color: T.ink, border: 'none',
        padding: '8px 16px', borderRadius: 10,
        fontSize: 13, fontWeight: 600, cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06), 0 2px 6px rgba(0,0,0,0.04)' : 'none',
        transition: 'all 0.18s',
      }}
    >
      {icon && <span style={{ fontSize: 13 }}>{icon}</span>}
      {label}
      {count !== undefined && count > 0 && (
        <span style={{
          background: active ? T.graySoft : 'rgba(15,23,42,0.08)',
          color: T.inkSoft,
          padding: '1px 8px', borderRadius: 99,
          fontSize: 11, fontWeight: 700,
        }}>
          {count}
        </span>
      )}
    </button>
  )
}

// ─── Templates editor ────────────────────────────────────────
function TemplatesPanel({ templates, instances, onUpdate, onUpdateInstance }: {
  templates: Template[]
  instances: EvoInstance[]
  onUpdate: (rule: number, message: string) => Promise<void>
  onUpdateInstance: (rule: number, instance: string) => Promise<void>
}) {
  const [editing, setEditing] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState<number | null>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 720 }}>
      <div style={{
        padding: '12px 16px', background: T.yellowBg, borderRadius: 10,
        border: `1px solid ${T.yellowSoft}`, fontSize: 13, color: '#713F12',
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
            background: '#fff', border: `1px solid ${T.border}`, borderRadius: 14,
            padding: '18px 20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 13, fontWeight: 700, color: m.text,
                padding: '5px 12px', background: m.bg, borderRadius: 99,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.dot }} />
                {m.label}
              </div>
              <div style={{ flex: 1 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: T.inkSoft, fontWeight: 600 }}>Número default:</span>
                <select
                  value={tpl.default_instance ?? ''}
                  onChange={e => onUpdateInstance(tpl.rule_days, e.target.value)}
                  style={{
                    padding: '6px 10px', fontSize: 12, borderRadius: 8,
                    border: `1px solid ${T.border}`, background: '#fff',
                    fontFamily: 'inherit', cursor: 'pointer',
                  }}
                >
                  <option value="">— escolher na hora —</option>
                  {instances.map(i => (
                    <option key={i.name} value={i.name}>📱 {i.name}</option>
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
                  background: T.graySoft, color: T.ink, border: 'none',
                  padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>Cancelar</button>
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
                  background: dirty ? T.whatsapp : '#E5E7EB',
                  color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8,
                  fontSize: 12, fontWeight: 700, cursor: dirty && !isSaving ? 'pointer' : 'default',
                  fontFamily: 'inherit',
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
// ║                Main                                      ║
// ╚══════════════════════════════════════════════════════════╝
export default function FollowupClient() {
  const [view, setView] = useState<View>('kanban')
  const [ruleFilter, setRuleFilter] = useState<RuleFilter>('todos')
  const [kanban, setKanban] = useState<{ atrasados: Lead[]; hoje: Lead[]; amanha: Lead[] }>({
    atrasados: [], hoje: [], amanha: [],
  })
  const [counts, setCounts] = useState<{ atrasados: number; hoje: number; amanha: number; total: number }>({
    atrasados: 0, hoje: 0, amanha: 0, total: 0,
  })
  const [ruleCounts, setRuleCounts] = useState<Record<string, number>>({ '20': 0, '60': 0, '120': 0 })
  const [history, setHistory] = useState<Lead[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [instances, setInstances] = useState<EvoInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsedAmanha, setCollapsedAmanha] = useState(false)

  const templateMap = useMemo(() => {
    const m = new Map<number, Template>()
    for (const t of templates) m.set(t.rule_days, t)
    return m
  }, [templates])

  const loadKanban = useCallback(async () => {
    setLoading(true)
    try {
      const ruleQuery = ruleFilter !== 'todos' ? `&rule=${ruleFilter}` : ''
      const res = await fetch(`/api/followup?mode=kanban${ruleQuery}`)
      const data = await res.json()
      setKanban({
        atrasados: data.atrasados ?? [],
        hoje: data.hoje ?? [],
        amanha: data.amanha ?? [],
      })
      setCounts(data.counts ?? { atrasados: 0, hoje: 0, amanha: 0, total: 0 })
      setRuleCounts(data.ruleCounts ?? {})
    } catch {
      setKanban({ atrasados: [], hoje: [], amanha: [] })
    } finally {
      setLoading(false)
    }
  }, [ruleFilter])

  const loadHistory = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/followup?mode=history')
      const data = await res.json()
      setHistory(data.leads ?? [])
    } catch {
      setHistory([])
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
  useEffect(() => {
    if (view === 'kanban') loadKanban()
    else if (view === 'history') loadHistory()
    else loadTemplates()
  }, [view, loadKanban, loadHistory, loadTemplates])
  useEffect(() => {
    if (view === 'kanban') loadKanban()
  }, [ruleFilter, view, loadKanban])

  const handleSend = useCallback(async (leadId: string, rule: Rule, instance: string) => {
    try {
      const res = await fetch('/api/followup/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, rule_days: rule, instance_name: instance }),
      })
      const data = await res.json()
      if (!res.ok) return { ok: false, error: data.error ?? 'Erro' }
      await loadKanban()
      return { ok: true }
    } catch (err: any) {
      return { ok: false, error: err?.message ?? 'Erro de rede' }
    }
  }, [loadKanban])

  const handleMark = useCallback(async (leadId: string, rule: Rule) => {
    const res = await fetch('/api/followup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: leadId, rule_days: rule }),
    })
    if (res.ok) await loadKanban()
  }, [loadKanban])

  const handleUndo = useCallback(async (leadId: string, rule: Rule) => {
    if (!confirm('Desfazer este contato? O lead voltará para a fila pendente.')) return
    const res = await fetch(`/api/followup?lead_id=${leadId}&rule_days=${rule}`, { method: 'DELETE' })
    if (res.ok) await loadHistory()
  }, [loadHistory])

  const handleUpdateTemplate = useCallback(async (rule: number, message: string) => {
    await fetch('/api/followup/templates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rule_days: rule, message }),
    })
    await loadTemplates()
  }, [loadTemplates])

  const handleUpdateTemplateInstance = useCallback(async (rule: number, instance: string) => {
    await fetch('/api/followup/templates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rule_days: rule, default_instance: instance }),
    })
    await loadTemplates()
  }, [loadTemplates])

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1320, minHeight: '100%', background: T.bg }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          fontSize: 28, fontWeight: 800, color: T.ink, marginBottom: 4,
        }}>
          <span style={{
            width: 40, height: 40, borderRadius: 12,
            background: T.blueBg, color: T.blue,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20,
          }}>
            🔔
          </span>
          Follow-up
        </div>
        <div style={{ fontSize: 14, color: T.inkSoft, paddingLeft: 52 }}>
          Juliane · <strong style={{ color: T.ink }}>{counts.total}</strong> {counts.total === 1 ? 'tarefa pendente' : 'tarefas pendentes'}
        </div>
      </div>

      {/* Filter bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 22, flexWrap: 'wrap',
      }}>
        {view === 'kanban' && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: T.graySoft, padding: 4, borderRadius: 12,
          }}>
            <FilterPill label="Todos" icon="🎯" active={ruleFilter === 'todos'} onClick={() => setRuleFilter('todos')} />
            <FilterPill label="20 dias" active={ruleFilter === 20} onClick={() => setRuleFilter(20)} count={ruleCounts['20']} />
            <FilterPill label="60 dias" active={ruleFilter === 60} onClick={() => setRuleFilter(60)} count={ruleCounts['60']} />
            <FilterPill label="120 dias" active={ruleFilter === 120} onClick={() => setRuleFilter(120)} count={ruleCounts['120']} />
          </div>
        )}

        <div style={{ flex: 1 }} />

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: T.graySoft, padding: 4, borderRadius: 12,
        }}>
          <FilterPill label="Kanban" icon="📋" active={view === 'kanban'} onClick={() => setView('kanban')} />
          <FilterPill label="Histórico" icon="🕓" active={view === 'history'} onClick={() => setView('history')} />
          <FilterPill label="Mensagens" icon="✏️" active={view === 'templates'} onClick={() => setView('templates')} />
        </div>
      </div>

      {/* Content */}
      {loading && view !== 'templates' ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: T.inkSoft }}>
          Carregando…
        </div>
      ) : view === 'templates' ? (
        <TemplatesPanel
          templates={templates}
          instances={instances}
          onUpdate={handleUpdateTemplate}
          onUpdateInstance={handleUpdateTemplateInstance}
        />
      ) : view === 'history' ? (
        history.length === 0 ? (
          <EmptyState
            icon="🕓"
            title="Nenhum followup registrado ainda"
            subtitle="Os contatos feitos aparecerão aqui com data, número usado e notas."
          />
        ) : (
          <div style={{ maxWidth: 720 }}>
            {history.map(lead => (
              <FollowupCard
                key={lead.followup_id}
                lead={lead}
                template={templateMap.get(lead.rule_days)}
                instances={instances}
                onSend={handleSend}
                onMark={handleMark}
                onUndo={handleUndo}
                isHistory
              />
            ))}
          </div>
        )
      ) : (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {/* Atrasados */}
          <KanbanColumn
            title="Atrasados"
            count={kanban.atrasados.length}
            icon="!"
            iconColor={T.red}
            iconBg={T.redSoft}
            accentColor={T.red}
          >
            {kanban.atrasados.length === 0 ? (
              <ColumnEmpty text="Nenhum atrasado ✨" />
            ) : (
              kanban.atrasados.map(lead => (
                <FollowupCard
                  key={`${lead.id}-${lead.rule_days}`}
                  lead={lead}
                  template={templateMap.get(lead.rule_days)}
                  instances={instances}
                  onSend={handleSend}
                  onMark={handleMark}
                />
              ))
            )}
          </KanbanColumn>

          {/* Hoje */}
          <KanbanColumn
            title="Hoje"
            count={kanban.hoje.length}
            icon="📅"
            iconColor={T.orange}
            iconBg={T.orangeSoft}
            accentColor={T.orange}
          >
            {kanban.hoje.length === 0 ? (
              <ColumnEmpty text="Nada pra hoje" />
            ) : (
              kanban.hoje.map(lead => (
                <FollowupCard
                  key={`${lead.id}-${lead.rule_days}`}
                  lead={lead}
                  template={templateMap.get(lead.rule_days)}
                  instances={instances}
                  onSend={handleSend}
                  onMark={handleMark}
                />
              ))
            )}
          </KanbanColumn>

          {/* Amanhã */}
          <KanbanColumn
            title="Amanhã"
            count={kanban.amanha.length}
            icon={collapsedAmanha ? '▸' : '▾'}
            iconColor={T.blue}
            iconBg={T.blueSoft}
            accentColor={T.blue}
            collapsible
            collapsed={collapsedAmanha}
            onToggleCollapse={() => setCollapsedAmanha(c => !c)}
          >
            {kanban.amanha.length === 0 ? (
              <ColumnEmpty text="Calmaria por aqui" />
            ) : (
              kanban.amanha.map(lead => (
                <FollowupCard
                  key={`${lead.id}-${lead.rule_days}`}
                  lead={lead}
                  template={templateMap.get(lead.rule_days)}
                  instances={instances}
                  onSend={handleSend}
                  onMark={handleMark}
                />
              ))
            )}
          </KanbanColumn>
        </div>
      )}
    </div>
  )
}

function ColumnEmpty({ text }: { text: string }) {
  return (
    <div style={{
      background: '#fff', border: `1px dashed ${T.border}`, borderRadius: 12,
      padding: '24px 16px', textAlign: 'center', fontSize: 13, color: T.inkMuted,
    }}>
      {text}
    </div>
  )
}

function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div style={{
      background: '#fff', border: `1px solid ${T.border}`, borderRadius: 16,
      padding: '60px 24px', textAlign: 'center', maxWidth: 720,
    }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: T.ink, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: T.inkSoft, maxWidth: 360, margin: '0 auto', lineHeight: 1.5 }}>{subtitle}</div>
    </div>
  )
}
