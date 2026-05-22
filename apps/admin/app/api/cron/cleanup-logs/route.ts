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
 * Proteção: se CRON_SECRET estiver setado, exige Authorization: Bearer <secret>
 * (a Vercel Cron envia esse header automaticamente). Sem o secret, aceita
 * (permite trigger manual em dev).
 */
const RETENTION_DAYS = 7

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

  // 2) checkout_events apenas do tipo 'checkout_error' (log de erro)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error, count } = await (sb.from('checkout_events') as any)
      .delete({ count: 'exact' })
      .eq('event_type', 'checkout_error')
      .lt('created_at', cutoff)
    result.checkout_errors_deleted = error ? `erro: ${error.message}` : (count ?? 0)
  } catch (err) {
    result.checkout_errors_deleted = `erro: ${err instanceof Error ? err.message : 'unknown'}`
  }

  return NextResponse.json({ ok: true, ...result, ran_at: new Date().toISOString() })
}
