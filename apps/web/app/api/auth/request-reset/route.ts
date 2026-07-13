import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/ses-mailer'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const APP = 'https://planodaju.julianecost.com'

function resetEmailHtml(name: string, link: string): string {
  const first = (name || '').trim().split(/\s+/)[0] || ''
  return `
  <div style="background:#FFFAF5;padding:32px 0;font-family:'Plus Jakarta Sans',Helvetica,Arial,sans-serif">
    <div style="max-width:440px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #F0E0E4">
      <div style="background-color:#BE185D;background-image:linear-gradient(135deg,#FB7185,#BE185D);padding:28px 32px">
        <div style="color:#ffffff;font-size:22px;font-weight:700;font-family:Georgia,serif">Plano da <em>Ju</em></div>
      </div>
      <div style="padding:28px 32px;color:#3D2B2E">
        <p style="font-size:16px;margin:0 0 14px">Oi${first ? ', ' + first : ''}! 💛</p>
        <p style="font-size:14px;line-height:1.6;color:#7A6A6D;margin:0 0 22px">
          Recebemos um pedido para redefinir a senha do seu acesso ao Plano da Ju.
          Toque no botão abaixo para criar uma nova senha. Este link vale por 24 horas.
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0"><tr>
          <td align="center" bgcolor="#BE185D" style="border-radius:14px;background-color:#BE185D;background-image:linear-gradient(135deg,#FB7185,#BE185D)">
            <a href="${link}" style="display:block;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;line-height:1.2;padding:16px 22px;border-radius:14px;font-family:'Plus Jakarta Sans',Helvetica,Arial,sans-serif">
              Redefinir minha senha →
            </a>
          </td>
        </tr></table>
        <p style="font-size:13px;line-height:1.6;color:#7A6A6D;margin:20px 0 0;background:#FFF6F9;border-radius:10px;padding:12px 14px">
          💛 <strong>Responda este e-mail com um "oi"</strong> — a Juliane adora saber de você, e isso garante que nossos e-mails cheguem sempre na sua caixa de entrada (e não no spam).
        </p>
        <p style="font-size:12px;line-height:1.6;color:#A89AA0;margin:16px 0 0">
          Se você não pediu isso, é só ignorar este e-mail — sua senha continua a mesma.
        </p>
      </div>
    </div>
  </div>`
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = checkRateLimit(`reset:${ip}`, { max: 5, windowMs: 600_000 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 })
  }

  let email = ''
  try { ({ email } = await req.json()) } catch { /* ignore */ }
  email = (email ?? '').trim().toLowerCase()

  // Resposta SEMPRE genérica (não revela se o e-mail existe na base)
  const generic = NextResponse.json({ ok: true })
  if (!email || !email.includes('@')) return generic

  try {
    const supabase = await createServiceClient()
    // Gera o link de recovery (token_hash). Só funciona se o usuário existir.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.auth.admin as any).generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${APP}/redefinir-senha` },
    })
    const tokenHash = data?.properties?.hashed_token
    if (error || !tokenHash) return generic // usuário não existe → resposta genérica

    // Busca o nome pra personalizar (best-effort)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: prof } = await (supabase.from('profiles') as any)
      .select('full_name').eq('email', email).maybeSingle()

    const link = `${APP}/redefinir-senha#token_hash=${encodeURIComponent(tokenHash)}&type=recovery`
    await sendEmail({
      to: email,
      toName: prof?.full_name ?? undefined,
      subject: 'Redefinir sua senha — Plano da Ju',
      html: resetEmailHtml(prof?.full_name ?? '', link),
    })
  } catch (err) {
    console.error('[auth/request-reset]', err)
  }
  return generic
}
