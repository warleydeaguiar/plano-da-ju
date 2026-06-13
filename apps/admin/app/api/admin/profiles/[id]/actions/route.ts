import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { sendWelcomeEmail } from '@/lib/welcome-email'
import { pagarmeCancelSubscription, pagarmeRefundCharge } from '@/lib/pagarme'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/profiles/[id]/actions
 * Ações operacionais rápidas.
 *
 * Body: { action: 'resend_welcome' | 'refund' | 'extend' | 'cancel', months?: number }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { action, months, password } = await req.json()
    const sb = createAdminClient()

    // ── Definir/redefinir senha (auth user) ──────────────────────
    if (action === 'set_password') {
      if (typeof password !== 'string' || password.length < 6) {
        return NextResponse.json({ error: 'Senha precisa ter pelo menos 6 caracteres' }, { status: 400 })
      }
      const { error } = await sb.auth.admin.updateUserById(id, { password })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, message: 'Senha atualizada' })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (sb.from('profiles') as any)
      .select('id, email, full_name, subscription_expires_at, subscription_status, quiz_session_id, pagarme_subscription_id, pagarme_charge_id')
      .eq('id', id)
      .single()
    if (!profile) return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 })

    // ── Reenvia welcome ──────────────────────────────────────────
    if (action === 'resend_welcome') {
      const res = await sendWelcomeEmail(sb as any, {
        email: profile.email,
        name: profile.full_name,
        session_id: profile.quiz_session_id,
      })
      return NextResponse.json({ ok: res.ok, error: res.error })
    }

    // ── Reembolso (estorna o dinheiro na PagarMe + encerra acesso) ──
    if (action === 'refund') {
      // 1) ESTORNO real do dinheiro: cancela a cobrança paga na PagarMe.
      let refundOk = false
      let refundError: string | null = null
      if (profile.pagarme_charge_id) {
        const r = await pagarmeRefundCharge(profile.pagarme_charge_id)
        refundOk = r.ok
        if (!r.ok) refundError = r.error ?? 'falha ao estornar'
      } else {
        refundError = 'Sem pagarme_charge_id no cadastro — estorne manualmente na PagarMe.'
      }

      // 2) Cancela a assinatura (impede cobranças futuras), se houver.
      if (profile.pagarme_subscription_id) {
        const cancelRes = await pagarmeCancelSubscription(profile.pagarme_subscription_id)
        if (!cancelRes.ok) console.warn(`[admin/actions refund] falha ao cancelar subscription:`, cancelRes.error)
      }

      // 3) Atualiza o cadastro: encerra o acesso e marca reembolso.
      const now = new Date()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (sb.from('profiles') as any)
        .update({
          subscription_status: 'refunded',
          subscription_expires_at: now.toISOString(),
          refunded_at: now.toISOString(),
        })
        .eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // Sucesso parcial é possível: acesso encerrado mas estorno falhou → o
      // admin precisa saber pra concluir na mão. Sinalizamos no retorno.
      return NextResponse.json({
        ok: true,
        refunded: refundOk,
        refund_error: refundError,
        message: refundOk
          ? '✅ Reembolso feito na PagarMe e acesso encerrado.'
          : `⚠️ Acesso encerrado, mas o estorno automático NÃO foi concluído (${refundError}). Faça o estorno manualmente na PagarMe.`,
      })
    }

    // ── Estende N meses ──────────────────────────────────────────
    if (action === 'extend') {
      const m = [1, 2, 3, 6, 12].includes(Number(months)) ? Number(months) : 1
      const base = profile.subscription_expires_at && new Date(profile.subscription_expires_at) > new Date()
        ? new Date(profile.subscription_expires_at)
        : new Date()
      const newExp = new Date(base.getTime() + m * 30 * 86400000)
      const updates: Record<string, unknown> = {
        subscription_expires_at: newExp.toISOString(),
      }
      // Se estava expirada/cancelada, reativa
      if (['expired', 'cancelled', 'refunded'].includes(profile.subscription_status)) {
        updates.subscription_status = 'active'
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (sb.from('profiles') as any).update(updates).eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({
        ok: true,
        new_expires_at: newExp.toISOString(),
        months_added: m,
      })
    }

    // ── Cancela acesso (mantém histórico) ────────────────────────
    if (action === 'cancel') {
      // Cancela na PagarMe também (se houver subscription)
      if (profile.pagarme_subscription_id) {
        const cancelRes = await pagarmeCancelSubscription(profile.pagarme_subscription_id)
        if (!cancelRes.ok) {
          console.warn(`[admin/actions cancel] falha ao cancelar subscription na PagarMe:`, cancelRes.error)
          // Continua com cancelamento local — admin pode reprocessar depois
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (sb.from('profiles') as any)
        .update({
          subscription_status: 'cancelled',
          subscription_expires_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, message: 'Assinatura cancelada' })
    }

    return NextResponse.json({ error: 'action inválida' }, { status: 400 })
  } catch (err) {
    console.error('[admin/profiles/actions]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro inesperado' }, { status: 500 })
  }
}
