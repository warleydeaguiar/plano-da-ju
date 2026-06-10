import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { sendEmail } from '@/lib/ses-mailer'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET/POST /api/cron/deliver-plans  (header x-cron-token ou ?token=)
 * Para cada cliente cujo plano JÁ liberou (plan_released_at <= agora) e que
 * ainda não recebeu o e-mail de entrega, envia o aviso "plano pronto antes do
 * prazo" e marca plan_delivered_email_sent_at. Idempotente.
 */
const APP_URL = 'https://planodaju.julianecost.com/meu-plano/plano'

function emailHtml(firstName: string): string {
  const oi = firstName ? `Oi, ${firstName}! ` : 'Oi! '
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;color:#2A1E2C">
    <div style="background:linear-gradient(135deg,#BE185D,#EC4899);color:#fff;padding:28px 24px;border-radius:16px 16px 0 0">
      <div style="font-size:13px;letter-spacing:1px;opacity:.9;text-transform:uppercase">Plano da Ju</div>
      <h1 style="font-size:24px;margin:8px 0 0">⚡ Seu plano ficou pronto — antes do prazo!</h1>
    </div>
    <div style="background:#fff;border:1px solid #f0e6ec;border-top:none;padding:24px;border-radius:0 0 16px 16px">
      <p style="font-size:15px;line-height:1.6">${oi}Prometemos seu plano capilar em até <strong>24 horas</strong>… mas a Juliane caprichou e já deixou o seu pronto! 💛</p>
      <p style="font-size:15px;line-height:1.6">Seu <strong>cronograma capilar personalizado de 90 dias</strong> já está liberado no app — com as lavagens, hidratações, reconstruções e os produtos certos pro seu cabelo.</p>
      <p style="text-align:center;margin:26px 0">
        <a href="${APP_URL}" style="background:#BE185D;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:12px;display:inline-block">Ver meu plano agora</a>
      </p>
      <p style="font-size:13px;color:#7C6B7E;line-height:1.6">Deu pra ver tudo? No app você também pode <strong>avaliar o plano</strong> e pedir ajustes se quiser — a gente responde em até 2 dias úteis. 😉</p>
    </div>
  </div>`
}

async function run(req: NextRequest) {
  const token = req.headers.get('x-cron-token') ?? req.nextUrl.searchParams.get('token')
  if (!process.env.EMAIL_CRON_TOKEN || token !== process.env.EMAIL_CRON_TOKEN) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const sb = createAdminClient()
  const nowIso = new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb.from('profiles') as any)
    .select('id, email, full_name')
    .eq('subscription_status', 'active')
    .eq('plan_status', 'ready')
    .is('plan_delivered_email_sent_at', null)
    .not('plan_released_at', 'is', null)
    .lte('plan_released_at', nowIso)
    .limit(50)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[]
  let sent = 0, failed = 0
  for (const p of rows) {
    if (!p.email) continue
    const first = (p.full_name ?? '').trim().split(/\s+/)[0] ?? ''
    try {
      const r = await sendEmail({ to: p.email, toName: p.full_name ?? undefined, subject: '⚡ Seu plano capilar ficou pronto — antes do prazo!', html: emailHtml(first) })
      if (r.ok !== false) {
        sent++
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (sb.from('profiles') as any).update({ plan_delivered_email_sent_at: new Date().toISOString() }).eq('id', p.id)
      } else { failed++ }
    } catch { failed++ }
  }
  return NextResponse.json({ ok: true, candidates: rows.length, sent, failed })
}

export async function GET(req: NextRequest) { return run(req) }
export async function POST(req: NextRequest) { return run(req) }
