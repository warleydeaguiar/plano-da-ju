import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { sendEmail, fillTemplate } from '@/lib/ses-mailer'
import { buildPersonalizationVars, fillRichTemplate } from '@/lib/email-personalization'
import { injectTracking } from '@/lib/email-tracking'

/**
 * Helper que faz o ciclo completo de envio com tracking:
 *  1. INSERT pending → ganha send_id
 *  2. injectTracking(html, sendId) → pixel + link rewrite
 *  3. SES envia
 *  4. UPDATE com status final + message_id
 *
 * Se o INSERT falhar, envia sem tracking pra não bloquear entrega.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendWithTracking(sb: any, params: {
  to: string
  toName?: string | null
  subject: string
  html: string
  text?: string
  sequence_id?: string | null
  campaign_id?: string | null
  lead_id?: string | null
}): Promise<{ ok: boolean; error?: string; messageId?: string }> {
  // 1) Insert pending
  const { data: inserted, error: insertErr } = await sb
    .from('wg_email_sends')
    .insert({
      lead_id:     params.lead_id     ?? null,
      sequence_id: params.sequence_id ?? null,
      campaign_id: params.campaign_id ?? null,
      to_email:    params.to,
      to_name:     params.toName ?? null,
      subject:     params.subject,
      status:      'pending',
    })
    .select('id')
    .single()

  if (insertErr || !inserted) {
    // Sem tracking — envia direto
    return await sendEmail({
      to: params.to,
      toName: params.toName ?? undefined,
      subject: params.subject,
      html: params.html,
      text: params.text,
    })
  }

  const sendId = inserted.id as string
  const htmlTracked = injectTracking(params.html, sendId)

  const result = await sendEmail({
    to: params.to,
    toName: params.toName ?? undefined,
    subject: params.subject,
    html: htmlTracked,
    text: params.text,
  })

  await sb.from('wg_email_sends')
    .update({
      status: result.ok ? 'sent' : 'error',
      message_id: result.messageId ?? null,
      error_message: result.error ?? null,
    })
    .eq('id', sendId)

  return result
}

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ── Helpers ──────────────────────────────────────────────────────────────────
function totalDelayMinutes(seq: any): number {
  return (Number(seq.delay_days) || 0) * 1440 + (Number(seq.delay_minutes) || 0)
}

interface PreparedRecipient {
  lead_id: string | null
  to_email: string
  to_name: string | null
  session_id: string | null
  anchor_at: string  // ISO timestamp
}

/**
 * Lista os destinatários elegíveis para uma sequência.
 *
 * Janela aceita: o ancoramento deve estar entre [now - delay - tolerance, now - delay + tolerance].
 * Tolerância é metade do intervalo do cron (5min) — assim cada lead é atingido exatamente uma vez.
 */
async function findEligibleRecipients(sb: any, seq: any, toleranceMinutes = 6): Promise<PreparedRecipient[]> {
  const totalMin = totalDelayMinutes(seq)
  const now = Date.now()
  const maxIso = new Date(now - (totalMin - toleranceMinutes) * 60_000).toISOString()
  const minIso = new Date(now - (totalMin + toleranceMinutes) * 60_000).toISOString()

  if (seq.anchor_event === 'purchase') {
    // Ancora na ativação da assinatura
    let q = sb.from('profiles')
      .select('id, email, full_name, subscription_activated_at, quiz_session_id')
      .eq('subscription_status', 'active')
      .not('email', 'is', null)
      .gte('subscription_activated_at', minIso)
      .lte('subscription_activated_at', maxIso)
    const { data } = await q
    return (data ?? []).map((p: any) => ({
      lead_id: null,
      to_email: p.email,
      to_name: p.full_name,
      session_id: p.quiz_session_id ?? null,
      anchor_at: p.subscription_activated_at,
    }))
  }

  // anchor_event = 'lead_created'
  let q = sb.from('wg_quiz_leads')
    .select('id, name, email, session_id, created_at, quiz_slug')
    .not('email', 'is', null)
    .gte('created_at', minIso)
    .lte('created_at', maxIso)
  if (seq.quiz_slug) q = q.eq('quiz_slug', seq.quiz_slug)
  const { data: leads } = await q
  return (leads ?? []).map((l: any) => ({
    lead_id: l.id,
    to_email: l.email,
    to_name: l.name,
    session_id: l.session_id ?? null,
    anchor_at: l.created_at,
  }))
}

