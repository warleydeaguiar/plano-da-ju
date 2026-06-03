'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── Design tokens ───────────────────────────────────────────
const T = {
  bg:         '#F9FAFB',
  card:       '#FFFFFF',
  ink:        '#0F172A',
  inkSoft:    '#64748B',
  inkMuted:   '#94A3B8',
  border:     '#E5E7EB',
  borderSoft: '#F1F5F9',

  pink:       '#BE185D',
  pinkSoft:   '#FCE4EA',
  pinkBg:     '#FFF5F7',

  green:      '#22C55E',
  greenSoft:  '#DCFCE7',
  greenBg:    '#F0FDF4',

  blue:       '#3B82F6',
  blueSoft:   '#DBEAFE',
  blueBg:     '#EFF6FF',

  orange:     '#F97316',
  orangeSoft: '#FFEDD5',

  red:        '#EF4444',
  redSoft:    '#FEE2E2',
  redBg:      '#FEF2F2',

  yellow:     '#F59E0B',
  yellowSoft: '#FEF3C7',
  yellowBg:   '#FFFBEB',

  gray:       '#94A3B8',
  graySoft:   '#F1F5F9',
}

type View = 'dashboard' | 'broadcast' | 'historico' | 'higiene' | 'sequencias' | 'teste'

interface Sequence {
  id: string
  name: string
  delay_days: number
  delay_minutes: number
  audience: 'all' | 'no_purchase' | 'customers'
  anchor_event: 'lead_created' | 'purchase'
  subject: string
  html_body: string
  text_body: string
  quiz_slug: string | null
  enabled: boolean
  send_hour: number
  created_at: string
}

// ─── Helpers de delay ─────────────────────────────────────────
function totalMinutes(seq: { delay_days: number; delay_minutes: number }): number {
  return (Number(seq.delay_days) || 0) * 1440 + (Number(seq.delay_minutes) || 0)
}
function formatDelay(seq: { delay_days: number; delay_minutes: number }): string {
  const m = totalMinutes(seq)
  if (m === 0) return 'imediato'
  if (m < 60) return `+${m}min`
  if (m < 1440) return `+${Math.round(m / 60)}h`
  const days = Math.floor(m / 1440)
  const rest = m % 1440
  if (rest === 0) return `+${days}d`
  return `+${days}d${Math.round(rest / 60)}h`
}
const AUDIENCE_LABEL: Record<string, string> = {
  all: 'todos',
  no_purchase: 'não compradores',
  customers: 'clientes',
}
const ANCHOR_LABEL: Record<string, string> = {
  lead_created: 'após captura do lead',
  purchase: 'após a compra',
}

interface Metrics {
  total: number
  sent: number
  errors: number
  opened: number
  clicked: number
  openRate:  number  // opened/sent
  clickRate: number  // clicked/sent
  ctor:      number  // clicked/opened (click-to-open rate)
  totalLeads: number
  bySequence: Array<{
    id: string
    name: string
    delay_days: number
    delay_minutes?: number
    audience?: string
    anchor_event?: string
    enabled: boolean
    sent: number
    errors: number
    opened?: number
    clicked?: number
    openRate?:  number
    clickRate?: number
  }>
  daily: Array<{ date: string; count: number; label: string }>
}

// ─── Pill tab ─────────────────────────────────────────────────
function TabPill({ label, active, onClick, icon }: {
  label: string
  active: boolean
  onClick: () => void
  icon?: string
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? '#fff' : 'transparent',
        color: active ? T.ink : T.inkSoft,
        border: 'none', padding: '8px 18px', borderRadius: 10,
        fontSize: 13, fontWeight: 600, cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06), 0 2px 6px rgba(0,0,0,0.04)' : 'none',
        transition: 'all 0.18s',
      }}
    >
      {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
      {label}
    </button>
  )
}

// ─── Stat card ────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color }: {
  icon: string; label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderRadius: 14, padding: '18px 20px',
      display: 'flex', alignItems: 'flex-start', gap: 14,
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 11,
        background: color ? color + '20' : T.pinkBg,
        color: color ?? T.pink,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: T.inkMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
          {label}
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: T.ink, lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 4 }}>{sub}</div>}
      </div>
    </div>
  )
}

