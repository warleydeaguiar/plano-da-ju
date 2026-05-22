import { NextRequest, NextResponse } from 'next/server';
import { pagarme } from '@/lib/pagarme/client';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveAuthUserId } from '@/lib/supabase/auth-resolve';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { extractFieldsFromQuiz } from '@/lib/quiz-to-profile';
import { getOrCreateCardPlan } from '@/lib/pagarme/plans';
import type { PagarMeSubscription } from '@/lib/pagarme/types';

export const dynamic = 'force-dynamic';

const PRICE_CENTS = 3490;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`card:${ip}`, { max: 5, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde 1 minuto.' }, { status: 429 });
  }

  try {
    const {
      name, email, cpf, phone,
      card_token, quiz_answers, session_id, billing_address,
      // installments may come from frontend — ignored (subscription is always full price)
      installments: _installments,
    } = await req.json();

    if (!name || !email || !card_token) {
      return NextResponse.json(
        { error: 'Nome, e-mail e token do cartão são obrigatórios' },
        { status: 400 },
      );
    }

    const cleanCpf   = typeof cpf   === 'string' ? cpf.replace(/\D/g, '')   : '';
    // Phone: prefere o que veio do form, fallback pra quiz_answers (já coletado no quiz)
    // Não enviar número falso ao PagarMe — antifraude usa este dado
    const rawPhone   = phone ?? (quiz_answers as Record<string, unknown>)?.phone
                              ?? (quiz_answers as Record<string, unknown>)?.telefone ?? '';
    const cleanPhone = String(rawPhone).replace(/\D/g, '');
    const areaCode   = cleanPhone.length >= 10 ? cleanPhone.slice(0, 2)  : '';
    const phoneNum   = cleanPhone.length >= 10 ? cleanPhone.slice(2)     : '';
    const cleanCep   = billing_address?.cep?.replace(/\D/g, '') ?? '01310100';

    // ── PagarMe v5 Subscription (annual, auto-renews) ────────────────────────
    const plan = await getOrCreateCardPlan();
    const subscription = await pagarme.post<PagarMeSubscription>('/subscriptions', {
      plan_id: plan.id,
      payment_method: 'credit_card',
      customer: {
        name,
        email,
        type: 'individual',
        ...(cleanCpf.length === 11
          ? { document: cleanCpf, document_type: 'CPF' }
          : {}),
        ...(areaCode && phoneNum ? {
          phones: {
            mobile_phone: { country_code: '55', area_code: areaCode, number: phoneNum },
          },
        } : {}),
      },
      card_token,
      billing_address: {
        line_1: 'Endereço cadastrado',
        zip_code: cleanCep,
        city:  billing_address?.city  ?? 'São Paulo',
        state: billing_address?.state ?? 'SP',
        country: 'BR',
      },
      metadata: {
        source:       'plano-da-ju-web',
        payment_type: 'card',
        session_id:    session_id ?? '',
      },
    });

    const supabase = await createServiceClient();
    const userId   = await resolveAuthUserId(supabase, email);

    // subscription.status === 'active' → cobrança aprovada imediatamente
    // first charge status === 'paid' → same
    const chargeId     = subscription.charges?.[0]?.id ?? null;
    const isReallyPaid = subscription.status === 'active' ||
                         subscription.charges?.[0]?.status === 'paid';

    const extracted = extractFieldsFromQuiz(quiz_answers);
    // phone: prefere o que veio do form (cleanPhone), fallback pro quiz_answers
    const profilePhone = cleanPhone || extracted.phone || null;

    await (supabase.from('profiles') as any).upsert({
      id:                   userId,
      email,
      full_name:            name,
      quiz_answers,
      ...extracted,
      phone:                profilePhone,
      quiz_session_id:      typeof session_id === 'string' ? session_id : null,
      subscription_type:    isReallyPaid ? 'annual_card' : 'none',
      subscription_status:  isReallyPaid ? 'active' : 'pending',
      subscription_activated_at: isReallyPaid ? new Date().toISOString() : null,
      subscription_expires_at: isReallyPaid
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        : null,
      pagarme_subscription_id: subscription.id,
      pagarme_charge_id:    chargeId,
      plan_status:          isReallyPaid ? 'pending_photo' : 'awaiting_payment',
      plan_requested_at:    isReallyPaid ? new Date().toISOString() : null,
      checkout_session_id:  session_id ?? null,
    });

    if (session_id) {
      await (supabase.from('checkout_events') as any).insert({
        session_id,
        event_type:   isReallyPaid ? 'payment_confirmed' : 'card_submitted',
        email,
        payment_type: 'card',
        amount_cents: PRICE_CENTS,
        order_id:     chargeId ?? subscription.id,
        metadata: {
          subscription_status: subscription.status,
          subscription_id:     subscription.id,
          billing_address:     billing_address ?? null,
        },
      });
    }

    return NextResponse.json({
      order_id:     chargeId ?? subscription.id,
      status:       subscription.status,
      paid:         isReallyPaid,
      redirect_url: isReallyPaid ? '/obrigado' : null,
    });
  } catch (err) {
    console.error('[checkout/card]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao processar cartão' },
      { status: 500 },
    );
  }
}
