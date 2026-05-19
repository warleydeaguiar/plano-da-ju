/**
 * Envia o email "Acesso liberado" (sequência Pós-compra 1) sob demanda.
 * Usa o mesmo template gerenciável em /email-marketing pra manter consistência.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from './ses-mailer'
import { buildPersonalizationVars, fillRichTemplate } from './email-personalization'

export async function sendWelcomeEmail(
  sb: SupabaseClient,
  recipient: { email: string; name?: string | null; session_id?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  // Pega o template do banco (sequência Pós-compra 1 — "Acesso liberado")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: seq } = await (sb as any)
    .from('wg_email_sequences')
    .select('id, subject, html_body, text_body')
    .ilike('name', '%Acesso liberado%')
    .maybeSingle()

  if (!seq) {
    return { ok: false, error: 'Template "Acesso liberado" não encontrado' }
  }

  const vars = await buildPersonalizationVars(sb, {
    name: recipient.name ?? null,
    email: recipient.email,
    session_id: recipient.session_id ?? null,
  })

  const result = await sendEmail({
    to: recipient.email,
    toName: recipient.name ?? undefined,
    subject: fillRichTemplate(seq.subject, vars),
    html: fillRichTemplate(seq.html_body, vars),
    text: seq.text_body ? fillRichTemplate(seq.text_body, vars) : undefined,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb as any).from('wg_email_sends').insert({
    sequence_id: seq.id,
    to_email: recipient.email,
    to_name: recipient.name,
    subject: fillRichTemplate(seq.subject, vars),
    status: result.ok ? 'sent' : 'error',
    message_id: result.messageId ?? null,
    error_message: result.error ?? null,
  })

  return { ok: result.ok, error: result.error }
}
