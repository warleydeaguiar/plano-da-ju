import { NextRequest, NextResponse } from 'next/server';
import { pagarme } from '@/lib/pagarme/client';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveAuthUserId } from '@/lib/supabase/auth-resolve';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { extractFieldsFromQuiz } from '@/lib/quiz-to-profile';
import type { PagarMeOrder } from '@/lib/pagarme/types';

export const dynamic = 'force-dynamic';

// Juros simples de 1,99%/mês repassados ao cliente para parcelamento
const MONTHLY_RATE = 1.99;

function installTotalCents(n: number): number {
  if (n <= 1) return 3490;
  return Math.round(3490 * (1 + (MONTHLY_RATE / 100) * n));
}

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
      installments: rawInstallments,
    } = await req.json();

    if (!name || !email || !card_token) {
      return NextResponse.json(
        { error: 'Nome, e-mail e token do cartão são obrigatórios' },
        { status: 400 },
      );
    }

    const n = Math.max(1, Math.min(4, parseInt(rawInstallments ?? '1', 10) || 1));
    const totalCents = installTotalCents(n);

    const cleanCpf   = typeof cpf   === 'string' ? cpf.replace(/\D/g, '')   : '';
    const cleanPhone = (phone ?? '').replace(/\D/g, '');
    const areaCode   = cleanPhone.length >= 10 ? cleanPhone.slice(0, 2)  : '11';
    const phoneNum   = cleanPhone.length >= 10 ? cleanPhone.slice(2)     : '999999999';
    const cleanCep   = billing_address?.cep?.replace(/\D/g, '') ?? '01310100';

    // ── PagarMe v5 Order (one-time charge) ──────────────────────────────────
    const order = await pagarme.post<PagarMeOrder & { status: string }>('/orders', {
      code: `PDJ-${Date.now()}`,
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
            number: phoneNum,
          },
        },
      },
      items: [
        {
          amount: totalCents,
          description: 'Plano Capilar Personalizado — Ju Cost',
          quantity: 1,
          code: 'PLANO-CAPILAR',
        },
      ],
      payments: [
        {
          payment_method: 'credit_card',
          amount: totalCents,
          credit_card: {
            installments: n,
            statement_descriptor: 'JU COST',
            card_token,
            card: {
              billing_address: {
                line_1: 'Endereço cadastrado',
                zip_code: cleanCep,
                city:  billing_address?.city  ?? 'São Paulo',
                state: billing_address?.state ?? 'SP',
                country: 'BR',
              },
            },
          },
        },
      ],
      metadata: {
        source:       'plano-da-ju-web',
        payment_type: 'card',
        installments:  n,
        session_id:    session_id ?? '',
      },
    });

    const supabase = await createServiceClient();
    const userId   = await resolveAuthUserId(supabase, email);

    // order.status === 'paid' → cobrança aprovada imediatamente
    // order.status === 'pending' → aguardando confirmação async
    const charge    = (order as any).charges?.[0];
    const isReallyPaid = order.status === 'paid' ||
                         charge?.status === 'paid';

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
      subscription_type:    isReallyPaid ? 'one_time_card' : 'none',
      subscription_status:  isReallyPaid ? 'active' : 'pending',
      subscription_activated_at: isReallyPaid ? new Date().toISOString() : null,
      subscription_expires_at: isReallyPaid
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        : null,
      pagarme_order_id:     order.id,
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
        amount_cents: totalCents,
        order_id:     order.id,
        metadata: {
          order_status:    order.status,
          installments:    n,
          billing_address: billing_address ?? null,
        },
      });
    }

    return NextResponse.json({
      order_id: order.id,
      status:   order.status,
      paid:     isReallyPaid,
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
