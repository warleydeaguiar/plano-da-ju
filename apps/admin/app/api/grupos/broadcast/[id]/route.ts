import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/** DELETE /api/grupos/broadcast/[id] — cancela broadcast agendado */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = createAdminClient()
  const { id } = await params

  const { data: broadcast } = await supabase
    .from('wg_broadcasts' as any)
    .select('status')
    .eq('id', id)
    .single()

  if (!broadcast) return NextResponse.json({ error: 'Broadcast não encontrado' }, { status: 404 })
  if ((broadcast as any).status !== 'scheduled') {
    return NextResponse.json({ error: 'Só é possível cancelar broadcasts agendados' }, { status: 400 })
  }

  await supabase
    .from('wg_broadcasts' as any)
    .update({ status: 'cancelled' })
    .eq('id', id)

  return NextResponse.json({ ok: true })
}
