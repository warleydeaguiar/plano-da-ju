/**
 * Envia o email "Plano pronto" quando a Juliane aprova o plano da cliente.
 * Usa o mesmo template gerenciável em /email-marketing pra manter consistência.
 *
 * Ordem do flow (importante p/ tracking):
 *  1. INSERT wg_email_sends com status='pending' → ganha send_id
 *  2. injectTracking(html, sendId) — pixel + link rewrite
 *  3. SES envia
 *  4. UPDATE row com status='sent'/'error' + message_id
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from './ses-mailer'
import { buildPersonalizationVars, fillRichTemplate } from './email-personalization'
import { injectTracking } from './email-tracking'

export async function sendPlanReadyEmail(
  sb: SupabaseClient,
  recipient: { email: string; name?: string | null; session_id?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  // Template "Plano pronto — Liberado no app"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: seq } = await (sb as any)
    .from('wg_email_sequences')
    .select('id, subject, html_body, text_body')
    .ilike('name', '%Plano pronto%')
    .maybeSingle()

  if (!seq) {
    return { ok: false, error: 'Template "Plano pronto" não encontrado' }
  }

  const vars = await buildPersonalizationVars(sb, {
    name: recipient.name ?? null,
    email: recipient.email,
    session_id: recipient.session_id ?? null,
  })

  const subjectFilled = fillRichTemplate(seq.subject, vars)
  const htmlFilled    = fillRichTemplate(seq.html_body, vars)
  const textFilled    = seq.text_body ? fillRichTemplate(seq.text_body, vars) : undefined

  // 1) Insere pending pra ganhar send_id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: insertedSend, error: insertErr } = await (sb as any)
    .from('wg_email_sends')
    .insert({
      sequence_id: seq.id,
      to_email: recipient.email,
      to_name: recipient.name,
      subject: subjectFilled,
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertErr || !insertedSend) {
    // Fallback sem tracking
    const result = await sendEmail({
      to: recipient.email,
      toName: recipient.name ?? undefined,
      subject: subjectFilled,
      html: htmlFilled,
      text: textFilled,
    })
    return { ok: result.ok, error: result.error }
  }

  const sendId = insertedSend.id as string
  const htmlTracked = injectTracking(htmlFilled, sendId)

  const result = await sendEmail({
    to: recipient.email,
    toName: recipient.name ?? undefined,
    subject: subjectFilled,
    html: htmlTracked,
    text: textFilled,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb as any).from('wg_email_sends')
    .update({
      status: result.ok ? 'sent' : 'error',
      message_id: result.messageId ?? null,
      error_message: result.error ?? null,
    })
    .eq('id', sendId)

  return { ok: result.ok, error: result.error }
}
