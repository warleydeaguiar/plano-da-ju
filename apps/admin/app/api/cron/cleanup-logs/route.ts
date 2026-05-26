import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/cron/cleanup-logs
 *
 * Roda diariamente. Apaga LOGS DETALHADOS com mais de 7 dias, mantendo as
 * MÉTRICAS AGREGADAS permanentes:
 *  - wg_email_events  (cada open/click com IP/UA) — agregado fica em wg_email_sends
 *  - checkout_events de event_type='checkout_error' — log de erro do checkout
 *
 * NÃO apaga eventos de funil (offer_viewed, checkout_initiated, payment_confirmed,
 * etc.) porque o dashboard usa janela de 30 dias deles.
 *
 * Também aplica a retenção LGPD da identidade de tracking (tracking_identity):
 * apaga sessões inativas há mais de 90 dias (por last_seen_at).
 *
 * Proteção: se CRON_SECRET estiver setado, exige Authorization: Bearer <secret>
 * (a Vercel Cron envia esse header automaticamente). Sem o secret, aceita
 * (permite trigger manual em dev).
 */
const RETENTION_DAYS = 7
const TRACKING_RETENTION_DAYS = 90

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization') ?? ''
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const sb = createAdminClient()
  const result: Record<string, unknown> = { cutoff, retention_days: RETENTION_DAYS }

  // 1) wg_email_events (logs detalhados de abertura/clique) — timestamp é occurred_at
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error, count } = await (sb.from('wg_email_events') as any)
      .delete({ count: 'exact' })
      .lt('occurred_at', cutoff)
    result.email_events_deleted = error ? `erro: ${error.message}` : (count ?? 0)
  } catch (err) {
    result.email_events_deleted = `erro: ${err instanceof Error ? err.message : 'unknown'}`
  }

  // 2) checkout_events do tipo 'checkout_error' (log de erro) — retenção MAIOR
  // (30 dias) que os demais logs, para dar histórico de monitoramento da operação.
  try {
    const errorCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error, count } = await (sb.from('checkout_events') as any)
      .delete({ count: 'exact' })
      .eq('event_type', 'checkout_error')
      .lt('created_at', errorCutoff)
    result.checkout_errors_deleted = error ? `erro: ${error.message}` : (count ?? 0)
    result.checkout_error_retention_days = 30
  } catch (err) {
    result.checkout_errors_deleted = `erro: ${err instanceof Error ? err.message : 'unknown'}`
  }

  // 3) tracking_identity — retenção LGPD de 90 dias (por last_seen_at)
  try {
    const trackingCutoff = new Date(Date.now() - TRACKING_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error, count } = await (sb.from('tracking_identity') as any)
      .delete({ count: 'exact' })
      .lt('last_seen_at', trackingCutoff)
    result.tracking_identity_deleted = error ? `erro: ${error.message}` : (count ?? 0)
    result.tracking_retention_days = TRACKING_RETENTION_DAYS
  } catch (err) {
    result.tracking_identity_deleted = `erro: ${err instanceof Error ? err.message : 'unknown'}`
  }

  return NextResponse.json({ ok: true, ...result, ran_at: new Date().toISOString() })
}
