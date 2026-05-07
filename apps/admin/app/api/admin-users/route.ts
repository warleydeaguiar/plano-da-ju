import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

// GET — listar admins (usuários do sistema de auth)
export async function GET() {
  const sb = createAdminClient()
  const { data, error } = await sb.auth.admin.listUsers()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const users = data.users.map(u => ({
    id:         u.id,
    email:      u.email,
    name:       u.user_metadata?.full_name ?? u.email?.split('@')[0],
    created_at: u.created_at,
  }))
  return NextResponse.json(users)
}

// POST — criar novo admin
export async function POST(req: NextRequest) {
  const sb = createAdminClient()
  const { name, email, password } = await req.json()
  if (!email || !password) return NextResponse.json({ error: 'E-mail e senha obrigatórios' }, { status: 400 })

  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name ?? email.split('@')[0] },
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ id: data.user.id, email: data.user.email }, { status: 201 })
}

// DELETE — remover admin
export async function DELETE(req: NextRequest) {
  const sb = createAdminClient()
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })
  const { error } = await sb.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
