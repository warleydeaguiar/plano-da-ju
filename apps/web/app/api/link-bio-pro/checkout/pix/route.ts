import { NextRequest, NextResponse, after } from 'next/server';
import { pagarme } from '@/lib/pagarme/client';
import { createServiceClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import type { PagarMeOrder } from '@/lib/pagarme/types';
import { logCheckoutError } from '@/lib/checkout-log';
import { normalizeEmail, isValidEmailFormat } from '@/lib/normalize-email';

export const runtime = 'nodejs';
export const maxDuration = 45;

// Taxa única do Link na Bio PRO — ver .claude/plans/juliane-cost-a-mutable-ripple.md
const PRICE_CENTS = 1990;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function waitForQrCode(orderId: string, current: any): Promise<any> {
  let pixData = current;
  const delays = [500, 700, 900, 1100, 1300, 1600, 2000, 2500, 2500, 3000];
  for (let i = 0; i < delays.length && !pixData?.qr_code; i++) {
    await new Promise((r) => setTimeout(r, delays[i]));
    try {
      const refreshed = await pagarme.get<PagarMeOrder>(`/orders/${orderId}`);
      pixData = refreshed.charges?.[0]?.last_transaction;
    } catch { /* tenta de novo no próximo loop */ }
  }
  return pixData;
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`bio-pro-pix:${ip}`, { max: 5, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde 1 minuto.' }, { status: 429, headers: { 'Retry-After': '60' } });
  }

  let logEmail: string | null = null;
  let logSession: string | null = null;

  try {
    const body = await req.json();
    if (body && typeof body.email === 'string') body.email = normalizeEmail(body.email).email;
    const { name, email, cpf, phone, session_id } = body;
    logEmail = email ?? null;
    logSession = typeof session_id === 'string' ? session_id : null;

    if (!name || !email || !session_id) {
      return NextResponse.json({ error: 'Nome e e-mail são obrigatórios' }, { status: 400 });
    }
    if (!isValidEmailFormat(email)) {
      return NextResponse.json({ error: 'E-mail inválido. Confira se digitou certo (ex.: nome@email.com).' }, { status: 400 });
    }

    const cleanCpf = (cpf ?? '').replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      return NextResponse.json({ error: 'CPF inválido — obrigatório para pagamento via PIX' }, { status: 400 });
    }
    const cleanPhone = String(phone ?? '').replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      await logCheckoutError({
        route: 'link-bio-pro/checkout/pix', email: logEmail, payment_type: 'pix', kind: 'block',
        err: new Error('PIX sem telefone — Pagar.me recusaria a ordem'), session_id: logSession,
      });
      return NextResponse.json({ error: 'Preciso do seu WhatsApp para gerar o PIX.', need_phone: true }, { status: 400 });
    }
    const areaCode = cleanPhone.slice(0, 2);
    const phoneNumber = cleanPhone.slice(2);

    const supabase = await createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pedido } = await (supabase.from('bio_pro_orders') as any)
      .select('id, status_pagamento, pagarme_order_id')
      .eq('session_id', session_id)
      .maybeSingle();
    if (!pedido) {
      return NextResponse.json({ error: 'Sessão não encontrada — responda o quiz antes de pagar' }, { status: 404 });
    }
    if (pedido.status_pagamento === 'pago') {
      return NextResponse.json({ status: 'paid', paid: true, idempotent: true });
    }

    // Reusa ordem PIX pendente existente em vez de criar duplicada.
    if (pedido.pagarme_order_id) {
      try {
        const reused = await pagarme.get<PagarMeOrder & { status: string }>(`/orders/${pedido.pagarme_order_id}`);
        if (reused.status === 'pending' || reused.status === 'waiting_payment') {
          let pixData = reused.charges?.[0]?.last_transaction;
          if (!pixData?.qr_code) pixData = await waitForQrCode(reused.id, pixData);
          if (pixData?.qr_code) {
            return NextResponse.json({
              order_id: reused.id, pix_qr_code: pixData.qr_code, pix_qr_code_url: pixData.qr_code_url,
              expires_at: pixData.expires_at, amount: PRICE_CENTS, reused: true,
            });
          }
        }
      } catch { /* se falhar ao reusar, cria novo PIX */ }
    }

    const order = await pagarme.post<PagarMeOrder>('/orders', {
      customer: {
        name, email, type: 'individual', document: cleanCpf, document_type: 'CPF',
        phones: { mobile_phone: { country_code: '55', area_code: areaCode, number: phoneNumber } },
      },
      items: [{ amount: PRICE_CENTS, description: 'Link na Bio PRO — taxa única', quantity: 1, code: 'bio-pro-taxa-unica' }],
      payments: [{ payment_method: 'pix', pix: { expires_in: 3600, additional_information: [{ name: 'Produto', value: 'Link na Bio PRO' }] } }],
      // metadata.source é o que o webhook usa pra NUNCA confundir esta compra
      // com uma venda do Plano Capilar (ver app/api/webhook/pagarme/route.ts).
      metadata: { source: 'bio-pro-web', payment_type: 'pix', session_id },
    });

    let pixData = order.charges?.[0]?.last_transaction;
    if (!pixData?.qr_code) pixData = await waitForQrCode(order.id, pixData);
    const qrPending = !pixData?.qr_code;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('bio_pro_orders') as any)
      .update({
        nome: name,
        email,
        telefone: cleanPhone,
        metodo_pagamento: 'pix',
        pagarme_order_id: order.id,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', pedido.id);

    const _orderId = order.id;
    after(async () => {
      if (!pixData?.qr_code) {
        const late = await waitForQrCode(_orderId, null);
        if (!late?.qr_code) {
          await logCheckoutError({
            route: 'link-bio-pro/checkout/pix', email: logEmail, payment_type: 'pix', session_id: logSession,
            kind: 'exception', err: new Error('QR do PIX não ficou pronto nem no retry em background'),
            context: { order_id: _orderId },
          }).catch(() => {});
        }
      }
    });

    return NextResponse.json({
      order_id: order.id,
      pix_qr_code: pixData?.qr_code ?? null,
      pix_qr_code_url: pixData?.qr_code_url ?? null,
      expires_at: pixData?.expires_at ?? null,
      amount: PRICE_CENTS,
      pix_pending: qrPending,
    });
  } catch (err) {
    console.error('[link-bio-pro/checkout/pix]', err);
    await logCheckoutError({ route: 'link-bio-pro/checkout/pix', email: logEmail, payment_type: 'pix', session_id: logSession, err });
    const raw = err instanceof Error ? err.message : '';
    const friendly = /qr code|504|502|timeout|gateway/i.test(raw)
      ? 'Tivemos uma instabilidade ao gerar o PIX agora. Tente de novo em alguns segundos — ou pague no cartão.'
      : (raw || 'Erro ao gerar PIX');
    return NextResponse.json({ error: friendly }, { status: 500 });
  }
}
