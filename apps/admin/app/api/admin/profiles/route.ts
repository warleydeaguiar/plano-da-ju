import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { sendWelcomeEmail } from '@/lib/welcome-email'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/profiles
 * Cadastra uma usuária manualmente (presente, cortesia, correção).
 *
 * Body:
 *   email            (obrigatório)
 *   full_name        (recomendado)
 *   phone            (opcional — facilita busca futura)
 *   subscription_type ('annual_card' | 'annual_pix' — default 'annual_pix')
 *   duration_months  (3 | 6 | 12 | 24, default 12)
 *   is_gift          (boolean — default false)
 *   admin_notes      (string opcional)
 *   send_welcome     (boolean — default true)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = String(body.email ?? '').trim().toLowerCase()
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Email válido obrigatório' }, { status: 400 })
    }

    const full_name = String(body.full_name ?? '').trim() || null
    const phone = String(body.phone ?? '').replace(/\D/g, '') || null
    const subscription_type = ['annual_card', 'annual_pix'].includes(body.subscription_type)
      ? body.subscription_type : 'annual_pix'
    const duration_months = [1, 3, 6, 12, 24].includes(Number(body.duration_months))
      ? Number(body.duration_months) : 12
    const is_gift = Boolean(body.is_gift)
    const admin_notes = String(body.admin_notes ?? '').trim() || null
    const send_welcome = body.send_welcome !== false

    const sb = createAdminClient()

    // 1) Verifica se já existe profile com esse email.
    // Só bloqueia se já estiver ATIVA (não sobrescrever cliente pagante). Um
    // profile 'pending' (cadastro que não pagou, ou órfão de tentativa anterior)
    // PODE ser convertido em presente/cortesia — então deixamos seguir.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (sb.from('profiles') as any)
      .select('id, email, subscription_status')
      .ilike('email', email)
      .maybeSingle()
    if (existing && existing.subscription_status === 'active') {
      return NextResponse.json({
        error: `Já existe usuária ATIVA com esse email. Edite a existente em vez de criar duplicada.`,
        existing_id: existing.id,
      }, { status: 409 })
    }

    // 2) Resolve o auth user. Se já há profile, reusa o id (o auth user existe via FK).
    // Senão, procura o auth user; se não existir, cria (o trigger on_auth_user_created
    // cria a linha base em profiles automaticamente).
    const tempPassword = `temp_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`
    let userId: string | null = existing?.id ?? null

    if (!userId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const listResp = await (sb.auth.admin as any).listUsers({ page: 1, perPage: 200 })
      const found = listResp.data?.users?.find((u: { email?: string }) => u.email?.toLowerCase() === email)
      if (found) {
        userId = found.id
      } else {
        const { data: created, error: createErr } = await sb.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name: full_name ?? undefined },
        })
        if (createErr || !created.user) {
          return NextResponse.json({ error: `Falha ao criar auth user: ${createErr?.message}` }, { status: 500 })
        }
        userId = created.user.id
      }
    }

    // 3) Grava o profile com UPSERT (onConflict id).
    // O trigger handle_new_user() já criou a linha base (id, email, full_name) ao
    // criar o auth user — então um INSERT colidiria com profiles_pkey. O upsert
    // atualiza essa linha com os dados da assinatura.
    const now = new Date()
    const expiresAt = new Date(now.getTime() + duration_months * 30 * 86400000)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newProfile, error: profErr } = await (sb.from('profiles') as any)
      .upsert({
        id: userId,
        email,
        full_name,
        phone,
        subscription_type,
        subscription_status: 'active',
        subscription_activated_at: now.toISOString(),
        subscription_expires_at: expiresAt.toISOString(),
        is_gift,
        admin_notes,
        plan_status: 'pending_photo',
        plan_requested_at: now.toISOString(),
      }, { onConflict: 'id' })
      .select()
      .single()

    if (profErr) {
      return NextResponse.json({ error: `Falha ao gravar profile: ${profErr.message}` }, { status: 500 })
    }

    // 4) Envia email de boas-vindas (não bloqueia se falhar)
    let emailSent = false
    let emailError: string | undefined
    if (send_welcome) {
      const res = await sendWelcomeEmail(sb as any, { email, name: full_name })
      emailSent = res.ok
      emailError = res.error
    }

    return NextResponse.json({
      ok: true,
      profile: newProfile,
      email_sent: emailSent,
      email_error: emailError,
    })
  } catch (err) {
    console.error('[admin/profiles POST]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro inesperado' }, { status: 500 })
  }
}
