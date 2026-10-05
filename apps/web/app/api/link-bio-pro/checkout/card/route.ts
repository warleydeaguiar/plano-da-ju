import { NextRequest, NextResponse } from 'next/server';
import { pagarme } from '@/lib/pagarme/client';
import { createServiceClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import type { PagarMeOrder } from '@/lib/pagarme/types';
import { logCheckoutError } from '@/lib/checkout-log';
import { normalizeEmail, isValidEmailFormat } from '@/lib/normalize-email';
import {
  BIO_PRO_ITEM_CODE, BIO_PRO_PRECO_CENTS, BIO_PRO_SOURCE, marcarPedidoPago, sessionIdValido,
} from '@/lib/bio-pro';

export const dynamic = 'force-dynamic';

const RECUSADO = ['failed', 'refused', 'canceled', 'not_authorized', 'with_error'];

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`bio-pro-card:${ip}`, { max: 5, windowMs: 60_000 }).allowed) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde 1 minuto.' }, { status: 429 });
  }

  let logEmail: string | null = null;
  let logSession: string | null = null;

  try {
    const body = await req.json();
    const { name, cpf, phone, card_token, session_id, billing_address } = body;
    const email = typeof body.email === 'string' ? normalizeEmail(body.email).email : '';
    logEmail = email || null;
    logSession = typeof session_id === 'string' ? session_id : null;

    if (!sessionIdValido(session_id)) {
      return NextResponse.json({ error: 'Sessão inválida — recarregue a página.' }, { status: 400 });
    }
    if (!name || !email || !card_token) {
      return NextResponse.json({ error: 'Nome, e-mail e cartão são obrigatórios' }, { status: 400 });
    }
    if (!isValidEmailFormat(email)) {
      return NextResponse.json({ error: 'E-mail inválido. Confira se digitou certo (ex.: nome@email.com).' }, { status: 400 });
    }

    const sb = await createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pedido } = await (sb.from('bio_pro_orders') as any)
      .select('id, status_pagamento, pagarme_order_id')
      .eq('session_id', session_id)
      .maybeSingle();
    if (!pedido) {
      return NextResponse.json({ error: 'Sessão não encontrada — recarregue a página.' }, { status: 404 });
    }
    if (pedido.status_pagamento === 'pago') {
      return NextResponse.json({ paid: true, idempotent: true, order_id: pedido.pagarme_order_id });
    }

    const cleanCpf = typeof cpf === 'string' ? cpf.replace(/\D/g, '') : '';
    const cleanPhone = String(phone ?? '').replace(/\D/g, '');
    const areaCode = cleanPhone.length >= 10 ? cleanPhone.slice(0, 2) : '';
    const phoneNum = cleanPhone.length >= 10 ? cleanPhone.slice(2) : '';
    const cleanCep = String(billing_address?.cep ?? '').replace(/\D/g, '');
    const linha1 = typeof billing_address?.line_1 === 'string' ? billing_address.line_1.trim() : '';
    const cidade = typeof billing_address?.city === 'string' ? billing_address.city.trim() : '';
    const uf = typeof billing_address?.state === 'string' ? billing_address.state.trim().toUpperCase() : '';
    if (!(linha1 && cidade && uf && cleanCep.length === 8)) {
      await logCheckoutError({
        route: 'link-bio-pro/checkout/card', email: logEmail, session_id: logSession, payment_type: 'card', kind: 'block',
        err: new Error('Bloqueio no cartão — endereço de cobrança incompleto'),
      });
      return NextResponse.json({ error: 'Confira o CEP e o endereço de cobrança — o banco exige esses dados pra aprovar o cartão.' }, { status: 400 });
    }
    // O endereço PRECISA ir na order: a API de tokens da Pagar.me descarta o
    // billing_address (ver o mesmo comentário em app/api/checkout/card).
    const endereco = { line_1: linha1, zip_code: cleanCep, city: cidade, state: uf, country: 'BR' };

    const order = await pagarme.post<PagarMeOrder>('/orders', {
      customer: {
        name, email, type: 'individual', address: endereco,
        ...(cleanCpf.length === 11 ? { document: cleanCpf, document_type: 'CPF' } : {}),
        ...(areaCode && phoneNum ? { phones: { mobile_phone: { country_code: '55', area_code: areaCode, number: phoneNum } } } : {}),
      },
      items: [{ amount: BIO_PRO_PRECO_CENTS, description: 'Link na Bio PRO — taxa única', quantity: 1, code: BIO_PRO_ITEM_CODE }],
      payments: [{
        payment_method: 'credit_card',
        credit_card: {
          recurrence: false, installments: 1, statement_descriptor: 'LINKBIOPRO', card_token,
          card: { billing_address: endereco },
        },
      }],
      // metadata.source/session_id: é por aqui que o webhook acha ESTE pedido
      // e nunca confunde com uma venda do Plano Capilar.
      metadata: { source: BIO_PRO_SOURCE, payment_type: 'card', session_id },
    });

    const charge = order.charges?.[0];
    const lt = (charge as unknown as { last_transaction?: { status?: string; acquirer_message?: string } })?.last_transaction;
    const pago = charge?.status === 'paid' || order.status === 'paid';
    const recusado = !pago && (
      RECUSADO.includes(charge?.status ?? '') || RECUSADO.includes(lt?.status ?? '') || ['failed', 'canceled'].includes(order.status ?? '')
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb.from('bio_pro_orders') as any)
      .update({
        nome: String(name).slice(0, 120),
        email,
        ...(cleanPhone ? { telefone: cleanPhone } : {}),
        metodo_pagamento: 'credit_card',
        pagarme_order_id: order.id,
        pagarme_charge_id: charge?.id ?? null,
        ...(recusado ? { status_pagamento: 'falhou' } : {}),
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', pedido.id)
      .neq('status_pagamento', 'pago');

    if (pago) {
      await marcarPedidoPago(sb, { sessionId: session_id, orderId: order.id, chargeId: charge?.id }, {
        ip, userAgent: req.headers.get('user-agent') ?? undefined, origem: 'cartão aprovado',
      });
    }

    if (recusado) {
      await logCheckoutError({
        route: 'link-bio-pro/checkout/card', email: logEmail, payment_type: 'card', session_id: logSession, kind: 'refused',
        err: new Error(`Pagamento recusado: ${lt?.acquirer_message ?? charge?.status ?? 'recusado'}`),
        context: { pagarme_order_id: order.id },
      });
    }

    return NextResponse.json({
      order_id: order.id,
      status: order.status,
      paid: pago,
      recusado,
      // Antifraude/processamento: nem aprovado nem recusado ainda. Antes isso
      // virava "recusado" e a cliente tentava de novo — cobrança dupla.
      analise: !pago && !recusado,
      amount: BIO_PRO_PRECO_CENTS,
      email,
    });
  } catch (err) {
    console.error('[link-bio-pro/checkout/card]', err);
    await logCheckoutError({ route: 'link-bio-pro/checkout/card', email: logEmail, payment_type: 'card', session_id: logSession, err });
    const low = (err instanceof Error ? err.message : '').toLowerCase();
    let friendly = 'Não consegui processar seu cartão. Tente outro cartão ou pague via PIX (aprovação na hora).';
    if (low.includes('verification failed') || low.includes('could not create credit card')) friendly = 'Seu banco recusou a verificação do cartão. Tente outro cartão ou use o PIX — a aprovação é na hora.';
    else if (low.includes('insufficient')) friendly = 'Cartão sem saldo/limite disponível. Tente outro cartão ou pague via PIX.';
    else if (low.includes('expired')) friendly = 'Cartão vencido. Confira a validade ou tente outro cartão.';
    else if (low.includes('cvv')) friendly = 'CVV inválido. Confira o código de segurança do cartão.';
    return NextResponse.json({ error: friendly }, { status: 400 });
  }
}
