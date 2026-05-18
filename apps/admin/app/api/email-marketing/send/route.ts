import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { sendEmail, fillTemplate } from '@/lib/ses-mailer'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/email-marketing/send
 * Body:
 *   mode: 'single' | 'sequence_run' | 'campaign'
 *
 *   single: { lead_id, sequence_id, to_email, to_name, subject, html_body, text_body }
 *   sequence_run: { sequence_id, dry_run?: boolean } — runs the sequence for all eligible leads
 *   campaign: { subject, html_body, text_body, quiz_slug?, limit? } — bulk send to leads
 */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { mode } = body
  const sb = createAdminClient()

  // ── Single email ──
  if (mode === 'single') {
    const { lead_id, sequence_id, to_email, to_name, subject, html_body, text_body } = body
    if (!to_email || !subject || !html_body) {
      return NextResponse.json({ error: 'to_email, subject, html_body são obrigatórios' }, { status: 400 })
    }

    const firstName = (to_name ?? '').split(' ')[0] || 'amiga'
    const vars = { nome: firstName, email: to_email }

    const result = await sendEmail({
      to: to_email,
      toName: to_name,
      subject: fillTemplate(subject, vars),
      html: fillTemplate(html_body, vars),
      text: text_body ? fillTemplate(text_body, vars) : undefined,
    })

    // Log send
    await (sb as any).from('wg_email_sends').insert({
      lead_id: lead_id || null,
      sequence_id: sequence_id || null,
      to_email,
      to_name,
      subject: fillTemplate(subject, vars),
      status: result.ok ? 'sent' : 'error',
      message_id: result.messageId ?? null,
      error_message: result.error ?? null,
    })

    return NextResponse.json({ ok: result.ok, error: result.error })
  }

  // ── Sequence run: send D+N emails to all eligible leads ──
  if (mode === 'sequence_run') {
    const { sequence_id, dry_run = false } = body
    if (!sequence_id) return NextResponse.json({ error: 'sequence_id required' }, { status: 400 })

    // Get sequence
    const { data: seq, error: seqErr } = await (sb as any)
      .from('wg_email_sequences')
      .select('*')
      .eq('id', sequence_id)
      .single()
    if (seqErr || !seq) return NextResponse.json({ error: 'Sequência não encontrada' }, { status: 404 })

    // Get all leads that qualify (created_at between delay_days-1 and delay_days+1 days ago)
    const now = new Date()
    const minDate = new Date(now.getTime() - (seq.delay_days + 1) * 86400000).toISOString()
    const maxDate = new Date(now.getTime() - (seq.delay_days - 1) * 86400000).toISOString()

    let leadsQuery = (sb as any)
      .from('wg_quiz_leads')
      .select('id, name, email, quiz_slug, created_at')
      .not('email', 'is', null)
      .gte('created_at', minDate)
      .lte('created_at', maxDate)

    if (seq.quiz_slug) {
      leadsQuery = leadsQuery.eq('quiz_slug', seq.quiz_slug)
    }

    const { data: leads, error: leadsErr } = await leadsQuery
    if (leadsErr) return NextResponse.json({ error: leadsErr.message }, { status: 500 })

    if (!leads || leads.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, skipped: 0, message: 'Nenhum lead elegível' })
    }

    // Get already sent emails for this sequence to avoid duplicates
    const leadIds = leads.map((l: any) => l.id)
    const { data: alreadySent } = await (sb as any)
      .from('wg_email_sends')
      .select('lead_id')
      .eq('sequence_id', sequence_id)
      .in('lead_id', leadIds)
      .eq('status', 'sent')

    const alreadySentIds = new Set((alreadySent ?? []).map((r: any) => r.lead_id))

    const eligible = leads.filter((l: any) => !alreadySentIds.has(l.id) && l.email)

    if (dry_run) {
      return NextResponse.json({
        ok: true,
        dry_run: true,
        total: leads.length,
        skipped: leads.length - eligible.length,
        wouldSend: eligible.length,
        sample: eligible.slice(0, 5).map((l: any) => ({ name: l.name, email: l.email })),
      })
    }

    // Send emails in batches
    let sent = 0
    let errors = 0
    const BATCH_SIZE = 10

    for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
      const batch = eligible.slice(i, i + BATCH_SIZE)
      await Promise.all(batch.map(async (lead: any) => {
        const firstName = (lead.name ?? '').split(' ')[0] || 'amiga'
        const vars = { nome: firstName, email: lead.email }

        const result = await sendEmail({
          to: lead.email,
          toName: lead.name,
          subject: fillTemplate(seq.subject, vars),
          html: fillTemplate(seq.html_body, vars),
          text: seq.text_body ? fillTemplate(seq.text_body, vars) : undefined,
        })

        await (sb as any).from('wg_email_sends').insert({
          lead_id: lead.id,
          sequence_id,
          to_email: lead.email,
          to_name: lead.name,
          subject: fillTemplate(seq.subject, vars),
          status: result.ok ? 'sent' : 'error',
          message_id: result.messageId ?? null,
          error_message: result.error ?? null,
        })

        if (result.ok) sent++
        else errors++
      }))
    }

    return NextResponse.json({ ok: true, sent, errors, skipped: leads.length - eligible.length })
  }

  // ── Campaign: bulk send to leads ──
  if (mode === 'campaign') {
    const { subject, html_body, text_body, quiz_slug, campaign_id, limit = 500 } = body
    if (!subject || !html_body || !campaign_id) {
      return NextResponse.json({ error: 'subject, html_body, campaign_id são obrigatórios' }, { status: 400 })
    }

    let leadsQuery = (sb as any)
      .from('wg_quiz_leads')
      .select('id, name, email, quiz_slug')
      .not('email', 'is', null)
      .limit(limit)

    if (quiz_slug) {
      leadsQuery = leadsQuery.eq('quiz_slug', quiz_slug)
    }

    const { data: leads, error: leadsErr } = await leadsQuery
    if (leadsErr) return NextResponse.json({ error: leadsErr.message }, { status: 500 })

    let sent = 0
    let errors = 0

    for (let i = 0; i < (leads ?? []).length; i += 10) {
      const batch = leads.slice(i, i + 10)
      await Promise.all(batch.map(async (lead: any) => {
        const firstName = (lead.name ?? '').split(' ')[0] || 'amiga'
        const vars = { nome: firstName, email: lead.email }

        const result = await sendEmail({
          to: lead.email,
          toName: lead.name,
          subject: fillTemplate(subject, vars),
          html: fillTemplate(html_body, vars),
          text: text_body ? fillTemplate(text_body, vars) : undefined,
        })

        await (sb as any).from('wg_email_sends').insert({
          lead_id: lead.id,
          campaign_id,
          to_email: lead.email,
          to_name: lead.name,
          subject: fillTemplate(subject, vars),
          status: result.ok ? 'sent' : 'error',
          message_id: result.messageId ?? null,
          error_message: result.error ?? null,
        })

        if (result.ok) sent++
        else errors++
      }))
    }

    return NextResponse.json({ ok: true, sent, errors, total: (leads ?? []).length })
  }

  return NextResponse.json({ error: 'mode inválido' }, { status: 400 })
}
