import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { sendEmail, fillTemplate } from '@/lib/ses-mailer'
import { buildPersonalizationVars, fillRichTemplate } from '@/lib/email-personalization'
import { injectTracking, injectUnsubscribe, unsubscribeUrl } from '@/lib/email-tracking'

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
async function isSuppressed(sb: any, email: string): Promise<boolean> {
  const { data } = await sb
    .from('wg_email_unsubscribes')
    .select('email')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle()
  return !!data
}

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
}): Promise<{ ok: boolean; error?: string; messageId?: string; skipped?: boolean }> {
  // 0) Nunca envia para quem descadastrou (opt-out) — proteção central
  if (await isSuppressed(sb, params.to)) {
    return { ok: false, skipped: true, error: 'unsubscribed' }
  }

  const unsubUrl = unsubscribeUrl(params.to)

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
    // Sem tracking — envia direto (mas com footer de descadastro + header)
    return await sendEmail({
      to: params.to,
      toName: params.toName ?? undefined,
      subject: params.subject,
      html: injectUnsubscribe(params.html, params.to),
      text: params.text,
      listUnsubscribeUrl: unsubUrl,
    })
  }

  const sendId = inserted.id as string
  // tracking de pixel/clique + footer de descadastro (não duplica se já houver)
  const htmlFinal = injectUnsubscribe(injectTracking(params.html, sendId), params.to)

  const result = await sendEmail({
    to: params.to,
    toName: params.toName ?? undefined,
    subject: params.subject,
    html: htmlFinal,
    text: params.text,
    listUnsubscribeUrl: unsubUrl,
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
  try {
    return await handlePost(req)
  } catch (e) {
    // Qualquer exceção não tratada vira JSON — nunca devolve texto cru
    // (que quebraria o JSON.parse do cliente com "Unexpected token ...").
    console.error('[email-marketing/send] erro não tratado:', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Erro interno no servidor' },
      { status: 500 },
    )
  }
}

async function handlePost(req: NextRequest) {
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

  // ── 5) Broadcast → email pra base filtrada (com preview via dry_run) ──
  if (mode === 'broadcast_email') {
    const { subject, message, image_url, filters, dry_run } = body
    if (!subject?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'subject e message são obrigatórios' }, { status: 400 })
    }

    const recipients = await buildAudience(sb, filters ?? {})

    // Preview: só calcula o alcance, não envia
    if (dry_run) {
      return NextResponse.json({
        ok: true,
        dry_run: true,
        count: recipients.length,
        customers: recipients.filter(r => r.kind === 'customer').length,
        leads: recipients.filter(r => r.kind === 'lead').length,
        sample: recipients.slice(0, 8).map(r => ({ name: r.name, email: r.email, kind: r.kind })),
      })
    }

    // ── Enfileira (não envia síncrono) ──
    // Enviar tudo dentro da request estoura o limite de 60s da função
    // serverless em audiências grandes → 504 com corpo de texto → o cliente
    // quebrava no JSON.parse. Em vez disso gravamos os destinatários como
    // `pending` e drenamos em lotes via mode=broadcast_drain.
    const campaignId = `broadcast-${Date.now()}`

    const audienceLabel = filters?.audience === 'customers' ? 'Só clientes ativos'
      : filters?.audience === 'leads_no_purchase' ? 'Leads que não compraram'
      : 'Toda a base'

    await sb.from('wg_email_campaigns').insert({
      campaign_id: campaignId,
      subject: subject.trim(),
      message: message.trim(),
      image_url: image_url || null,
      audience_label: audienceLabel,
      recipients_total: recipients.length,
      sent: 0,
      errors: 0,
      skipped: 0,
    })

    // Insere os pendentes em chunks (evita payload gigante de uma vez).
    const nowIso = new Date().toISOString()
    const CHUNK = 1000
    for (let i = 0; i < recipients.length; i += CHUNK) {
      const rows = recipients.slice(i, i + CHUNK).map(r => ({
        campaign_id: campaignId,
        to_email: r.email,
        to_name: r.name,
        subject: subject.trim(),
        status: 'pending',
        updated_at: nowIso,
      }))
      const { error: insErr } = await sb.from('wg_email_sends').insert(rows)
      if (insErr) {
        return NextResponse.json(
          { ok: false, error: `Falha ao enfileirar: ${insErr.message}`, campaign_id: campaignId },
          { status: 500 },
        )
      }
    }

    return NextResponse.json({
      ok: true,
      queued: recipients.length,
      total: recipients.length,
      campaign_id: campaignId,
    })
  }

  // ── 6) Drena um lote de uma campanha de broadcast enfileirada ──
  if (mode === 'broadcast_drain') {
    const { campaign_id, batch } = body
    if (!campaign_id) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })
    const BATCH_SIZE = Math.min(Math.max(Number(batch) || 400, 1), 800)

    const { data: camp } = await (sb as any)
      .from('wg_email_campaigns')
      .select('subject, message, image_url')
      .eq('campaign_id', campaign_id)
      .single()
    if (!camp) return NextResponse.json({ error: 'campanha não encontrada' }, { status: 404 })

    // Recupera lotes travados (função morreu no meio): 'sending' parado >5min
    // volta a 'pending' pra ser reprocessado.
    const staleIso = new Date(Date.now() - 5 * 60_000).toISOString()
    await sb.from('wg_email_sends')
      .update({ status: 'pending', updated_at: new Date().toISOString() })
      .eq('campaign_id', campaign_id)
      .eq('status', 'sending')
      .lt('updated_at', staleIso)

    // Seleciona pendentes e os reivindica atomicamente (pending → sending)
    // pra não duplicar envio se houver drenagem concorrente (cron + cliente).
    const { data: pend } = await sb.from('wg_email_sends')
      .select('id')
      .eq('campaign_id', campaign_id)
      .eq('status', 'pending')
      .limit(BATCH_SIZE)
    const ids = (pend ?? []).map((r: any) => r.id)

    let claimed: any[] = []
    if (ids.length) {
      const { data } = await sb.from('wg_email_sends')
        .update({ status: 'sending', updated_at: new Date().toISOString() })
        .in('id', ids)
        .eq('status', 'pending')
        .select('id, to_email, to_name')
      claimed = data ?? []
    }

    const html = buildBroadcastEmailHtml(camp.message ?? '', camp.image_url || null)
    const subj = camp.subject ?? ''

    let sent = 0, errors = 0, skipped = 0
    const PAR = 12
    for (let i = 0; i < claimed.length; i += PAR) {
      const slice = claimed.slice(i, i + PAR)
      await Promise.all(slice.map(async (row: any) => {
        // opt-out de última hora
        if (await isSuppressed(sb, row.to_email)) {
          await sb.from('wg_email_sends').update({ status: 'skipped', error_message: 'unsubscribed', updated_at: new Date().toISOString() }).eq('id', row.id)
          skipped++; return
        }
        const finalHtml = injectUnsubscribe(injectTracking(html, row.id), row.to_email)
        const result = await sendEmail({
          to: row.to_email,
          toName: row.to_name ?? undefined,
          subject: subj,
          html: finalHtml,
          listUnsubscribeUrl: unsubscribeUrl(row.to_email),
        })
        await sb.from('wg_email_sends').update({
          status: result.ok ? 'sent' : 'error',
          message_id: result.messageId ?? null,
          error_message: result.error ?? null,
          sent_at: result.ok ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        }).eq('id', row.id)
        if (result.ok) sent++; else errors++
      }))
    }

    // Atualiza contadores agregados da campanha (recontagem barata por status).
    const counts = await Promise.all(['sent', 'error', 'skipped', 'pending', 'sending'].map(async (st) => {
      const { count } = await sb.from('wg_email_sends')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaign_id)
        .eq('status', st)
      return [st, count ?? 0] as const
    }))
    const byStatus = Object.fromEntries(counts) as Record<string, number>
    await sb.from('wg_email_campaigns').update({
      sent: byStatus.sent,
      errors: byStatus.error,
      skipped: byStatus.skipped,
    }).eq('campaign_id', campaign_id)

    const remaining = (byStatus.pending ?? 0) + (byStatus.sending ?? 0)
    return NextResponse.json({
      ok: true,
      processed: claimed.length,
      sent, errors, skipped,
      remaining,
      totals: { sent: byStatus.sent, errors: byStatus.error, skipped: byStatus.skipped },
    })
  }

  return NextResponse.json({ error: 'mode inválido' }, { status: 400 })
}

