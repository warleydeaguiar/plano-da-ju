import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

/**
 * Administradores do sistema.
 *
 * IMPORTANTE: TODA cliente tem uma conta de auth (pra logar no /meu-plano).
 * Por isso NÃO listamos todos os auth.users — só quem tem o flag de admin
 * (app_metadata.role === 'admin'). Caso contrário a lista mostraria todas as
 * clientes como "admin" (bug) e o "Remover" apagaria o login delas.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAdmin(u: any): boolean {
  return u?.app_metadata?.role === 'admin'
}

// Busca todos os auth users (paginado) — necessário pra filtrar por role,
// já que a API admin não filtra por app_metadata no servidor.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function listAllUsers(sb: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all: any[] = []
  let page = 1
  for (;;) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(error.message)
    all.push(...(data?.users ?? []))
    if (!data?.users || data.users.length < 1000) break
    page++
    if (page > 20) break // safety
  }
  return all
}

// GET — lista SÓ os admins (role=admin)
export async function GET() {
  const sb = createAdminClient()
  try {
    const users = await listAllUsers(sb)
    const admins = users
      .filter(isAdmin)
      .map(u => ({
        id:         u.id,
        email:      u.email,
        name:       u.user_metadata?.full_name ?? u.email?.split('@')[0],
        created_at: u.created_at,
      }))
    return NextResponse.json(admins)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro' }, { status: 500 })
  }
}

// POST — torna alguém admin. Se o e-mail já existe (ex: já é cliente), apenas
// CONCEDE o role de admin à conta existente — não cria duplicado nem apaga nada.
export async function POST(req: NextRequest) {
  const sb = createAdminClient()
  const { name, email, password } = await req.json()
  if (!email) return NextResponse.json({ error: 'E-mail obrigatório' }, { status: 400 })
  const cleanEmail = String(email).trim().toLowerCase()

  try {
    const users = await listAllUsers(sb)
    const existing = users.find(u => u.email?.toLowerCase() === cleanEmail)

    if (existing) {
      // Já tem conta → só promove a admin (preserva o resto)
      const { data, error } = await sb.auth.admin.updateUserById(existing.id, {
        app_metadata: { ...(existing.app_metadata ?? {}), role: 'admin' },
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ id: data.user.id, email: data.user.email, promoted: true }, { status: 200 })
    }

    // Não existe → cria já como admin (senha obrigatória nesse caso)
    if (!password) {
      return NextResponse.json({ error: 'Senha obrigatória para criar um novo admin' }, { status: 400 })
    }
    const { data, error } = await sb.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: name ?? cleanEmail.split('@')[0] },
      app_metadata: { role: 'admin' },
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ id: data.user.id, email: data.user.email, created: true }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro' }, { status: 500 })
  }
}

// DELETE — REMOVE O ACESSO ADMIN (tira o role). NUNCA apaga a conta de auth,
// pra não destruir o login de uma cliente que também é admin.
export async function DELETE(req: NextRequest) {
  const sb = createAdminClient()
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: userResp } = await (sb.auth.admin as any).getUserById(id)
    const current = userResp?.user?.app_metadata ?? {}
    const next = { ...current }
    delete next.role
    const { error } = await sb.auth.admin.updateUserById(id, { app_metadata: next })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, downgraded: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro' }, { status: 500 })
  }
}
