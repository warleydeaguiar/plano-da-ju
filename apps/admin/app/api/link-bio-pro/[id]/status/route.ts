import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const STATUS_VALIDOS = ['pendente', 'em_producao', 'entregue']

/**
 * PATCH /api/link-bio-pro/:id/status — atualiza status_entrega e/ou notas_internas
 * de um pedido do Link na Bio PRO.
 *
 * Sem checagem de auth própria: o middleware.ts do admin já bloqueia todas as
 * rotas (/api/* inclusas) pra quem não tem sessão com role 'admin'.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const body = (await req.json().catch(() => null)) as
    | { status_entrega?: string; notas_internas?: string }
    | null
  if (!body) return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 })

  const { status_entrega, notas_internas } = body
  if (status_entrega === undefined && notas_internas === undefined) {
    return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })
  }
  if (status_entrega !== undefined && !STATUS_VALIDOS.includes(status_entrega)) {
    return NextResponse.json({ error: 'status_entrega inválido' }, { status: 400 })
  }

  const agora = new Date().toISOString()
  const update: Record<string, unknown> = { atualizado_em: agora }
  if (status_entrega !== undefined) {
    update.status_entrega = status_entrega
    if (status_entrega === 'entregue') update.entregue_em = agora
  }
  if (notas_internas !== undefined) update.notas_internas = notas_internas

  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('bio_pro_orders')
    .update(update)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