// ─── Dashboard view ───────────────────────────────────────────
function DashboardView({ metrics, loading }: { metrics: Metrics | null; loading: boolean }) {
  if (loading || !metrics) {
    return <div style={{ padding: '60px 20px', textAlign: 'center', color: T.inkSoft }}>Carregando…</div>
  }

  const maxDay = Math.max(...metrics.daily.map(d => d.count), 1)

  return (
    <div>
      {/* Stats — linha principal (envios + engajamento) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 14 }}>
        <StatCard
          icon="📧"
          label="Enviados"
          value={metrics.sent.toLocaleString('pt-BR')}
          sub={metrics.errors > 0 ? `${metrics.errors} com erro` : 'todos com sucesso'}
        />
        <StatCard
          icon="👁️"
          label="Aberturas"
          value={`${metrics.openRate}%`}
          sub={`${metrics.opened.toLocaleString('pt-BR')} de ${metrics.sent.toLocaleString('pt-BR')}`}
          color={T.blue}
        />
        <StatCard
          icon="🖱️"
          label="Cliques"
          value={`${metrics.clickRate}%`}
          sub={`${metrics.clicked.toLocaleString('pt-BR')} de ${metrics.sent.toLocaleString('pt-BR')}`}
          color={T.pink}
        />
        <StatCard
          icon="🎯"
          label="CTOR"
          value={`${metrics.ctor}%`}
          sub="cliques entre quem abriu"
          color={T.green}
        />
      </div>

      {/* Stats — linha secundária (base + erros) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 14 }}>
        <StatCard icon="👥" label="Leads na base" value={metrics.totalLeads.toLocaleString('pt-BR')} color={T.gray} />
        <StatCard icon="📭" label="Erros" value={metrics.errors} color={metrics.errors > 0 ? T.red : T.green} />
        <StatCard icon="📊" label="Total registros" value={metrics.total.toLocaleString('pt-BR')} color={T.gray} />
      </div>

      {/* Aviso sobre Mail Privacy */}
      <div style={{
        background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10,
        padding: '10px 14px', marginBottom: 24,
        fontSize: 12, color: '#9A3412', lineHeight: 1.5,
      }}>
        ℹ️ Aberturas incluem o <strong>Apple Mail Privacy Protection</strong> e o Gmail Image Proxy, que pré-carregam imagens server-side. Isso pode inflar o número em ~20-30% (especialmente em iPhones). <strong>Cliques são mais confiáveis</strong> como métrica real de engajamento.
      </div>

      {/* Daily chart */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: '20px 22px', marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, marginBottom: 18 }}>Envios — últimos 7 dias</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80 }}>
          {metrics.daily.map(d => (
            <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.inkSoft }}>{d.count || ''}</div>
              <div style={{
                width: '100%',
                height: Math.max(4, Math.round((d.count / maxDay) * 60)),
                background: d.count > 0 ? T.pink : T.borderSoft,
                borderRadius: 4,
                transition: 'height 0.3s',
              }} />
              <div style={{ fontSize: 10, color: T.inkMuted }}>{d.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Per-sequence stats */}
      {metrics.bySequence.length > 0 && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: '20px 22px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, marginBottom: 16 }}>Por sequência</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {metrics.bySequence.map(seq => (
              <div key={seq.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', background: T.bg, borderRadius: 10,
                border: `1px solid ${T.border}`,
              }}>
                <div style={{
                  minWidth: 56, height: 32, padding: '0 10px', borderRadius: 8,
                  background: seq.enabled ? T.greenSoft : T.graySoft,
                  color: seq.enabled ? '#16A34A' : T.inkMuted,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 800, flexShrink: 0, whiteSpace: 'nowrap',
                }}>
                  {formatDelay({ delay_days: seq.delay_days, delay_minutes: seq.delay_minutes ?? 0 })}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{seq.name}</div>
                  <div style={{ fontSize: 11, color: T.inkMuted }}>
                    {seq.enabled ? '✓ Ativa' : '— Inativa'}
                    {seq.audience && <> · {AUDIENCE_LABEL[seq.audience] ?? seq.audience}</>}
                    {seq.anchor_event === 'purchase' && <> · pós-compra</>}
                  </div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 56 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: T.ink }}>{seq.sent}</div>
                  <div style={{ fontSize: 11, color: T.inkMuted }}>enviados</div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 64 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: seq.sent > 0 ? T.blue : T.inkMuted }}>
                    {seq.openRate ?? 0}%
                  </div>
                  <div style={{ fontSize: 11, color: T.inkMuted }}>{seq.opened ?? 0} abertos</div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 64 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: seq.sent > 0 ? T.pink : T.inkMuted }}>
                    {seq.clickRate ?? 0}%
                  </div>
                  <div style={{ fontSize: 11, color: T.inkMuted }}>{seq.clicked ?? 0} cliques</div>
                </div>
                {seq.errors > 0 && (
                  <div style={{ textAlign: 'right', minWidth: 50 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: T.red }}>{seq.errors}</div>
                    <div style={{ fontSize: 11, color: T.inkMuted }}>erros</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sequence editor ──────────────────────────────────────────
function SequenceEditor({ seq, onSave, onDelete }: {
  seq: Sequence
  onSave: (updated: Partial<Sequence> & { id: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<string | null>(null)
  const [showTest, setShowTest] = useState(false)
  const [testEmail, setTestEmail] = useState('warleydeaguiar@gmail.com')
  const [testing, setTesting] = useState(false)
  const [draft, setDraft] = useState({
    name: seq.name,
    subject: seq.subject,
    html_body: seq.html_body,
    text_body: seq.text_body,
    send_hour: seq.send_hour,
    quiz_slug: seq.quiz_slug ?? '',
  })

  const handleToggleEnabled = async () => {
    setSaving(true)
    await onSave({ id: seq.id, enabled: !seq.enabled })
    setSaving(false)
  }

  const handleSave = async () => {
    setSaving(true)
    await onSave({
      id: seq.id,
      name: draft.name,
      subject: draft.subject,
      html_body: draft.html_body,
      text_body: draft.text_body,
      send_hour: Number(draft.send_hour),
      quiz_slug: draft.quiz_slug || null,
    })
    setEditing(false)
    setSaving(false)
  }

  const handleTest = async () => {
    const to = testEmail.trim()
    if (!to || !to.includes('@')) { setRunResult('Informe um email válido para o teste'); return }
    setTesting(true)
    setRunResult(null)
    try {
      const res = await fetch('/api/email-marketing/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'single',
          to_email: to,
          subject: seq.subject,
          html_body: seq.html_body,
          text_body: seq.text_body,
        }),
      })
      const data = await res.json()
      setRunResult(data.ok ? `✓ Email de teste enviado para ${to}` : `✗ ${data.error ?? 'Erro ao enviar teste'}`)
      if (data.ok) setShowTest(false)
    } catch (e) {
      setRunResult(`✗ ${String(e)}`)
    }
    setTesting(false)
  }

  const handleRun = async () => {
    if (!confirm(`Confirmar envio da sequência "${seq.name}" para todos os leads elegíveis?`)) return
    setRunning(true)
    setRunResult(null)
    const res = await fetch('/api/email-marketing/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'sequence_run', sequence_id: seq.id }),
    })
    const data = await res.json()
    setRunResult(data.ok ? `✓ Enviado para ${data.sent} leads (${data.errors} erros, ${data.skipped} já tinham recebido)` : data.error ?? 'Erro')
    setRunning(false)
  }

  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`, borderRadius: 14,
      padding: '20px 22px', marginBottom: 14,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{
          minWidth: 64, height: 40, padding: '0 12px', borderRadius: 10,
          background: seq.enabled ? T.greenSoft : T.graySoft,
          color: seq.enabled ? '#16A34A' : T.inkMuted,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 800, flexShrink: 0, whiteSpace: 'nowrap',
        }}>
          {formatDelay(seq)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>{seq.name}</div>
          <div style={{ fontSize: 12, color: T.inkMuted }}>
            {ANCHOR_LABEL[seq.anchor_event] ?? 'após captura'} · audiência: <strong>{AUDIENCE_LABEL[seq.audience] ?? seq.audience}</strong>
            {seq.quiz_slug && <> · quiz: <strong>{seq.quiz_slug}</strong></>}
          </div>
        </div>
        {/* Toggle enabled */}
        <button
          onClick={handleToggleEnabled}
          disabled={saving}
          style={{
            padding: '7px 14px', borderRadius: 8,
            background: seq.enabled ? T.greenSoft : T.graySoft,
            color: seq.enabled ? '#16A34A' : T.inkSoft,
            border: 'none', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {seq.enabled ? '✓ Ativa' : 'Inativa'}
        </button>
        <button
          onClick={() => setEditing(e => !e)}
          style={{
            padding: '7px 14px', borderRadius: 8,
            background: editing ? T.pinkSoft : T.graySoft,
            color: editing ? T.pink : T.inkSoft,
            border: 'none', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          ✏️ Editar
        </button>
      </div>

      {/* Subject preview */}
      {!editing && (
        <div style={{
          padding: '10px 14px', background: T.pinkBg,
          border: `1px solid ${T.pinkSoft}`, borderRadius: 8,
          fontSize: 13, color: T.ink, marginBottom: 12,
        }}>
          <strong>Assunto:</strong> {seq.subject}
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: T.inkSoft, display: 'block', marginBottom: 4 }}>Nome da sequência</label>
            <input
              value={draft.name}
              onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
              style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: `1px solid ${T.border}`, borderRadius: 8, fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: T.inkSoft, display: 'block', marginBottom: 4 }}>
              Assunto do email <code style={{ fontSize: 11, background: T.graySoft, padding: '1px 5px', borderRadius: 4 }}>{'{nome}'}</code> disponível
            </label>
            <input
              value={draft.subject}
              onChange={e => setDraft(d => ({ ...d, subject: e.target.value }))}
              style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: `1px solid ${T.border}`, borderRadius: 8, fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: T.inkSoft, display: 'block', marginBottom: 4 }}>
              Corpo HTML <code style={{ fontSize: 11, background: T.graySoft, padding: '1px 5px', borderRadius: 4 }}>{'{nome}'}</code> e <code style={{ fontSize: 11, background: T.graySoft, padding: '1px 5px', borderRadius: 4 }}>{'{email}'}</code> disponíveis
            </label>
            <textarea
              value={draft.html_body}
              onChange={e => setDraft(d => ({ ...d, html_body: e.target.value }))}
              rows={8}
              style={{ width: '100%', padding: '10px 12px', fontSize: 12, fontFamily: 'ui-monospace, monospace', border: `1px solid ${T.border}`, borderRadius: 8, resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: T.inkSoft, display: 'block', marginBottom: 4 }}>Hora de envio (0–23)</label>
              <input
                type="number"
                min={0} max={23}
                value={draft.send_hour}
                onChange={e => setDraft(d => ({ ...d, send_hour: Number(e.target.value) }))}
                style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: `1px solid ${T.border}`, borderRadius: 8, fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: T.inkSoft, display: 'block', marginBottom: 4 }}>Filtrar por quiz slug (opcional)</label>
              <input
                value={draft.quiz_slug}
                onChange={e => setDraft(d => ({ ...d, quiz_slug: e.target.value }))}
                placeholder="ex: plano-capilar"
                style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: `1px solid ${T.border}`, borderRadius: 8, fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setEditing(false)}
              style={{ padding: '9px 16px', borderRadius: 8, background: T.graySoft, color: T.ink, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ padding: '9px 18px', borderRadius: 8, background: T.pink, color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {saving ? 'Salvando…' : '💾 Salvar'}
            </button>
          </div>
        </div>
      )}

      {/* Run actions */}
      {!editing && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowTest(v => !v)}
            disabled={testing}
            style={{
              padding: '8px 14px', borderRadius: 8,
              background: T.blueBg, color: T.blue,
              border: `1px solid ${T.blueSoft}`, fontSize: 12, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            ✉️ Enviar teste
          </button>
          <button
            onClick={handleRun}
            disabled={running || !seq.enabled}
            title={!seq.enabled ? 'Ative a sequência primeiro' : undefined}
            style={{
              padding: '8px 14px', borderRadius: 8,
              background: seq.enabled ? T.greenBg : T.graySoft,
              color: seq.enabled ? '#16A34A' : T.inkMuted,
              border: `1px solid ${seq.enabled ? T.greenSoft : T.border}`, fontSize: 12, fontWeight: 700,
              cursor: seq.enabled ? 'pointer' : 'default', fontFamily: 'inherit',
            }}
          >
            {running ? '⏳ Enviando…' : '▶ Enviar agora'}
          </button>
          <button
            onClick={async () => {
              if (!confirm('Excluir esta sequência?')) return
              await onDelete(seq.id)
            }}
            style={{
              padding: '8px 14px', borderRadius: 8,
              background: T.redBg, color: T.red,
              border: `1px solid ${T.redSoft}`, fontSize: 12, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto',
            }}
          >
            🗑 Excluir
          </button>
        </div>
      )}

      {/* Campo de email de teste */}
      {!editing && showTest && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="email"
            value={testEmail}
            onChange={e => setTestEmail(e.target.value)}
            placeholder="email para o teste"
            style={{
              flex: 1, minWidth: 220, padding: '8px 12px', fontSize: 13,
              border: `1px solid ${T.border}`, borderRadius: 8, fontFamily: 'inherit', outline: 'none',
            }}
          />
          <button
            onClick={handleTest}
            disabled={testing}
            style={{
              padding: '8px 16px', borderRadius: 8, background: T.pink, color: '#fff',
              border: 'none', fontSize: 12, fontWeight: 700, cursor: testing ? 'default' : 'pointer', fontFamily: 'inherit',
            }}
          >
            {testing ? '⏳ Enviando…' : '📨 Enviar para este email'}
          </button>
        </div>
      )}

      {runResult && (
        <div style={{
          marginTop: 10, padding: '8px 12px', borderRadius: 8,
          background: runResult.startsWith('✓') ? T.greenBg : T.yellowBg,
          color: runResult.startsWith('✓') ? '#16A34A' : '#713F12',
          fontSize: 12, fontWeight: 600,
          border: `1px solid ${runResult.startsWith('✓') ? T.greenSoft : T.yellowSoft}`,
        }}>
          {runResult}
        </div>
      )}
    </div>
  )
}

// ─── Test email view ──────────────────────────────────────────
function TestEmailView() {
  const [to, setTo] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; error?: string; messageId?: string } | null>(null)

  const handleSend = async () => {
    if (!to) return
    setSending(true)
    setResult(null)
    const res = await fetch('/api/email-marketing/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to }),
    })
    const data = await res.json()
    setResult(data)
    setSending(false)
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: '24px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, marginBottom: 6 }}>Enviar email de teste</div>
        <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 20 }}>
          Envia um email de teste para verificar se o AWS SES está configurado corretamente.
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="email"
            value={to}
            onChange={e => setTo(e.target.value)}
            placeholder="seu@email.com"
            style={{
              flex: 1, padding: '10px 14px', fontSize: 14,
              border: `1px solid ${T.border}`, borderRadius: 9,
              fontFamily: 'inherit', outline: 'none',
            }}
          />
          <button
            onClick={handleSend}
            disabled={sending || !to}
            style={{
              padding: '10px 20px', borderRadius: 9,
              background: T.pink, color: '#fff',
              border: 'none', fontSize: 14, fontWeight: 700,
              cursor: sending || !to ? 'default' : 'pointer',
              fontFamily: 'inherit',
              opacity: !to ? 0.5 : 1,
            }}
          >
            {sending ? '⏳ Enviando…' : '📧 Enviar'}
          </button>
        </div>

        {result && (
          <div style={{
            marginTop: 14, padding: '12px 14px', borderRadius: 9,
            background: result.ok ? T.greenBg : T.redBg,
            color: result.ok ? '#16A34A' : T.red,
            border: `1px solid ${result.ok ? T.greenSoft : T.redSoft}`,
            fontSize: 13, fontWeight: 600,
          }}>
            {result.ok
              ? `✓ Email enviado com sucesso! ID: ${result.messageId}`
              : `✗ Erro: ${result.error}`
            }
          </div>
        )}
      </div>

      {/* SMTP config info */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: '20px', marginTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 12 }}>Configuração SMTP (AWS SES)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'Host', value: 'email-smtp.us-east-1.amazonaws.com' },
            { label: 'Porta', value: '587 (STARTTLS)' },
            { label: 'Usuário', value: 'AWS_SES_SMTP_USER (env)' },
            { label: 'Senha', value: 'AWS_SES_SMTP_PASS (env)' },
            { label: 'From', value: 'AWS_SES_FROM_EMAIL (env)' },
            { label: 'Limite', value: '50.000 emails/dia' },
          ].map(item => (
            <div key={item.label} style={{ padding: '8px 12px', background: T.bg, borderRadius: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.inkMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.label}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.ink, marginTop: 2 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ╔════════════════════════════════════════════╗
// ║              Histórico View                ║
// ╚════════════════════════════════════════════╝
interface Campaign {
  campaign_id: string
  subject: string
  message: string | null
  image_url: string | null
  audience_label: string | null
  recipients_total: number
  created_at: string
  sent: number
  errors: number
  skipped: number
  opened: number
  clicked: number
  openRate: number
  clickRate: number
}

function HistoricoView() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setErr(false)
    try {
      const res = await fetch('/api/email-marketing/campaigns')
      const data = await res.json()
      setCampaigns(data.campaigns ?? [])
    } catch { setErr(true) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div style={{ color: T.inkSoft, fontSize: 14, padding: 20 }}>⏳ Carregando histórico…</div>
  if (err) return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ padding: '16px 18px', background: T.redBg, border: `1px solid ${T.redSoft}`, borderRadius: 10, fontSize: 13.5, color: '#7F1D1D' }}>
        Não consegui carregar o histórico. <button onClick={load} style={{ marginLeft: 8, background: 'none', border: 'none', color: T.pink, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Tentar de novo</button>
      </div>
    </div>
  )
  if (campaigns.length === 0) return (
    <div style={{ maxWidth: 720, textAlign: 'center', padding: '60px 20px', color: T.inkSoft }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, marginBottom: 6 }}>Nenhuma campanha enviada ainda</div>
      <div style={{ fontSize: 13 }}>Quando você disparar um broadcast, ele aparece aqui com os resultados.</div>
    </div>
  )

  const fmtDate = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: T.inkSoft }}>{campaigns.length} {campaigns.length === 1 ? 'campanha enviada' : 'campanhas enviadas'}</div>
        <button onClick={load} style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 8, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, color: T.ink, cursor: 'pointer', fontFamily: 'inherit' }}>↻ Atualizar</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {campaigns.map(c => {
          const isOpen = openId === c.campaign_id
          return (
            <div key={c.campaign_id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <button onClick={() => setOpenId(isOpen ? null : c.campaign_id)} style={{
                width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
                padding: '14px 16px', fontFamily: 'inherit',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.subject}</div>
                    <div style={{ fontSize: 12, color: T.inkMuted, marginTop: 3 }}>{fmtDate(c.created_at)} · {c.audience_label ?? 'base'}</div>
                  </div>
                  <div style={{ fontSize: 18, color: T.inkMuted, flexShrink: 0 }}>{isOpen ? '▴' : '▾'}</div>
                </div>
                <div style={{ display: 'flex', gap: 18, marginTop: 12, flexWrap: 'wrap' }}>
                  <Stat label="Enviados" value={c.sent.toLocaleString('pt-BR')} color={T.ink} />
                  <Stat label="Abertura" value={`${c.openRate}%`} sub={`${c.opened.toLocaleString('pt-BR')}`} color={T.blue} />
                  <Stat label="Cliques" value={`${c.clickRate}%`} sub={`${c.clicked.toLocaleString('pt-BR')}`} color={T.green} />
                  {c.errors > 0 && <Stat label="Erros" value={c.errors.toLocaleString('pt-BR')} color={T.red} />}
                  {c.skipped > 0 && <Stat label="Pulados" value={c.skipped.toLocaleString('pt-BR')} color={T.inkMuted} />}
                </div>
              </button>
              {isOpen && (
                <div style={{ borderTop: `1px solid ${T.borderSoft}`, padding: '14px 16px', background: T.bg }}>
                  {c.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.image_url} alt="" style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 8, marginBottom: 12, display: 'block' }} />
                  )}
                  <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                    {c.message || <span style={{ color: T.inkMuted }}>— sem texto salvo —</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: T.inkMuted, marginTop: 12 }}>
                    Destinatários no disparo: {c.recipients_total.toLocaleString('pt-BR')} · ID: {c.campaign_id}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: T.inkMuted, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color, marginTop: 2 }}>
        {value}{sub && <span style={{ fontSize: 11.5, fontWeight: 600, color: T.inkMuted, marginLeft: 5 }}>({sub})</span>}
      </div>
    </div>
  )
}

// ╔════════════════════════════════════════════╗
// ║              Broadcast View                ║
// ╚════════════════════════════════════════════╝
type Audience = 'all' | 'customers' | 'leads_no_purchase'

/**
 * Lê a resposta como texto e tenta parsear JSON. Se o servidor devolver
 * texto cru (timeout/erro de plataforma → "An error occurred…"), converte
 * num erro legível em vez de quebrar com "Unexpected token".
 */
async function parseJsonSafe(res: Response): Promise<any> {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    const hint = res.status >= 500
      ? `O servidor demorou ou falhou (HTTP ${res.status}). Confira o Histórico pra ver o que já saiu.`
      : `Resposta inesperada do servidor (HTTP ${res.status}).`
    throw new Error(hint)
  }
}

function BroadcastView() {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [uploadingImg, setUploadingImg] = useState(false)
  const [uploadErr, setUploadErr] = useState<string | null>(null)
  const [audience, setAudience] = useState<Audience>('all')
  const [excludeCold, setExcludeCold] = useState(true)
  const [reach, setReach] = useState<{ count: number; customers: number; leads: number; sample: { name: string | null; email: string; kind: string }[] } | null>(null)
  const [calc, setCalc] = useState(false)
  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [result, setResult] = useState<{ ok: boolean; sent?: number; errors?: number; skipped?: number; total?: number; error?: string } | null>(null)

  const filters = { audience, exclude_cold: excludeCold }

  const calcReach = async () => {
    setCalc(true); setReach(null); setResult(null)
    try {
      const res = await fetch('/api/email-marketing/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'broadcast_email', subject: subject || 'preview', message: message || 'preview', filters, dry_run: true }),
      })
      const data = await parseJsonSafe(res)
      if (data.ok) setReach({ count: data.count, customers: data.customers, leads: data.leads, sample: data.sample ?? [] })
      else setResult({ ok: false, error: data.error ?? 'Falha ao calcular alcance' })
    } catch (e) { setResult({ ok: false, error: e instanceof Error ? e.message : String(e) }) }
    setCalc(false)
  }

  const send = async () => {
    if (!subject.trim() || !message.trim()) { setResult({ ok: false, error: 'Preencha assunto e mensagem' }); return }
    const n = reach?.count ?? 0
    if (!confirm(`Enviar esta campanha para ${n > 0 ? n : 'a base filtrada'} ${n === 1 ? 'pessoa' : 'pessoas'}? Esta ação não pode ser desfeita.`)) return
    setSending(true); setResult(null); setProgress(null)
    try {
      // 1) Enfileira a campanha (rápido — não envia ainda)
      const res = await fetch('/api/email-marketing/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'broadcast_email', subject: subject.trim(), message: message.trim(), image_url: imageUrl.trim() || null, filters }),
      })
      const data = await parseJsonSafe(res)
      if (!data.ok) { setResult({ ok: false, error: data.error ?? 'Falha ao enfileirar' }); setSending(false); return }

      const campaignId = data.campaign_id as string
      const total = data.queued ?? data.total ?? 0
      if (total === 0) { setResult({ ok: true, sent: 0, errors: 0, skipped: 0, total: 0 }); setSending(false); return }

      // 2) Drena em lotes até zerar (cada chamada cabe no limite da função)
      setProgress({ done: 0, total })
      let guard = 0
      const maxIters = Math.ceil(total / 100) + 20 // margem de segurança
      let totals = { sent: 0, errors: 0, skipped: 0 }
      while (guard++ < maxIters) {
        const dr = await fetch('/api/email-marketing/send', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'broadcast_drain', campaign_id: campaignId }),
        })
        const dd = await parseJsonSafe(dr)
        if (!dd.ok) { setResult({ ok: false, error: dd.error ?? 'Falha ao enviar lote' }); setSending(false); return }
        if (dd.totals) totals = dd.totals
        const done = total - (dd.remaining ?? 0)
        setProgress({ done, total })
        if ((dd.remaining ?? 0) <= 0) break
        if ((dd.processed ?? 0) === 0) break // nada avançou — evita loop infinito
      }

      setResult({ ok: true, sent: totals.sent, errors: totals.errors, skipped: totals.skipped, total })
      setReach(null)
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : String(e) })
    }
    setProgress(null)
    setSending(false)
  }

  const uploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadingImg(true); setUploadErr(null)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await fetch('/api/email-marketing/upload-image', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.ok && data.url) setImageUrl(data.url)
      else setUploadErr(data.error ?? 'Falha no upload')
    } catch { setUploadErr('Falha no upload') }
    setUploadingImg(false)
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', fontSize: 14, border: `1px solid ${T.border}`, borderRadius: 9, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: T.inkSoft, marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: 0.4 }

  const audienceOpts: { v: Audience; label: string; desc: string }[] = [
    { v: 'all', label: 'Toda a base', desc: 'clientes + leads' },
    { v: 'customers', label: 'Só clientes ativos', desc: 'quem assina o plano' },
    { v: 'leads_no_purchase', label: 'Leads que não compraram', desc: 'ainda não assinaram' },
  ]

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, marginBottom: 4 }}>Nova campanha (broadcast)</div>
        <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 20 }}>
          Envia uma promoção para a base filtrada. Descadastrados são removidos automaticamente e todo email leva link de descadastro.
        </div>

        {/* Audiência */}
        <label style={labelStyle}>Para quem</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
          {audienceOpts.map(o => (
            <button key={o.v} onClick={() => { setAudience(o.v); setReach(null) }} style={{
              padding: '12px 10px', borderRadius: 10, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
              border: `2px solid ${audience === o.v ? T.pink : T.border}`,
              background: audience === o.v ? T.pinkBg : '#fff',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: audience === o.v ? T.pink : T.ink }}>{o.label}</div>
              <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 2 }}>{o.desc}</div>
            </button>
          ))}
        </div>

        {/* Exclude cold */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, cursor: 'pointer' }}>
          <input type="checkbox" checked={excludeCold} onChange={e => { setExcludeCold(e.target.checked); setReach(null) }} />
          <span style={{ fontSize: 13, color: T.ink }}>
            Não enviar para contatos <strong>frios</strong> (receberam 4+ emails há mais de 30 dias e nunca abriram) — protege a entregabilidade
          </span>
        </label>

        <label style={labelStyle}>Assunto</label>
        <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Ex: 🎁 Promoção especial pra você" style={{ ...inputStyle, marginBottom: 14 }} />

        <label style={labelStyle}>Mensagem</label>
        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={7} placeholder="Escreva sua mensagem… (quebras de linha viram parágrafos)" style={{ ...inputStyle, marginBottom: 14, resize: 'vertical' }} />

        <label style={labelStyle}>Imagem (opcional)</label>
        {imageUrl ? (
          <div style={{ marginBottom: 18, border: `1px solid ${T.border}`, borderRadius: 10, padding: 10, background: T.bg }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 6, display: 'block', margin: '0 auto' }} />
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
              <button onClick={() => setImageUrl('')} style={{ background: 'none', border: 'none', color: T.red, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                ✕ Remover imagem
              </button>
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 18 }}>
            <label style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '14px', border: `2px dashed ${T.border}`, borderRadius: 10,
              cursor: uploadingImg ? 'default' : 'pointer', background: T.bg,
              fontSize: 13.5, fontWeight: 700, color: uploadingImg ? T.inkMuted : T.pink,
            }}>
              <input type="file" accept="image/*" onChange={uploadImage} disabled={uploadingImg} style={{ display: 'none' }} />
              {uploadingImg ? '⏳ Enviando imagem…' : '📷 Enviar imagem do computador'}
            </label>
            <div style={{ fontSize: 11.5, color: T.inkMuted, marginTop: 6, textAlign: 'center' }}>
              JPG, PNG, GIF ou WebP · até 5 MB · ou cole uma URL abaixo
            </div>
            <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://…/banner.jpg (opcional)" style={{ ...inputStyle, marginTop: 8 }} />
            {uploadErr && <div style={{ fontSize: 12, color: T.red, marginTop: 6 }}>{uploadErr}</div>}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={calcReach} disabled={calc} style={{ padding: '10px 18px', borderRadius: 9, background: '#fff', border: `1px solid ${T.border}`, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: T.ink }}>
            {calc ? '⏳ Calculando…' : '🔍 Calcular alcance'}
          </button>
          <button onClick={send} disabled={sending || !subject.trim() || !message.trim()} style={{ padding: '10px 22px', borderRadius: 9, background: T.pink, color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: sending ? 'default' : 'pointer', fontFamily: 'inherit', opacity: (!subject.trim() || !message.trim()) ? 0.5 : 1 }}>
            {sending ? '⏳ Enviando…' : '📨 Enviar campanha'}
          </button>
        </div>

        {progress && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12.5, color: T.inkSoft, marginBottom: 6 }}>
              Enviando… <strong>{progress.done.toLocaleString('pt-BR')}</strong> de {progress.total.toLocaleString('pt-BR')}
              {' '}— mantenha esta aba aberta até concluir.
            </div>
            <div style={{ height: 8, borderRadius: 99, background: T.border, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%`, background: T.pink, transition: 'width 0.3s' }} />
            </div>
          </div>
        )}

        {reach && (
          <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 10, background: T.blueBg, border: `1px solid ${T.blueSoft}`, fontSize: 13, color: T.ink }}>
            Alcance: <strong>{reach.count}</strong> {reach.count === 1 ? 'pessoa' : 'pessoas'} ({reach.customers} clientes · {reach.leads} leads)
            {reach.sample.length > 0 && (
              <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 6 }}>
                Ex: {reach.sample.slice(0, 5).map(s => s.email).join(', ')}…
              </div>
            )}
          </div>
        )}

        {result && (
          <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 10, background: result.ok ? T.greenBg : T.redBg, border: `1px solid ${result.ok ? T.greenSoft : T.redSoft}`, fontSize: 13, fontWeight: 600, color: result.ok ? '#16A34A' : T.red }}>
            {result.ok
              ? `✓ Enviado: ${result.sent} · pulados (descadastro): ${result.skipped ?? 0} · erros: ${result.errors ?? 0} (de ${result.total})`
              : `✗ ${result.error}`}
          </div>
        )}
      </div>
    </div>
  )
}