/**
 * Aplica filtro de audiência (assinantes vs leads não-compradores).
 */
async function filterByAudience(sb: any, recipients: PreparedRecipient[], audience: string): Promise<PreparedRecipient[]> {
  if (audience === 'all' || recipients.length === 0) return recipients

  const emails = recipients.map(r => r.to_email.toLowerCase())
  const { data: activeProfiles } = await sb
    .from('profiles')
    .select('email')
    .eq('subscription_status', 'active')
    .in('email', emails)

  const activeSet = new Set((activeProfiles ?? []).map((p: any) => (p.email ?? '').toLowerCase()))

  if (audience === 'no_purchase') {
    return recipients.filter(r => !activeSet.has(r.to_email.toLowerCase()))
  }
  if (audience === 'customers') {
    return recipients.filter(r => activeSet.has(r.to_email.toLowerCase()))
  }
  return recipients
}

/**
 * Exclui destinatários que já receberam este email da sequência.
 */
async function excludeAlreadySent(sb: any, sequenceId: string, recipients: PreparedRecipient[]): Promise<PreparedRecipient[]> {
  if (recipients.length === 0) return []
  const emails = recipients.map(r => r.to_email.toLowerCase())
  const { data } = await sb
    .from('wg_email_sends')
    .select('to_email')
    .eq('sequence_id', sequenceId)
    .eq('status', 'sent')
    .in('to_email', emails)
  const sentSet = new Set((data ?? []).map((r: any) => (r.to_email ?? '').toLowerCase()))
  return recipients.filter(r => !sentSet.has(r.to_email.toLowerCase()))
}

/**
 * Envia uma sequência. Retorna { sent, errors, skipped, eligible }.
 */
async function runSequence(sb: any, seq: any, opts: { dryRun?: boolean; toleranceMinutes?: number } = {}) {
  const tolerance = opts.toleranceMinutes ?? 6
  const recipients = await findEligibleRecipients(sb, seq, tolerance)
  const audienceFiltered = await filterByAudience(sb, recipients, seq.audience ?? 'no_purchase')
  const eligible = await excludeAlreadySent(sb, seq.id, audienceFiltered)

  if (opts.dryRun) {
    return {
      dry_run: true,
      total: recipients.length,
      audience_skipped: recipients.length - audienceFiltered.length,
      already_sent: audienceFiltered.length - eligible.length,
      eligible: eligible.length,
      sample: eligible.slice(0, 5).map(r => ({ name: r.to_name, email: r.to_email })),
    }
  }

  let sent = 0
  let errors = 0
  const BATCH = 10

  for (let i = 0; i < eligible.length; i += BATCH) {
    const batch = eligible.slice(i, i + BATCH)
    await Promise.all(batch.map(async (r) => {
      const vars = await buildPersonalizationVars(sb, {
        name: r.to_name,
        email: r.to_email,
        session_id: r.session_id,
      })

      const result = await sendWithTracking(sb, {
        to: r.to_email,
        toName: r.to_name,
        subject: fillRichTemplate(seq.subject, vars),
        html: fillRichTemplate(seq.html_body, vars),
        text: seq.text_body ? fillRichTemplate(seq.text_body, vars) : undefined,
        sequence_id: seq.id,
        lead_id: r.lead_id,
      })

      if (result.ok) sent++
      else errors++
    }))
  }

  return {
    total: recipients.length,
    audience_skipped: recipients.length - audienceFiltered.length,
    already_sent: audienceFiltered.length - eligible.length,
    eligible: eligible.length,
    sent,
    errors,
  }
}

// ── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { mode } = body
  const sb = createAdminClient()

  // ── 1) Envio único (manual via UI) ──
  if (mode === 'single') {
    const { lead_id, sequence_id, to_email, to_name, session_id, subject, html_body, text_body } = body
    if (!to_email || !subject || !html_body) {
      return NextResponse.json({ error: 'to_email, subject, html_body são obrigatórios' }, { status: 400 })
    }

    const vars = await buildPersonalizationVars(sb as any, {
      name: to_name,
      email: to_email,
      session_id: session_id ?? null,
    })

    const result = await sendWithTracking(sb, {
      to: to_email,
      toName: to_name,
      subject: fillRichTemplate(subject, vars),
      html: fillRichTemplate(html_body, vars),
      text: text_body ? fillRichTemplate(text_body, vars) : undefined,
      lead_id: lead_id || null,
      sequence_id: sequence_id || null,
    })

    return NextResponse.json({ ok: result.ok, error: result.error, used_vars: Object.keys(vars).length })
  }

  // ── 2) Rodar UMA sequência (manual ou via cron) ──
  if (mode === 'sequence_run') {
    const { sequence_id, dry_run = false, tolerance_minutes } = body
    if (!sequence_id) return NextResponse.json({ error: 'sequence_id required' }, { status: 400 })

    const { data: seq, error: seqErr } = await (sb as any)
      .from('wg_email_sequences')
      .select('*')
      .eq('id', sequence_id)
      .single()
    if (seqErr || !seq) return NextResponse.json({ error: 'Sequência não encontrada' }, { status: 404 })

    const stats = await runSequence(sb, seq, { dryRun: dry_run, toleranceMinutes: tolerance_minutes })
    return NextResponse.json({ ok: true, sequence: seq.name, ...stats })
  }

  // ── 3) Rodar TODAS as sequências ativas (chamado pelo cron) ──
  if (mode === 'run_all') {
    const { dry_run = false, tolerance_minutes } = body
    const { data: sequences } = await (sb as any)
      .from('wg_email_sequences')
      .select('*')
      .eq('enabled', true)
    const results: any[] = []
    for (const seq of (sequences ?? [])) {
      const stats = await runSequence(sb, seq, { dryRun: dry_run, toleranceMinutes: tolerance_minutes })
      results.push({ sequence: seq.name, ...stats })
    }
    return NextResponse.json({ ok: true, total_sequences: results.length, results })
  }

  // ── 4) Campanha em massa (mantido por compatibilidade) ──
  if (mode === 'campaign') {
    const { subject, html_body, text_body, quiz_slug, campaign_id, limit = 500 } = body
    if (!subject || !html_body || !campaign_id) {
      return NextResponse.json({ error: 'subject, html_body, campaign_id são obrigatórios' }, { status: 400 })
    }

    let leadsQuery = (sb as any)
      .from('wg_quiz_leads')
      .select('id, name, email, quiz_slug, session_id')
      .not('email', 'is', null)
      .limit(limit)
    if (quiz_slug) leadsQuery = leadsQuery.eq('quiz_slug', quiz_slug)

    const { data: leads, error: leadsErr } = await leadsQuery
    if (leadsErr) return NextResponse.json({ error: leadsErr.message }, { status: 500 })

    let sent = 0
    let errors = 0
    for (let i = 0; i < (leads ?? []).length; i += 10) {
      const batch = (leads as any[]).slice(i, i + 10)
      await Promise.all(batch.map(async (lead: any) => {
        const vars = await buildPersonalizationVars(sb as any, {
          name: lead.name, email: lead.email, session_id: lead.session_id,
        })
        const result = await sendWithTracking(sb, {
          to: lead.email,
          toName: lead.name,
          subject: fillRichTemplate(subject, vars),
          html: fillRichTemplate(html_body, vars),
          text: text_body ? fillRichTemplate(text_body, vars) : undefined,
          lead_id: lead.id,
          campaign_id,
        })
        if (result.ok) sent++; else errors++
      }))
    }
    return NextResponse.json({ ok: true, sent, errors, total: (leads ?? []).length })
  }

  return NextResponse.json({ error: 'mode inválido' }, { status: 400 })
}
