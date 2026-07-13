import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/ses-mailer';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { normalizeEmail } from '@/lib/normalize-email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APP = 'https://planodaju.julianecost.com';

function magicEmailHtml(name: string, link: string): string {
  const first = (name || '').trim().split(/\s+/)[0] || '';
  return `
  <div style="background:#FFFAF5;padding:32px 0;font-family:'Plus Jakarta Sans',Helvetica,Arial,sans-serif">
    <div style="max-width:440px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #F0E0E4">
      <div style="background-color:#BE185D;background-image:linear-gradient(135deg,#FB7185,#BE185D);padding:28px 32px">
        <div style="color:#ffffff;font-size:22px;font-weight:700;font-family:Georgia,serif">Plano da <em>Ju</em></div>
      </div>
      <div style="padding:28px 32px;color:#3D2B2E">
        <p style="font-size:16px;margin:0 0 14px">Oi${first ? ', ' + first : ''}! 💛</p>
        <p style="font-size:14px;line-height:1.6;color:#7A6A6D;margin:0 0 22px">
          Toque no botão abaixo pra entrar no seu plano capilar <strong>sem precisar de senha</strong>.
          Este link é só seu e pessoal.
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0"><tr>
          <td align="center" bgcolor="#BE185D" style="border-radius:14px;background-color:#BE185D;background-image:linear-gradient(135deg,#FB7185,#BE185D)">
            <a href="${link}" style="display:block;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;line-height:1.2;padding:16px 22px;border-radius:14px;font-family:'Plus Jakarta Sans',Helvetica,Arial,sans-serif">
              Entrar no meu plano →
            </a>
          </td>
        </tr></table>
        <p style="font-size:13px;line-height:1.6;color:#7A6A6D;margin:20px 0 0;background:#FFF6F9;border-radius:10px;padding:12px 14px">
          💛 <strong>Responda este e-mail com um "oi"</strong> — a Juliane adora saber de você, e isso ajuda nossos e-mails a chegarem sempre na sua caixa de entrada.
        </p>
      </div>
    </div>
  </div>`;
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`magic:${ip}`, { max: 5, windowMs: 600_000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 });

  let email = '';
  try { ({ email } = await req.json()); } catch { /* ignore */ }
  email = normalizeEmail(email).email;

  const generic = NextResponse.json({ ok: true }); // nunca revela se o e-mail existe
  if (!email || !email.includes('@')) return generic;

  try {
    const supabase = await createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.auth.admin as any).generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${APP}/entrar` },
    });
    const tokenHash = data?.properties?.hashed_token;
    if (error || !tokenHash) return generic; // usuário não existe → resposta genérica

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: prof } = await (supabase.from('profiles') as any).select('full_name').eq('email', email).maybeSingle();
    const link = `${APP}/entrar#token_hash=${encodeURIComponent(tokenHash)}&type=magiclink`;
    await sendEmail({
      to: email,
      toName: prof?.full_name ?? undefined,
      subject: 'Seu link de acesso — Plano da Ju 💛',
      html: magicEmailHtml(prof?.full_name ?? '', link),
    });
  } catch (err) {
    console.error('[auth/magic-link]', err);
  }
  return generic;
}
