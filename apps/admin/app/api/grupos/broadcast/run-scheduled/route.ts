import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { executeBroadcast } from '@/lib/broadcast-sender'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutos (envio para 32+ grupos pode demorar)

/**
 * GET /api/grupos/broadcast/run-scheduled
 *   Dispara broadcasts agendados que já passaram do scheduled_at.
 *   Chamado a cada minuto via cron (Vercel cron OU VPS cron).
 *
 *   Auth: Bearer token em header `Authorization`, comparado com env CRON_SECRET.
 *   Se CRON_SECRET não estiver setado, libera sem auth (modo dev).
 */
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (expected) {
    const auth = req.headers.get('authorization') ?? ''
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ ok: false, error: 'Não autorizado' }, { status: 401 })
    }
  }

  const sb = createAdminClient()
  const now = new Date().toISOString()

  // 1. Busca broadcasts scheduled cujo horário já passou
  const { data: due, error } = await sb
    .from('wg_broadcasts' as any)
    .select('id, title, scheduled_at')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(10) // processa no máximo 10 por execução pra não estourar timeout

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const list = (due ?? []) as any[]
  if (list.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, results: [] })
  }

  // 2. Executa cada um sequencialmente (envia para grupos)
  const results: any[] = []
  for (const b of list) {
    try {
      const r = await executeBroadcast(b.id)
      results.push({ id: b.id, title: b.title, ...r })
    } catch (err: any) {
      results.push({ id: b.id, title: b.title, ok: false, error: err?.message ?? String(err) })
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results })
}

/** POST — mesmo comportamento que GET, para compatibilidade com triggers externos */
export async function POST(req: NextRequest) {
  return GET(req)
}
