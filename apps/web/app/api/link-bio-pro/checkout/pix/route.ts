import { NextRequest, NextResponse, after } from 'next/server';
import { pagarme } from '@/lib/pagarme/client';
import { createServiceClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import type { PagarMeOrder } from '@/lib/pagarme/types';
import { logCheckoutError } from '@/lib/checkout-log';
import { normalizeEmail, isValidEmailFormat } from '@/lib/normalize-email';
import { sendEmail } from '@/lib/ses-mailer';
import {
  BIO_PRO_ITEM_CODE, BIO_PRO_PRECO_CENTS, BIO_PRO_SOURCE, emailPix, primeiroNome, sessionIdValido,
} from '@/lib/bio-pro';

export const runtime = 'nodejs';
export const maxDuration = 45;

type OrderComMeta = PagarMeOrder & { metadata?: { session_id?: string } };

// A Pagar.me às vezes demora a popular o qr_code: espera até ~16s antes de
// devolver `pix_pending` (mesmo padrão de app/api/checkout/pix).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function esperarQr(orderId: string, atual: any): Promise<any> {
  let pix = atual;
  const atrasos = [500, 700, 900, 1100, 1300, 1600, 2000, 2500, 2500, 3000];
  for (let i = 0; i < atrasos.length && !pix?.qr_code; i++) {
    await new Promise((r) => setTimeout(r, atrasos[i]));
    try {
      pix = (await pagarme.get<PagarMeOrder>(`/orders/${orderId}`)).charges?.[0]?.last_transaction;
    } catch { /* tenta de novo */ }
  }
  return pix;
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`bio-pro-pix:${ip}`, { max: 5, windowMs: 60_000 }).allowed) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde 1 minuto.' }, { status: 429, headers: { 'Retry-After': '60' } });
  }

  let logEmail: string | null = null;
  let logSession: string | null = null;

  try {
    const body = await req.json();
    const { name, cpf, phone, session_id } = body;
    const email = typeof body.email === 'string' ? normalizeEmail(body.email).email : '';
    logEmail = email || null;
    logSession = typeof session_id === 'string' ? session_id : null;

    if (!sessionIdValido(session_id)) {
      return NextResponse.json({ error: 'Sessão inválida — recarregue a página.' }, { status: 400 });
    }
    if (!name || !email) {
      return NextResponse.json({ error: 'Nome e e-mail são obrigatórios' }, { status: 400 });
    }
    if (!isValidEmailFormat(email)) {
      return NextResponse.json({ error: 'E-mail inválido. Confira se digitou certo (ex.: nome@email.com).' }, { status: 400 });
    }
    const cleanCpf = String(cpf ?? '').replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      return NextResponse.json({ error: 'CPF inválido — obrigatório para pagamento via PIX' }, { status: 400 });
    }
    // Sem telefone a Pagar.me recusa a ordem PIX (lição do Plano Capilar).
    const cleanPhone = String(phone ?? '').replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      await logCheckoutError({
        route: 'link-bio-pro/checkout/pix', email: logEmail, payment_type: 'pix', kind: 'block',
        err: new Error('PIX sem telefone — Pagar.me recusaria a ordem'), session_id: logSession,
      });
      return NextResponse.json({ error: 'Preciso do seu WhatsApp para gerar o PIX.', need_phone: true }, { status: 400 });
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

    // Reaproveita um PIX pendente DESTA sessão em vez de criar uma ordem órfã.
    if (pedido.pagarme_order_id?.startsWith('or_')) {
      try {
        const antiga = await pagarme.get<OrderComMeta>(`/orders/${pedido.pagarme_order_id}`);
        const ehPix = antiga.charges?.[0]?.payment_method === 'pix';
        if (ehPix && antiga.status === 'pending' && antiga.metadata?.session_id === session_id) {
          let pix = antiga.charges?.[0]?.last_transaction;
          if (!pix?.qr_code) pix = await esperarQr(antiga.id, pix);
          if (pix?.qr_code) {
            return NextResponse.json({
              order_id: antiga.id, pix_qr_code: pix.qr_code, pix_qr_code_url: pix.qr_code_url,
              expires_at: pix.expires_at, amount: BIO_PRO_PRECO_CENTS, reused: true, email,
            });
          }
        }
      } catch { /* cria um novo */ }
    }

    const order = await pagarme.post<PagarMeOrder>('/orders', {
      customer: {
        name, email, type: 'individual', document: cleanCpf, document_type: 'CPF',
        phones: { mobile_phone: { country_code: '55', area_code: cleanPhone.slice(0, 2), number: cleanPhone.slice(2) } },
      },
      items: [{ amount: BIO_PRO_PRECO_CENTS, description: 'Link na Bio PRO — taxa única', quantity: 1, code: BIO_PRO_ITEM_CODE }],
      payments: [{ payment_method: 'pix', pix: { expires_in: 3600, additional_information: [{ name: 'Produto', value: 'Link na Bio PRO' }] } }],
      // metadata.source/session_id: é por aqui que o webhook acha ESTE pedido
      // e nunca confunde com uma venda do Plano Capilar.
      metadata: { source: BIO_PRO_SOURCE, payment_type: 'pix', session_id },
    });

    let pix = order.charges?.[0]?.last_transaction;
    if (!pix?.qr_code) pix = await esperarQr(order.id, pix);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb.from('bio_pro_orders') as any)
      .update({
        nome: String(name).slice(0, 120), email, telefone: cleanPhone,
        metodo_pagamento: 'pix', pagarme_order_id: order.id, atualizado_em: new Date().toISOString(),
      })
      .eq('id', pedido.id)
      .neq('status_pagamento', 'pago');

    // Depois da resposta: se o QR atrasou, segue esperando; e manda o código
    // por e-mail — quem fecha a página ainda consegue pagar (lição do Plano Capilar).
    const orderId = order.id;
    let codigo = pix?.qr_code as string | undefined;
    let qrUrl = pix?.qr_code_url as string | undefined;
    after(async () => {
      if (!codigo) {
        const tarde = await esperarQr(orderId, null);
        codigo = tarde?.qr_code;
        qrUrl = tarde?.qr_code_url;
        if (!codigo) {
          await logCheckoutError({
            route: 'link-bio-pro/checkout/pix', email: logEmail, payment_type: 'pix', session_id: logSession,
            kind: 'exception', err: new Error('QR do PIX não ficou pronto nem no retry em background'), context: { order_id: orderId },
          });
          return;
        }
      }
      try {
        await sendEmail({
          to: email, toName: String(name),
          subject: 'Seu PIX do Link na Bio PRO — código para pagar 💛',
          html: emailPix(primeiroNome(String(name)), codigo, qrUrl),
        });
      } catch (e) { console.error('[bio-pro pix email]', e); }
    });

    return NextResponse.json({
      order_id: order.id,
      pix_qr_code: pix?.qr_code ?? null,
      pix_qr_code_url: pix?.qr_code_url ?? null,
      expires_at: pix?.expires_at ?? null,
      amount: BIO_PRO_PRECO_CENTS,
      // A tela abre em "gerando seu código" e busca pelo /status — sem erro.
      pix_pending: !pix?.qr_code,
      email,
    });
  } catch (err) {
    console.error('[link-bio-pro/checkout/pix]', err);
    await logCheckoutError({ route: 'link-bio-pro/checkout/pix', email: logEmail, payment_type: 'pix', session_id: logSession, err });
    const raw = err instanceof Error ? err.message : '';
    const friendly = /qr code|504|502|timeout|gateway/i.test(raw)
      ? 'Tivemos uma instabilidade ao gerar o PIX agora. Tente de novo em alguns segundos — ou pague no cartão.'
      : 'Não consegui gerar o PIX agora. Tente de novo em alguns segundos.';
    return NextResponse.json({ error: friendly }, { status: 500 });
  }
}
