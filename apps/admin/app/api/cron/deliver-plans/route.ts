import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { sendEmail } from '@/lib/ses-mailer'
import { PLANO_LIBERADO_ASSUNTO, planoLiberadoHtml } from '@/lib/email-plano-liberado'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET/POST /api/cron/deliver-plans  (header x-cron-token ou ?token=)
 * Para cada cliente cujo plano JÁ liberou (plan_released_at <= agora) e que
 * ainda não recebeu o e-mail de entrega, envia o aviso "plano pronto antes do
 * prazo" e marca plan_delivered_email_sent_at. Idempotente.
 */
async function run(req: NextRequest) {
  // Mesmo padrão dos outros crons: Authorization: Bearer <CRON_SECRET>.
  // (O middleware do admin já valida isso; revalidamos aqui por garantia.)
  const auth = req.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET
  const altToken = req.headers.get('x-cron-token') ?? req.nextUrl.searchParams.get('token')
  const ok = (cronSecret && auth === `Bearer ${cronSecret}`)
    || (process.env.EMAIL_CRON_TOKEN && altToken === process.env.EMAIL_CRON_TOKEN)
  if (!ok) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const sb = createAdminClient()
  const nowIso = new Date().toISOString()
  // Trava de segurança: só notifica planos liberados nas últimas 6h — evita
  // mass-email acidental de entregas antigas se algum flag for resetado.
  const sixHoursAgo = new Date(Date.now() - 6 * 3600_000).toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb.from('profiles') as any)
    .select('id, email, full_name, plano_liberado_em, plano_liberado_por, subscription_type, is_gift')
    .eq('subscription_status', 'active')
    .eq('plan_status', 'ready')
    .is('plan_delivered_email_sent_at', null)
    .not('plan_released_at', 'is', null)
    .lte('plan_released_at', nowIso)
    .gte('plan_released_at', sixHoursAgo)
    .limit(50)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[]
  let sent = 0, failed = 0
  for (const p of rows) {
    if (!p.email) continue
    const first = (p.full_name ?? '').trim().split(/\s+/)[0] ?? ''
    try {
      const r = await sendEmail({ to: p.email, toName: p.full_name ?? undefined, subject: PLANO_LIBERADO_ASSUNTO, html: planoLiberadoHtml(first) })
      if (r.ok !== false) {
        sent++
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (sb.from('profiles') as any).update({
          plan_delivered_email_sent_at: new Date().toISOString(),
          // Só chega aqui quem já tem data de abertura: a cliente pagante pelo
          // clique em "Liberar plano", e a cortesia pelo prazo curto dela.
          // Guardar a origem é o que permite saber quantas consultas aconteceram.
          plano_liberado_em: p.plano_liberado_em ?? new Date().toISOString(),
          plano_liberado_por: p.plano_liberado_por
            ?? (p.subscription_type === 'parceria' || p.is_gift === true ? 'cortesia' : 'manual'),
        }).eq('id', p.id)
      } else { failed++ }
    } catch { failed++ }
  }
  return NextResponse.json({ ok: true, candidates: rows.length, sent, failed })
}

export async function GET(req: NextRequest) { return run(req) }
export async function POST(req: NextRequest) { return run(req) }
