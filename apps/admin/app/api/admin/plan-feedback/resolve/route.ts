import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/plan-feedback/resolve
 * Body: { id: string }  (id do plan_feedback)
 *
 * Marca o pedido de ajuste como resolvido e tira o perfil do estado de revisão
 * (volta plan_status pra 'ready' se estava 'revision_requested'). Protegido pelo
 * middleware do admin (sessão admin ou Bearer CRON_SECRET).
 */
export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

    const sb = createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: fb } = await (sb.from('plan_feedback') as any)
      .select('user_id')
      .eq('id', id)
      .maybeSingle()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb.from('plan_feedback') as any)
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', id)

    // Se o perfil ainda estiver marcado como revisão, libera de volta.
    if (fb?.user_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (sb.from('profiles') as any)
        .update({ plan_status: 'ready', plan_revision_due_at: null })
        .eq('id', fb.user_id)
        .eq('plan_status', 'revision_requested')
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erro ao resolver pedido' }, { status: 500 })
  }
}
