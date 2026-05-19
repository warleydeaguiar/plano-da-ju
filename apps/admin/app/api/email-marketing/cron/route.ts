import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/email-marketing/cron
 *
 * Endpoint chamado pelo systemd timer (a cada 5min) que dispara todas as
 * sequências habilitadas. Protegido por token via header `x-cron-token`
 * ou query `?token=...`.
 *
 * Env var: EMAIL_CRON_TOKEN
 */
export async function GET(req: NextRequest) {
  const token = req.headers.get('x-cron-token') ?? req.nextUrl.searchParams.get('token')
  const expected = process.env.EMAIL_CRON_TOKEN
  if (!expected || token !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Reaproveita a route /send com mode=run_all
  // Construímos uma URL absoluta usando o próprio request — funciona em VPS e local
  const origin = req.nextUrl.origin
  const res = await fetch(`${origin}/api/email-marketing/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'run_all' }),
  })
  const json = await res.json()
  return NextResponse.json({
    ok: res.ok,
    fired_at: new Date().toISOString(),
    ...json,
  })
}
