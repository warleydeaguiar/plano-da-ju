import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { sendWelcomeEmail } from '@/lib/welcome-email'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/admin/profiles/[id]
 * Edita qualquer campo da usuária. Se o email mudar, sincroniza com auth.users
 * e dispara o email de boas-vindas pro NOVO endereço automaticamente.
 *
 * Body (todos opcionais):
 *   email, full_name, phone, subscription_type, subscription_status,
 *   subscription_expires_at (ISO), is_gift, admin_notes
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const body = await req.json()
    const sb = createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: current } = await (sb.from('profiles') as any)
      .select('id, email, full_name')
      .eq('id', id)
      .single()
    if (!current) return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 })

    const updates: Record<string, unknown> = {}
    const allowed = [
      'full_name', 'phone', 'subscription_type', 'subscription_status',
      'subscription_expires_at', 'is_gift', 'admin_notes',
    ] as const
    for (const key of allowed) {
      if (key in body) {
        let value = body[key]
        if (key === 'phone' && typeof value === 'string') value = value.replace(/\D/g, '') || null
        if (value === '') value = null
        updates[key] = value
      }
    }

    // Tratar mudança de email com sync no auth + reenvio de welcome
    let emailChanged = false
    let welcomeSent = false
    let welcomeError: string | undefined
    if (typeof body.email === 'string') {
      const newEmail = body.email.trim().toLowerCase()
      if (newEmail && newEmail !== current.email?.toLowerCase()) {
        emailChanged = true
        // Verifica se o novo email já existe em outro profile
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: dupe } = await (sb.from('profiles') as any)
          .select('id').ilike('email', newEmail).neq('id', id).maybeSingle()
        if (dupe) {
          return NextResponse.json({ error: 'Email já em uso por outra usuária' }, { status: 409 })
        }
        // Atualiza no auth.users
        const { error: authErr } = await sb.auth.admin.updateUserById(id, { email: newEmail, email_confirm: true })
        if (authErr) {
          return NextResponse.json({ error: `Falha ao atualizar auth: ${authErr.message}` }, { status: 500 })
        }
        updates.email = newEmail
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: true, no_changes: true })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updated, error: upErr } = await (sb.from('profiles') as any)
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    // Se o email mudou, reenvia welcome pro novo endereço
    if (emailChanged) {
      const res = await sendWelcomeEmail(sb as any, {
        email: updated.email,
        name: updated.full_name,
      })
      welcomeSent = res.ok
      welcomeError = res.error
    }

    return NextResponse.json({
      ok: true,
      profile: updated,
      email_changed: emailChanged,
      welcome_sent: welcomeSent,
      welcome_error: welcomeError,
    })
  } catch (err) {
    console.error('[admin/profiles PATCH]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro inesperado' }, { status: 500 })
  }
}
