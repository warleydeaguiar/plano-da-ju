/**
 * AWS SES SMTP Mailer — Plano da Ju
 * Envia emails via SMTP usando credenciais do Amazon SES.
 *
 * Env vars necessárias:
 *   AWS_SES_SMTP_USER   = SMTP username (IAM Access Key ID)
 *   AWS_SES_SMTP_PASS   = SMTP password (gerado pelo IAM)
 *   AWS_SES_FROM_EMAIL  = endereço de envio (ex: juliane@julianecost.com)
 *   AWS_SES_FROM_NAME   = nome do remetente (ex: Juliane Cost)
 */

import nodemailer from 'nodemailer'

const SMTP_HOST = 'email-smtp.us-east-1.amazonaws.com'
const SMTP_PORT = 587

function createTransport() {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: false,
    auth: {
      user: process.env.AWS_SES_SMTP_USER!,
      pass: process.env.AWS_SES_SMTP_PASS!,
    },
    tls: { rejectUnauthorized: false },
  })
}

export interface MailOptions {
  to: string
  toName?: string
  subject: string
  html: string
  text?: string
  replyTo?: string
  /** URL de descadastro — habilita List-Unsubscribe + One-Click (RFC 8058). */
  listUnsubscribeUrl?: string
}

export interface MailResult {
  ok: boolean
  messageId?: string
  error?: string
}

export async function sendEmail(opts: MailOptions): Promise<MailResult> {
  const user  = process.env.AWS_SES_SMTP_USER
  const pass  = process.env.AWS_SES_SMTP_PASS
  const from  = process.env.AWS_SES_FROM_EMAIL
  const name  = process.env.AWS_SES_FROM_NAME ?? 'Juliane Cost'

  if (!user || !pass || !from) {
    return { ok: false, error: 'SES SMTP não configurado (env vars ausentes)' }
  }

  try {
    const transport = createTransport()
    // List-Unsubscribe + One-Click (RFC 8058) — melhora entregabilidade e
    // exigido pelo Gmail/Yahoo para remetentes em massa.
    const headers: Record<string, string> = {}
    if (opts.listUnsubscribeUrl) {
      headers['List-Unsubscribe'] = `<${opts.listUnsubscribeUrl}>`
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
    }
    const info = await transport.sendMail({
      from: `"${name}" <${from}>`,
      to: opts.toName ? `"${opts.toName}" <${opts.to}>` : opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text ?? opts.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      replyTo: opts.replyTo ?? from,
      ...(Object.keys(headers).length ? { headers } : {}),
    })
    return { ok: true, messageId: info.messageId }
  } catch (err: any) {
    console.error('[ses-mailer] error', err?.message)
    return { ok: false, error: err?.message ?? 'Erro desconhecido' }
  }
}

/** Substitui {nome} e {email} nos templates */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, value)
  }
  return result
}
