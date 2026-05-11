import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { sendTextToGroup } from '@/lib/evolution-grupos'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/grupos/test-send
 *   body: { instance: string, group_jid: string, text: string }
 *   Envia UMA mensagem para UM grupo. Mede tempo e retorna resultado detalhado.
 *
 *   Útil para diagnosticar:
 *   - Se a instância consegue enviar (vs bloqueio do WhatsApp)
 *   - Se um grupo específico funciona enquanto outros não
 *   - Latência típica do Evolution
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { instance, group_jid, text } = body
    if (!instance || !group_jid || !text?.trim()) {
      return NextResponse.json({
        ok: false,
        error: 'instance, group_jid e text obrigatórios',
      }, { status: 400 })
    }

    const start = Date.now()
    try {
      const result = await sendTextToGroup(group_jid, text.trim(), instance, false)
      const elapsed = Date.now() - start

      // Registra no DB se quiser histórico
      const sb = createAdminClient()
      const { data: group } = await sb
        .from('wg_groups' as any)
        .select('id, name')
        .eq('jid', group_jid)
        .maybeSingle()

      return NextResponse.json({
        ok: true,
        elapsed_ms: elapsed,
        group_name: (group as any)?.name ?? null,
        evolution_response: result,
      })
    } catch (err: any) {
      const elapsed = Date.now() - start
      const errMsg = err?.message ?? String(err)
      const isTimeout = errMsg.includes('timeout') || errMsg.includes('Timeout')
      return NextResponse.json({
        ok: false,
        elapsed_ms: elapsed,
        error: errMsg,
        diagnosis: isTimeout
          ? 'Timeout — Evolution não respondeu. Provável bloqueio do WhatsApp ou sessão inválida.'
          : 'Erro da Evolution — veja o detalhe acima.',
      }, { status: 502 })
    }
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err?.message ?? String(err),
    }, { status: 500 })
  }
}
