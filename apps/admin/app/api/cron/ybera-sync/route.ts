import { NextRequest, NextResponse } from 'next/server'
import { syncYberaRange, syncYberaMonthlyAggregates } from '@/lib/ybera-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * GET /api/cron/ybera-sync   (Bearer CRON_SECRET ou ?k=CRON_SECRET)
 *
 * Sync diário: re-puxa os últimos ~40 dias da Ybera e faz upsert em ybera_orders
 * (pega pedidos novos e atualizações). Agendar no crontab da VPS konor.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  const k = req.nextUrl.searchParams.get('k')
  if (secret && auth !== `Bearer ${secret}` && k !== secret) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }

  const end = new Date()
  const start = new Date(end.getTime() - 40 * 86400000)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  const r = await syncYberaRange(fmt(start), fmt(end))
  // Depois de atualizar os pedidos crus, recompõe os totais mensais via API
  // (do mês da integração pra frente; meses do Excel ficam intactos).
  const agg = await syncYberaMonthlyAggregates()
  return NextResponse.json({ ...r, monthly: agg, start: fmt(start), end: fmt(end) })
}
