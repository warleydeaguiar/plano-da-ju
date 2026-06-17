import { NextRequest, NextResponse } from 'next/server'
import { syncYberaRange, monthWindows } from '@/lib/ybera-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * GET /api/ybera/backfill?from=2024-01   (Bearer CRON_SECRET ou ?k=CRON_SECRET)
 *
 * Puxa TODO o histórico de pedidos Ybera (mês a mês) pra tabela ybera_orders.
 * Idempotente (upsert por id) — pode rodar quantas vezes quiser.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  const k = req.nextUrl.searchParams.get('k')
  if (secret && auth !== `Bearer ${secret}` && k !== secret) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }

  const from = req.nextUrl.searchParams.get('from') || '2024-01'
  const windows = monthWindows(from)
  const months: { ym: string; fetched: number; upserted: number; error?: string }[] = []
  let totalFetched = 0, totalUpserted = 0

  for (const w of windows) {
    const r = await syncYberaRange(w.start, w.end)
    months.push({ ym: w.ym, fetched: r.fetched, upserted: r.upserted, ...(r.error ? { error: r.error } : {}) })
    totalFetched += r.fetched
    totalUpserted += r.upserted
    if (!r.ok && r.error?.includes('TOKEN')) break // sem token: não adianta continuar
  }

  return NextResponse.json({ ok: true, from, months: windows.length, totalFetched, totalUpserted, detail: months })
}
