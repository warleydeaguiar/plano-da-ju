import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { processarFila } from '@/lib/discador'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/cron/discador-tarefas            (Bearer CRON_SECRET — crontab da VPS, a cada 5 min)
 * GET /api/cron/discador-tarefas?seco=1     (Simular: conta, não grava)
 *
 * Monta a fila do discador: encerra quem comprou/ganhou cortesia/pediu para
 * sair e cria as tarefas novas por ordem de urgência. Ver lib/discador.ts.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }
  const seco = req.nextUrl.searchParams.get('seco') === '1'
  try {
    const r = await processarFila(createAdminClient(), { seco })
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    console.error('[cron/discador-tarefas]', e)
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'erro' }, { status: 500 })
  }
}
