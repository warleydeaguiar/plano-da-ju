/**
 * AWS SES SMTP Mailer (web) — envia emails transacionais (ex: reset de senha).
 * Mesmas credenciais SES usadas no admin.
 * Env: AWS_SES_SMTP_USER / AWS_SES_SMTP_PASS / AWS_SES_FROM_EMAIL / AWS_SES_FROM_NAME
 */
import nodemailer from 'nodemailer'

const SMTP_HOST = 'email-smtp.us-east-1.amazonaws.com'
const SMTP_PORT = 587

export interface MailOptions {
  to: string
  toName?: string
  subject: string
  html: string
  text?: string
  replyTo?: string
}

export interface MailResult { ok: boolean; messageId?: string; error?: string }

export async function sendEmail(opts: MailOptions): Promise<MailResult> {
  const user = process.env.AWS_SES_SMTP_USER
  const pass = process.env.AWS_SES_SMTP_PASS
  const from = process.env.AWS_SES_FROM_EMAIL
  const name = process.env.AWS_SES_FROM_NAME ?? 'Juliane Cost'
  if (!user || !pass || !from) return { ok: false, error: 'SES SMTP não configurado' }

  try {
    const transport = nodemailer.createTransport({
      host: SMTP_HOST, port: SMTP_PORT, secure: false,
      auth: { user, pass }, tls: { rejectUnauthorized: false },
    })
    const info = await transport.sendMail({
      from: `"${name}" <${from}>`,
      to: opts.toName ? `"${opts.toName}" <${opts.to}>` : opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text ?? opts.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      replyTo: opts.replyTo ?? from,
    })
    return { ok: true, messageId: info.messageId }
  } catch (err) {
    console.error('[ses-mailer]', err instanceof Error ? err.message : err)
    return { ok: false, error: err instanceof Error ? err.message : 'erro' }
  }
}
