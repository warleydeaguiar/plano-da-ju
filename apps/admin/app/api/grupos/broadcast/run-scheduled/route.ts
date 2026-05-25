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

  // DRIP: processa UM broadcast por tick (um lote pequeno de grupos). Prioriza
  // os que já estão 'sending' (em andamento) para terminá-los antes de iniciar
  // um novo agendado. Cada lote tem delays longos entre grupos — por isso só
  // cabe um broadcast por execução dentro do maxDuration.

  // 1. Já tem um broadcast em andamento? continua ele.
  const { data: sendingRows } = await sb
    .from('wg_broadcasts' as any)
    .select('id, title')
    .eq('status', 'sending')
    .order('created_at', { ascending: true })
    .limit(1)

  let pick = (sendingRows ?? [])[0] as any

  // 2. Senão, pega o próximo agendado que já venceu.
  if (!pick) {
    const { data: dueRows, error } = await sb
      .from('wg_broadcasts' as any)
      .select('id, title')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
      .limit(1)
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
    pick = (dueRows ?? [])[0]
  }

  if (!pick) {
    return NextResponse.json({ ok: true, processed: 0, results: [] })
  }

  // 3. Executa um lote desse broadcast (retoma nos próximos ticks se sobrar)
  try {
    const r = await executeBroadcast(pick.id)
    return NextResponse.json({ ok: true, processed: 1, results: [{ id: pick.id, title: pick.title, ...r }] })
  } catch (err: any) {
    return NextResponse.json({ ok: false, processed: 1, results: [{ id: pick.id, title: pick.title, ok: false, error: err?.message ?? String(err) }] })
  }
}

/** POST — mesmo comportamento que GET, para compatibilidade com triggers externos */
export async function POST(req: NextRequest) {
  return GET(req)
}
