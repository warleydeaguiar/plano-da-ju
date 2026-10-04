import { NextRequest, NextResponse } from 'next/server';
import { pagarme } from '@/lib/pagarme/client';
import { createServiceClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import type { PagarMeOrder } from '@/lib/pagarme/types';
import { logCheckoutError } from '@/lib/checkout-log';
import { normalizeEmail, isValidEmailFormat } from '@/lib/normalize-email';

export const dynamic = 'force-dynamic';

// Taxa única do Link na Bio PRO — produto separado do Plano Capilar, preço
// fixo (sem cupom/parcelamento dinâmico, ver plano em
// .claude/plans/juliane-cost-a-mutable-ripple.md).
const PRICE_CENTS = 1990;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`bio-pro-card:${ip}`, { max: 5, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde 1 minuto.' }, { status: 429 });
  }

  let logEmail: string | null = null;
  let logSession: string | null = null;

  try {
    const body = await req.json();
    if (body && typeof body.email === 'string') body.email = normalizeEmail(body.email).email;
    const { name, email, cpf, phone, card_token, session_id, billing_address } = body;
    logEmail = email ?? null;
    logSession = typeof session_id === 'string' ? session_id : null;

    if (!name || !email || !card_token || !session_id) {
      return NextResponse.json(
        { error: 'Nome, e-mail e token do cartão são obrigatórios' },
        { status: 400 },
      );
    }
    if (!isValidEmailFormat(email)) {
      return NextResponse.json(
        { error: 'E-mail inválido. Confira se digitou certo (ex.: nome@email.com).' },
        { status: 400 },
      );
    }

    const supabase = await createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pedido } = await (supabase.from('bio_pro_orders') as any)
      .select('id, status_pagamento')
      .eq('session_id', session_id)
      .maybeSingle();
    if (!pedido) {
      return NextResponse.json({ error: 'Sessão não encontrada — responda o quiz antes de pagar' }, { status: 404 });
    }
    if (pedido.status_pagamento === 'pago') {
      return NextResponse.json({ status: 'paid', paid: true, idempotent: true });
    }

    const cleanCpf = typeof cpf === 'string' ? cpf.replace(/\D/g, '') : '';
    const cleanPhone = String(phone ?? '').replace(/\D/g, '');
    const areaCode = cleanPhone.length >= 10 ? cleanPhone.slice(0, 2) : '';
    const phoneNum = cleanPhone.length >= 10 ? cleanPhone.slice(2) : '';
    const cleanCep = billing_address?.cep?.replace(/\D/g, '') ?? '';

    const billingLine1 = typeof billing_address?.line_1 === 'string' ? billing_address.line_1.trim() : '';
    const billingCity = typeof billing_address?.city === 'string' ? billing_address.city.trim() : '';
    const billingState = typeof billing_address?.state === 'string' ? billing_address.state.trim().toUpperCase() : '';
    const hasBilling = !!(billingLine1 && billingCity && billingState && cleanCep.length === 8);
    if (!hasBilling) {
      await logCheckoutError({
        route: 'link-bio-pro/checkout/card', email: logEmail, session_id: logSession,
        payment_type: 'card', kind: 'block',
        err: new Error('Bloqueio no cartão — endereço de cobrança incompleto'),
      }).catch(() => {});
      return NextResponse.json(
        { error: 'Confira o CEP e o endereço de cobrança — o banco exige esses dados pra aprovar o cartão.' },
        { status: 400 },
      );
    }
    const customerAddress = { line_1: billingLine1, zip_code: cleanCep, city: billingCity, state: billingState, country: 'BR' };

    const order = await pagarme.post<PagarMeOrder>('/orders', {
      customer: {
        name,
        email,
        type: 'individual',
        address: customerAddress,
        ...(cleanCpf.length === 11 ? { document: cleanCpf, document_type: 'CPF' } : {}),
        ...(areaCode && phoneNum ? { phones: { mobile_phone: { country_code: '55', area_code: areaCode, number: phoneNum } } } : {}),
      },
      items: [{ amount: PRICE_CENTS, description: 'Link na Bio PRO — taxa única', quantity: 1, code: 'bio-pro-taxa-unica' }],
      payments: [{
        payment_method: 'credit_card',
        credit_card: {
          recurrence: false,
          installments: 1,
          statement_descriptor: 'LINKBIOPRO',
          card_token,
          card: { billing_address: customerAddress },
        },
      }],
      // metadata.source é o que o webhook usa pra NUNCA confundir esta compra
      // com uma venda do Plano Capilar (ver app/api/webhook/pagarme/route.ts).
      metadata: { source: 'bio-pro-web', payment_type: 'card', session_id },
    });

    const charge = order.charges?.[0];
    const chargeId = charge?.id ?? order.id ?? null;
    const isReallyPaid = charge?.status === 'paid' || order.status === 'paid';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('bio_pro_orders') as any)
      .update({
        nome: name,
        email,
        telefone: cleanPhone || null,
        metodo_pagamento: 'credit_card',
        pagarme_order_id: order.id,
        pagarme_charge_id: chargeId,
        status_pagamento: isReallyPaid ? 'pago' : 'falhou',
        pago_em: isReallyPaid ? new Date().toISOString() : null,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', pedido.id);

    const lt = (charge as unknown as { last_transaction?: { status?: string; acquirer_message?: string } })?.last_transaction;
    const REFUSED = ['failed', 'refused', 'canceled', 'not_authorized', 'with_error'];
    const isRefused = !isReallyPaid && (
      REFUSED.includes(charge?.status ?? '') || REFUSED.includes(lt?.status ?? '') || ['failed', 'canceled'].includes(order.status ?? '')
    );
    if (isRefused) {
      await logCheckoutError({
        route: 'link-bio-pro/checkout/card', email: logEmail, payment_type: 'card', session_id: logSession,
        kind: 'refused',
        err: new Error(`Pagamento recusado: ${lt?.acquirer_message ?? charge?.status ?? 'recusado'}`),
        context: { pagarme_order_id: order.id },
      });
    }

    return NextResponse.json({
      status: order.status,
      paid: isReallyPaid,
      recusado: isRefused,
      amount: PRICE_CENTS,
      redirect_url: isReallyPaid ? '/link-bio-pro/obrigado' : null,
    });
  } catch (err) {
    console.error('[link-bio-pro/checkout/card]', err);
    await logCheckoutError({ route: 'link-bio-pro/checkout/card', email: logEmail, payment_type: 'card', session_id: logSession, err });
    const raw = err instanceof Error ? err.message : '';
    const low = raw.toLowerCase();
    let friendly = 'Não consegui processar seu cartão. Tente outro cartão ou pague via PIX (aprovação na hora).';
    if (low.includes('verification failed')) friendly = 'Seu banco recusou a verificação do cartão. Tente outro cartão ou use o PIX.';
    else if (low.includes('insufficient')) friendly = 'Cartão sem saldo/limite disponível. Tente outro cartão ou pague via PIX.';
    else if (low.includes('expired')) friendly = 'Cartão vencido. Confira a validade ou tente outro cartão.';
    else if (low.includes('cvv')) friendly = 'CVV inválido. Confira o código de segurança do cartão.';
    return NextResponse.json({ error: friendly }, { status: 400 });
  }
}
