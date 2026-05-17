import { NextRequest, NextResponse } from 'next/server';
import { pagarme } from '@/lib/pagarme/client';
import { getOrCreateCardPlan } from '@/lib/pagarme/plans';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveAuthUserId } from '@/lib/supabase/auth-resolve';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import type { PagarMeSubscription } from '@/lib/pagarme/types';

export async function POST(req: NextRequest) {
  // Rate limit: 5 tentativas por IP em 1 min
  const ip = getClientIp(req);
  const rl = checkRateLimit(`card:${ip}`, { max: 5, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Aguarde 1 minuto.' },
      { status: 429 },
    );
  }

  try {
    const { name, email, cpf, phone, card_token, quiz_answers, session_id, billing_address } = await req.json();

    if (!name || !email || !card_token) {
      return NextResponse.json(
        { error: 'Nome, e-mail e token do cartão são obrigatórios' },
        { status: 400 },
      );
    }

    const cleanCpf = typeof cpf === 'string' ? cpf.replace(/\D/g, '') : '';
    const cleanPhone = (phone ?? '').replace(/\D/g, '');
    const areaCode = cleanPhone.length >= 10 ? cleanPhone.slice(0, 2) : '11';
    const phoneNumber = cleanPhone.length >= 10 ? cleanPhone.slice(2) : '999999999';

    const plan = await getOrCreateCardPlan();

    const subscription = await pagarme.post<PagarMeSubscription & { status: string }>(
      '/subscriptions',
      {
        plan_id: plan.id,
        customer: {
          name,
          email,
          type: 'individual',
          ...(cleanCpf.length === 11
            ? { document: cleanCpf, document_type: 'CPF' }
            : {}),
          phones: {
            mobile_phone: {
              country_code: '55',
              area_code: areaCode,
              number: phoneNumber,
            },
          },
        },
        payment_method: 'credit_card',
        card_token,
        metadata: {
          source: 'plano-da-ju-web',
          payment_type: 'card',
          session_id: session_id ?? '',
        },
      },
    );

    const supabase = await createServiceClient();
    const userId = await resolveAuthUserId(supabase, email);

    // IMPORTANTE: status do PagarMe pode ser 'active' (cartão aprovado na 1ª cobrança)
    // OU 'future' / 'pending' (assinatura criada, mas cobrança ainda pendente).
    // Só marcamos perfil como 'active' se a 1ª cobrança realmente passou.
    const isReallyPaid = subscription.status === 'active';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('profiles') as any).upsert({
      id: userId,
      email,
      full_name: name,
      quiz_answers,
      subscription_type: isReallyPaid ? 'annual_card' : 'none',
      subscription_status: isReallyPaid ? 'active' : 'pending',
      subscription_expires_at: isReallyPaid
        ? (subscription.current_cycle?.billing_at
          ? new Date(subscription.current_cycle.billing_at).toISOString()
          : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString())
        : null,
      pagarme_subscription_id: subscription.id,
      plan_status: isReallyPaid ? 'pending_photo' : 'awaiting_payment',
      plan_requested_at: isReallyPaid ? new Date().toISOString() : null,
      checkout_session_id: session_id ?? null,
    });

    // Log evento
    if (session_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('checkout_events') as any).insert({
        session_id,
        event_type: isReallyPaid ? 'payment_confirmed' : 'card_submitted',
        email,
        payment_type: 'card',
        amount_cents: 3490,
        order_id: subscription.id,
        metadata: {
          subscription_status: subscription.status,
          billing_address: billing_address ?? null,
        },
      });
    }

    return NextResponse.json({
      subscription_id: subscription.id,
      status: subscription.status,
      paid: isReallyPaid,
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
