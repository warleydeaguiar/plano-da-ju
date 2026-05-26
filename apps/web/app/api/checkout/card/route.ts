import { NextRequest, NextResponse } from 'next/server';
import { pagarme } from '@/lib/pagarme/client';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveAuthUserId } from '@/lib/supabase/auth-resolve';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { extractFieldsFromQuiz } from '@/lib/quiz-to-profile';
import { getOrCreateCardPlan } from '@/lib/pagarme/plans';
import type { PagarMeSubscription } from '@/lib/pagarme/types';
import { logCheckoutError } from '@/lib/checkout-log';

export const dynamic = 'force-dynamic';

const PRICE_CENTS = 3490;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`card:${ip}`, { max: 5, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde 1 minuto.' }, { status: 429 });
  }

  // Capturados fora do try pra estarem disponíveis no log de erro
  let logEmail: string | null = null;
  let logSession: string | null = null;
  let logInstallments = 1;

  try {
    const {
      name, email, cpf, phone,
      card_token, quiz_answers, session_id, billing_address,
      installments: rawInstallments,
    } = await req.json();
    logEmail = email ?? null;
    logSession = typeof session_id === 'string' ? session_id : null;

    if (!name || !email || !card_token) {
      return NextResponse.json(
        { error: 'Nome, e-mail e token do cartão são obrigatórios' },
        { status: 400 },
      );
    }

    // Parcelas: 1..4 sem juros (validado server-side)
    const n = Math.max(1, Math.min(4, parseInt(String(rawInstallments ?? '1'), 10) || 1));
    logInstallments = n;

    const cleanCpf   = typeof cpf   === 'string' ? cpf.replace(/\D/g, '')   : '';
    // Phone: prefere o que veio do form, fallback pra quiz_answers (já coletado no quiz)
    // Não enviar número falso ao PagarMe — antifraude usa este dado
    const rawPhone   = phone ?? (quiz_answers as Record<string, unknown>)?.phone
                              ?? (quiz_answers as Record<string, unknown>)?.telefone ?? '';
    const cleanPhone = String(rawPhone).replace(/\D/g, '');
    const areaCode   = cleanPhone.length >= 10 ? cleanPhone.slice(0, 2)  : '';
    const phoneNum   = cleanPhone.length >= 10 ? cleanPhone.slice(2)     : '';
    const cleanCep   = billing_address?.cep?.replace(/\D/g, '') ?? '01310100';

    const supabase = await createServiceClient();

    // Idempotência: se já existe subscription recente para esse email, reusa
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingProfile } = await (supabase.from('profiles') as any)
      .select('pagarme_subscription_id, subscription_status, updated_at')
      .eq('email', email)
      .maybeSingle();

    if (existingProfile?.pagarme_subscription_id) {
      const updatedAt = new Date(existingProfile.updated_at ?? 0).getTime();
      const recent = Date.now() - updatedAt < 5 * 60 * 1000; // 5min

      if (recent || existingProfile.subscription_status === 'active') {
        try {
          const sub = await pagarme.get<PagarMeSubscription>(`/subscriptions/${existingProfile.pagarme_subscription_id}`);
          const charge = sub.charges?.[0];
          const isPaid = charge?.status === 'paid' || (sub.status === 'active' && !charge);
          return NextResponse.json({
            order_id:     charge?.id ?? sub.id,
            status:       sub.status,
            paid:         isPaid,
            redirect_url: isPaid ? '/obrigado' : null,
            idempotent:   true,
          });
        } catch {
          // Subscription antiga inválida — continua e cria nova
        }
      }
    }

    // ── PagarMe v5 Subscription (trimestral/90 dias, renova a cada 3 meses) ──
    const plan = await getOrCreateCardPlan();
    const subscription = await pagarme.post<PagarMeSubscription>('/subscriptions', {
      plan_id: plan.id,
      installments: n,
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
      // card_token vai no TOP-LEVEL — dentro de `card` a PagarMe ignora o token
      // e exige número/validade do cartão (erro "The card number is required").
      card_token,
      card: {
        billing_address: {
          line_1: billing_address?.line_1 ?? billing_address?.street ?? 'Não informado',
          zip_code: cleanCep,
          city:  billing_address?.city  ?? 'São Paulo',
          state: billing_address?.state ?? 'SP',
          country: 'BR',
        },
      },
      metadata: {
        source:       'plano-da-ju-web',
        payment_type: 'card',
        session_id:    session_id ?? '',
      },
    });

    const userId   = await resolveAuthUserId(supabase, email);

    // Confia primariamente no status da primeira charge — subscription.status
    // pode ser 'active' enquanto a cobrança ainda está em processamento.
    const charge = subscription.charges?.[0];
    const chargeId = charge?.id ?? null;
    const isReallyPaid = charge?.status === 'paid' ||
                         (subscription.status === 'active' && !charge); // fallback

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
        ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
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
          installments:        n,
        },
      });
    }

    // ── Captura RECUSA de pagamento ───────────────────────────────────────
    // A PagarMe retorna HTTP 200 mesmo quando o cartão é NEGADO (charge fica
    // 'failed'/'refused'). Sem isto, a recusa some — vira só um 'card_submitted'
    // silencioso e o log de erros nunca enche. Aqui registramos a recusa com o
    // motivo da adquirente (acquirer_message / código de retorno).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lt: any = (charge as any)?.last_transaction ?? {};
    const chargeStatus = charge?.status ?? '';
    const txStatus = lt?.status ?? '';
    const REFUSED = ['failed', 'refused', 'canceled', 'not_authorized', 'with_error'];
    const isRefused = !isReallyPaid && (REFUSED.includes(chargeStatus) || REFUSED.includes(txStatus));

    if (isRefused) {
      const declineMsg =
        lt?.acquirer_message ||
        lt?.gateway_response?.errors?.[0]?.message ||
        `Cobrança ${chargeStatus || 'recusada'}`;
      await logCheckoutError({
        route: 'checkout/card',
        email: logEmail,
        payment_type: 'card',
        session_id: logSession,
        kind: 'refused',
        err: new Error(`Pagamento recusado: ${declineMsg}`),
        context: {
          installments:         n,
          charge_status:        chargeStatus,
          transaction_status:   txStatus,
          acquirer_message:     lt?.acquirer_message ?? null,
          acquirer_return_code: lt?.acquirer_return_code ?? null,
          acquirer_name:        lt?.acquirer_name ?? null,
          gateway_response:     lt?.gateway_response ?? null,
          subscription_id:      subscription.id,
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
    await logCheckoutError({
      route: 'checkout/card',
      email: logEmail,
      payment_type: 'card',
      session_id: logSession,
      err,
      context: { installments: logInstallments },
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao processar cartão' },
      { status: 500 },
    );
  }
}
