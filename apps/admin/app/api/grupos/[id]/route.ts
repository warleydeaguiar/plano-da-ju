import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
const supabase = createAdminClient()

export const dynamic = 'force-dynamic'

/** PATCH /api/grupos/:id — atualiza is_receiving, name, status, etc */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()

  const { data, error } = await supabase
    .from('wg_groups' as any)
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/** DELETE /api/grupos/:id — arquiva o grupo */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const { error } = await supabase
    .from('wg_groups' as any)
    .update({ status: 'archived', is_receiving: false, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