// ╔════════════════════════════════════════════╗
// ║            Higienização View               ║
// ╚════════════════════════════════════════════╝
function HygieneView() {
  type HygData = {
    total: number
    counts: Record<string, number>
    params: { engaged_window_days: number; cold_min_sent: number; cold_min_age_days: number }
    samples: { frio: { email: string; name: string | null; sent: number; opened: number; clicked: number }[] }
  }
  const [data, setData] = useState<HygData | null>(null)
  const [loading, setLoading] = useState(true)
  const [cleaning, setCleaning] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/email-marketing/hygiene')
      const d = await res.json()
      if (d.ok) setData(d)
    } catch {}
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const clean = async () => {
    const n = data?.counts?.frio ?? 0
    if (n === 0) return
    if (!confirm(`Descadastrar ${n} contatos frios (nunca abriram após vários envios)? Eles param de receber promoções. Pode ser revertido manualmente no banco.`)) return
    setCleaning(true); setMsg(null)
    try {
      const res = await fetch('/api/email-marketing/hygiene', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'suppress_cold' }),
      })
      const d = await res.json()
      if (d.ok) { setMsg(`✓ ${d.suppressed} contatos descadastrados.`); await load() }
      else setMsg(`✗ ${d.error}`)
    } catch (e) { setMsg(`✗ ${String(e)}`) }
    setCleaning(false)
  }

  const segMeta: { key: string; label: string; desc: string; color: string; bg: string }[] = [
    { key: 'engajado', label: 'Engajados', desc: 'abriram/clicaram recentemente', color: '#16A34A', bg: T.greenBg },
    { key: 'esfriando', label: 'Esfriando', desc: 'já abriram, mas não recentemente', color: T.orange, bg: T.orangeSoft },
    { key: 'frio', label: 'Frios', desc: 'nunca abriram após várias chances', color: T.red, bg: T.redBg },
    { key: 'protegido', label: 'Protegidos', desc: 'novos/poucos envios — dando tempo', color: T.blue, bg: T.blueBg },
    { key: 'descadastrado', label: 'Descadastrados', desc: 'saíram da lista (opt-out)', color: T.inkSoft, bg: T.graySoft },
  ]

  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ padding: '12px 16px', background: T.blueBg, borderRadius: 10, border: `1px solid ${T.blueSoft}`, fontSize: 13, color: '#1E3A5F', marginBottom: 18 }}>
        🧹 <strong>Como funciona:</strong> só marcamos alguém como <strong>frio</strong> depois de dar tempo e chance —
        precisa ter recebido pelo menos <strong>{data?.params.cold_min_sent ?? 4} emails</strong>, com o 1º envio há mais de{' '}
        <strong>{data?.params.cold_min_age_days ?? 30} dias</strong>, e nunca ter aberto nem clicado. Quem recebeu pouco ou entrou há pouco fica <strong>protegido</strong>.
        Limpar a lista de quem nunca lê <strong>melhora a entregabilidade</strong> pra quem realmente lê.
      </div>

      {loading ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: T.inkSoft }}>Carregando engajamento…</div>
      ) : !data ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: T.inkSoft }}>Não foi possível carregar.</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 18 }}>
            {segMeta.map(s => (
              <div key={s.key} style={{ background: s.bg, borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{data.counts[s.key] ?? 0}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.ink, marginTop: 2 }}>{s.label}</div>
                <div style={{ fontSize: 10.5, color: T.inkMuted, marginTop: 2, lineHeight: 1.3 }}>{s.desc}</div>
              </div>
            ))}
          </div>

          {/* Ação de limpeza */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>Limpar contatos frios</div>
                <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 2 }}>
                  Move os <strong>{data.counts.frio ?? 0}</strong> frios para a lista de descadastro. Recomendado: antes disso, dispare uma campanha de reengajamento (“ainda quer receber?”) só pra eles.
                </div>
              </div>
              <button onClick={clean} disabled={cleaning || (data.counts.frio ?? 0) === 0} style={{
                padding: '10px 18px', borderRadius: 9, background: (data.counts.frio ?? 0) === 0 ? T.graySoft : T.red, color: (data.counts.frio ?? 0) === 0 ? T.inkMuted : '#fff',
                border: 'none', fontSize: 14, fontWeight: 700, cursor: (data.counts.frio ?? 0) === 0 ? 'default' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
              }}>
                {cleaning ? '⏳ Limpando…' : '🧹 Limpar frios'}
              </button>
            </div>
            {msg && <div style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: msg.startsWith('✓') ? '#16A34A' : T.red }}>{msg}</div>}
          </div>

          {/* Amostra de frios */}
          {data.samples.frio.length > 0 && (
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 12 }}>Contatos frios (amostra)</div>
              {data.samples.frio.slice(0, 30).map((c, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < 29 ? `1px solid ${T.borderSoft}` : 'none', fontSize: 12.5 }}>
                  <span style={{ color: T.ink }}>{c.name || c.email}</span>
                  <span style={{ color: T.inkMuted }}>{c.sent} envios · 0 aberturas</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ╔════════════════════════════════════════════╗
// ║                 Main                       ║
// ╚════════════════════════════════════════════╝
export default function EmailMarketingClient() {
  const [view, setView] = useState<View>('dashboard')
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [seqRes, metricsRes] = await Promise.all([
        fetch('/api/email-marketing/sequences'),
        fetch('/api/email-marketing/metrics'),
      ])
      const [seqData, metricsData] = await Promise.all([seqRes.json(), metricsRes.json()])
      if (Array.isArray(seqData)) setSequences(seqData)
      if (metricsData?.total !== undefined) setMetrics(metricsData)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleSaveSequence = async (updated: Partial<Sequence> & { id: string }) => {
    await fetch('/api/email-marketing/sequences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
    await loadData()
  }

  const handleDeleteSequence = async (id: string) => {
    await fetch(`/api/email-marketing/sequences?id=${id}`, { method: 'DELETE' })
    await loadData()
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200, minHeight: '100%', background: T.bg }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 28, fontWeight: 800, color: T.ink, marginBottom: 4 }}>
            <span style={{
              width: 40, height: 40, borderRadius: 12,
              background: T.pinkBg, color: T.pink,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
            }}>
              📧
            </span>
            Email Marketing
          </div>
          <div style={{ fontSize: 14, color: T.inkSoft, paddingLeft: 52 }}>
            Sequências automatizadas e campanhas via AWS SES ·{' '}
            {metrics ? <><strong style={{ color: T.ink }}>{metrics.totalLeads.toLocaleString('pt-BR')}</strong> leads na base</> : '—'}
          </div>
        </div>

        <button
          onClick={loadData}
          style={{
            padding: '9px 16px', borderRadius: 9, background: '#fff',
            border: `1px solid ${T.border}`, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit', color: T.ink,
            display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          🔄 Atualizar
        </button>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'inline-flex', background: T.graySoft, padding: 4, borderRadius: 12, marginBottom: 24 }}>
        <TabPill label="Dashboard" icon="📊" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
        <TabPill label="Broadcast" icon="📢" active={view === 'broadcast'} onClick={() => setView('broadcast')} />
        <TabPill label="Histórico" icon="📜" active={view === 'historico'} onClick={() => setView('historico')} />
        <TabPill label="Higienização" icon="🧹" active={view === 'higiene'} onClick={() => setView('higiene')} />
        <TabPill label="Sequências" icon="⚡" active={view === 'sequencias'} onClick={() => setView('sequencias')} />
        <TabPill label="Teste SMTP" icon="🔧" active={view === 'teste'} onClick={() => setView('teste')} />
      </div>

      {/* Content */}
      {view === 'dashboard' && (
        <DashboardView metrics={metrics} loading={loading} />
      )}

      {view === 'broadcast' && <BroadcastView />}

      {view === 'historico' && <HistoricoView />}

      {view === 'higiene' && <HygieneView />}

      {view === 'sequencias' && (
        <div style={{ maxWidth: 800 }}>
          <div style={{
            padding: '12px 16px', background: T.yellowBg,
            borderRadius: 10, border: `1px solid ${T.yellowSoft}`,
            fontSize: 13, color: '#713F12', marginBottom: 18,
          }}>
            💡 Use <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 4, fontSize: 12 }}>{'{nome}'}</code> para o primeiro nome e
            <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 4, fontSize: 12, marginLeft: 4 }}>{'{email}'}</code> para o email no assunto e corpo.
            Ative a sequência antes de disparar.
          </div>

          {loading ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: T.inkSoft }}>Carregando…</div>
          ) : sequences.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: T.inkSoft, background: T.card, borderRadius: 14, border: `1px solid ${T.border}` }}>
              Nenhuma sequência cadastrada
            </div>
          ) : (
            sequences.map(seq => (
              <SequenceEditor
                key={seq.id}
                seq={seq}
                onSave={handleSaveSequence}
                onDelete={handleDeleteSequence}
              />
            ))
          )}
        </div>
      )}

      {view === 'teste' && <TestEmailView />}
    </div>
  )
}
