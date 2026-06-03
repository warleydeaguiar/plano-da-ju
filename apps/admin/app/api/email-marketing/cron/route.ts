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

  // Rede de segurança: drena broadcasts enfileirados que ficaram com pendentes
  // (ex.: o operador fechou a aba no meio do envio). Um lote por campanha por tick.
  const drained: any[] = []
  try {
    const { createAdminClient } = await import('@/lib/supabase')
    const sb = createAdminClient()
    const { data: pendingRows } = await (sb as any).from('wg_email_sends')
      .select('campaign_id')
      .like('campaign_id', 'broadcast-%')
      .in('status', ['pending', 'sending'])
      .limit(5000)
    const campaignIds = [...new Set((pendingRows ?? []).map((r: any) => r.campaign_id))].slice(0, 5)
    for (const cid of campaignIds) {
      const dr = await fetch(`${origin}/api/email-marketing/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'broadcast_drain', campaign_id: cid }),
      })
      drained.push({ campaign_id: cid, ...(await dr.json()) })
    }
  } catch (e) {
    console.error('[cron] falha ao drenar broadcasts:', e)
  }

  return NextResponse.json({
    ok: res.ok,
    fired_at: new Date().toISOString(),
    drained,
    ...json,
  })
}
