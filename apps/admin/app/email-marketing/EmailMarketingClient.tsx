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

  pink:       '#C4607A',
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

type View = 'dashboard' | 'sequencias' | 'teste'

interface Sequence {
  id: string
  name: string
  delay_days: number
  subject: string
  html_body: string
  text_body: string
  quiz_slug: string | null
  enabled: boolean
  send_hour: number
  created_at: string
}

interface Metrics {
  total: number
  sent: number
  errors: number
  opened: number
  openRate: number
  totalLeads: number
  bySequence: Array<{
    id: string
    name: string
    delay_days: number
    enabled: boolean
    sent: number
    errors: number
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
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard icon="📧" label="Total enviados" value={metrics.sent.toLocaleString('pt-BR')} />
        <StatCard icon="👥" label="Leads na base" value={metrics.totalLeads.toLocaleString('pt-BR')} color={T.blue} />
        <StatCard
          icon="📭" label="Erros de envio"
          value={metrics.errors}
          color={metrics.errors > 0 ? T.red : T.green}
        />
        <StatCard icon="📊" label="Total de registros" value={metrics.total.toLocaleString('pt-BR')} color={T.gray} />
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
                  width: 32, height: 32, borderRadius: 8,
                  background: seq.enabled ? T.greenSoft : T.graySoft,
                  color: seq.enabled ? '#16A34A' : T.inkMuted,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 800, flexShrink: 0,
                }}>
                  D+{seq.delay_days}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{seq.name}</div>
                  <div style={{ fontSize: 11, color: T.inkMuted }}>
                    {seq.enabled ? '✓ Ativa' : '— Inativa'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: T.ink }}>{seq.sent}</div>
                  <div style={{ fontSize: 11, color: T.inkMuted }}>enviados</div>
                </div>
                {seq.errors > 0 && (
                  <div style={{ textAlign: 'right' }}>
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

  const handleDryRun = async () => {
    setRunning(true)
    setRunResult(null)
    const res = await fetch('/api/email-marketing/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'sequence_run', sequence_id: seq.id, dry_run: true }),
    })
    const data = await res.json()
    setRunResult(data.dry_run
      ? `Simulação: enviaria para ${data.wouldSend} leads (${data.skipped} já receberam)`
      : data.error ?? 'Erro')
    setRunning(false)
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
          width: 40, height: 40, borderRadius: 10,
          background: seq.enabled ? T.greenSoft : T.graySoft,
          color: seq.enabled ? '#16A34A' : T.inkMuted,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 800, flexShrink: 0,
        }}>
          D+{seq.delay_days}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>{seq.name}</div>
          <div style={{ fontSize: 12, color: T.inkMuted }}>
            Hora de envio: {String(seq.send_hour).padStart(2, '0')}h
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
            onClick={handleDryRun}
            disabled={running}
            style={{
              padding: '8px 14px', borderRadius: 8,
              background: T.blueBg, color: T.blue,
              border: `1px solid ${T.blueSoft}`, fontSize: 12, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            🔍 Simular envio
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
        <TabPill label="Sequências" icon="⚡" active={view === 'sequencias'} onClick={() => setView('sequencias')} />
        <TabPill label="Teste SMTP" icon="🔧" active={view === 'teste'} onClick={() => setView('teste')} />
      </div>

      {/* Content */}
      {view === 'dashboard' && (
        <DashboardView metrics={metrics} loading={loading} />
      )}

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