// ── Audiência / engajamento (broadcast + higienização) ─────────────────────────

type Recip = { email: string; name: string | null; kind: 'customer' | 'lead' }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadSuppressedSet(sb: any, emails: string[]): Promise<Set<string>> {
  if (emails.length === 0) return new Set()
  const lowered = emails.map(e => e.toLowerCase().trim())
  const { data } = await sb.from('wg_email_unsubscribes').select('email').in('email', lowered)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Set((data ?? []).map((r: any) => (r.email ?? '').toLowerCase()))
}

export type EngStat = { sent: number; opened: number; clicked: number; lastEngaged: number | null; firstSent: number | null }

/** Agrega engajamento por email a partir de wg_email_sends (volume pequeno). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadEngagement(sb: any): Promise<Map<string, EngStat>> {
  const map = new Map<string, EngStat>()
  const { data } = await sb.from('wg_email_sends')
    .select('to_email, opened_at, clicked_at, last_opened_at, last_clicked_at, sent_at')
    .eq('status', 'sent')
    .limit(100000)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (data ?? []) as any[]) {
    const e = (r.to_email ?? '').toLowerCase().trim()
    if (!e) continue
    const cur = map.get(e) ?? { sent: 0, opened: 0, clicked: 0, lastEngaged: null, firstSent: null }
    cur.sent++
    if (r.opened_at) cur.opened++
    if (r.clicked_at) cur.clicked++
    const sentT = r.sent_at ? new Date(r.sent_at).getTime() : null
    if (sentT && (cur.firstSent === null || sentT < cur.firstSent)) cur.firstSent = sentT
    const eng = Math.max(
      r.last_opened_at ? new Date(r.last_opened_at).getTime() : 0,
      r.last_clicked_at ? new Date(r.last_clicked_at).getTime() : 0,
      r.opened_at ? new Date(r.opened_at).getTime() : 0,
      r.clicked_at ? new Date(r.clicked_at).getTime() : 0,
    )
    if (eng > 0 && (cur.lastEngaged === null || eng > cur.lastEngaged)) cur.lastEngaged = eng
    map.set(e, cur)
  }
  return map
}

/** Constrói a audiência do broadcast a partir dos filtros. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildAudience(sb: any, filters: any): Promise<Recip[]> {
  const audience: string = filters?.audience ?? 'all'
  const statuses: string[] = Array.isArray(filters?.subscription_status) ? filters.subscription_status : []
  const quizSlug: string | null = filters?.quiz_slug || null
  const after: string | null = filters?.created_after || null
  const before: string | null = filters?.created_before || null

  // emails de clientes ativos (p/ audiência leads_no_purchase)
  const activeEmails = new Set<string>()
  {
    const { data } = await sb.from('profiles').select('email').eq('subscription_status', 'active').not('email', 'is', null).limit(50000)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const p of (data ?? []) as any[]) { const e = (p.email || '').toLowerCase().trim(); if (e) activeEmails.add(e) }
  }

  const includeCustomers = audience === 'all' || audience === 'customers'
  const includeLeads = audience === 'all' || audience === 'leads_no_purchase'
  const map = new Map<string, Recip>()

  if (includeCustomers) {
    let q = sb.from('profiles').select('email, full_name, subscription_status, created_at').not('email', 'is', null).limit(50000)
    if (statuses.length) q = q.in('subscription_status', statuses)
    if (after) q = q.gte('created_at', after)
    if (before) q = q.lte('created_at', before)
    const { data } = await q
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const p of (data ?? []) as any[]) { const e = (p.email || '').toLowerCase().trim(); if (!e) continue; map.set(e, { email: p.email, name: p.full_name ?? null, kind: 'customer' }) }
  }
  if (includeLeads) {
    let q = sb.from('wg_quiz_leads').select('email, name, created_at, quiz_slug').not('email', 'is', null).limit(50000)
    if (quizSlug) q = q.eq('quiz_slug', quizSlug)
    if (after) q = q.gte('created_at', after)
    if (before) q = q.lte('created_at', before)
    const { data } = await q
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const l of (data ?? []) as any[]) { const e = (l.email || '').toLowerCase().trim(); if (!e) continue; if (audience === 'leads_no_purchase' && activeEmails.has(e)) continue; if (!map.has(e)) map.set(e, { email: l.email, name: l.name ?? null, kind: 'lead' }) }
  }

  let recips = [...map.values()]

  // remove quem descadastrou
  const supp = await loadSuppressedSet(sb, recips.map(r => r.email))
  recips = recips.filter(r => !supp.has(r.email.toLowerCase().trim()))

  // opção: excluir quem ABRIU um broadcast anterior (usado no opt-in:
  // o 2º email só vai pra quem NÃO abriu o 1º). Pode receber um campaign_id
  // ou um array deles.
  const excludeOpenersOf: string[] = Array.isArray(filters?.exclude_campaign_openers)
    ? filters.exclude_campaign_openers
    : filters?.exclude_campaign_openers ? [filters.exclude_campaign_openers] : []
  if (excludeOpenersOf.length) {
    const openerSet = new Set<string>()
    const { data } = await sb.from('wg_email_sends')
      .select('to_email, opened_at, clicked_at, campaign_id')
      .in('campaign_id', excludeOpenersOf)
      .limit(200000)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of (data ?? []) as any[]) {
      if (!r.opened_at && !r.clicked_at) continue
      const e = (r.to_email ?? '').toLowerCase().trim()
      if (e) openerSet.add(e)
    }
    recips = recips.filter(r => !openerSet.has(r.email.toLowerCase().trim()))
  }

  // opção: excluir contatos frios (recebeu muito e nunca abriu)
  if (filters?.exclude_cold) {
    const eng = await loadEngagement(sb)
    const now = Date.now()
    recips = recips.filter(r => {
      const s = eng.get(r.email.toLowerCase().trim())
      if (!s) return true
      const cold = s.opened === 0 && s.clicked === 0 && s.sent >= 4 && s.firstSent !== null && (now - s.firstSent) >= 30 * 86400000
      return !cold
    })
  }

  return recips
}

/** Monta um email branded simples a partir do texto do broadcast. */
function buildBroadcastEmailHtml(message: string, imageUrl: string | null): string {
  const safe = message
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
  const img = imageUrl
    ? `<img src="${imageUrl}" alt="" style="width:100%;max-width:560px;border-radius:14px;display:block;margin:0 auto 20px" />`
    : ''
  return `<!doctype html><html><body style="margin:0;padding:0;background:#FFFAF5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <div style="text-align:center;padding:8px 0 20px;">
      <span style="font-size:22px;font-weight:700;color:#2A1E2C;">Plano da <span style="color:#BE185D;font-style:italic;">Ju</span></span>
    </div>
    <div style="background:#FFFFFF;border-radius:18px;padding:28px 24px;box-shadow:0 1px 3px rgba(42,30,44,0.06);">
      ${img}
      <div style="font-size:15px;line-height:1.6;color:#2A1E2C;">${safe}</div>
    </div>
  </div>
</body></html>`
}
