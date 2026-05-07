import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

// GET — listar todos
export async function GET() {
  const sb = createAdminClient()
  const { data, error } = await (sb.from('staff_members') as any)
    .select('*')
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST — criar
export async function POST(req: NextRequest) {
  const sb = createAdminClient()
  const body = await req.json()
  const { name, email, phone, role, department, status, avatar_color, notes } = body
  if (!name?.trim()) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })

  const { data, error } = await (sb.from('staff_members') as any)
    .insert([{ name: name.trim(), email: email || null, phone: phone || null, role, department: department || null, status, avatar_color, notes: notes || null }])
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// PATCH — atualizar
export async function PATCH(req: NextRequest) {
  const sb = createAdminClient()
  const body = await req.json()
  const { id, ...fields } = body
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

  // Limpar campos vazios
  const clean: Record<string, any> = {}
  for (const [k, v] of Object.entries(fields)) {
    clean[k] = v === '' ? null : v
  }

  const { data, error } = await (sb.from('staff_members') as any)
    .update(clean)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE — remover
export async function DELETE(req: NextRequest) {
  const sb = createAdminClient()
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

  const { error } = await (sb.from('staff_members') as any).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
