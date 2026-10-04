import { NextRequest, NextResponse } from 'next/server';
import { pagarme } from '@/lib/pagarme/client';
import { createServiceClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { logCheckoutError } from '@/lib/checkout-log';

// GET /api/link-bio-pro/checkout/pix/status?order_id=xxx&email=yyy
// Polling do PIX — chamado a cada 5s pelo frontend. Mesmo padrão de
// /api/checkout/pix/status, mas ativa `bio_pro_orders`, nunca `profiles`.
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`bio-pro-pix-status:${ip}`, { max: 200, windowMs: 60_000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit' }, { status: 429 });

  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('order_id');
  const email = searchParams.get('email');
  if (!orderId || !email) {
    return NextResponse.json({ error: 'order_id e email obrigatórios' }, { status: 400 });
  }

  try {
    const order = await pagarme.get<{
      id: string;
      status: string;
      amount?: number;
      customer?: { email?: string };
      charges?: { id: string; status: string; last_transaction?: { qr_code?: string; qr_code_url?: string; expires_at?: string } }[];
    }>(`/orders/${orderId}`);

    if (order.customer?.email?.toLowerCase().trim() !== email.toLowerCase().trim()) {
      return NextResponse.json({ error: 'Order não pertence a esse email' }, { status: 403 });
    }

    const isPaid = order.status === 'paid' || order.charges?.some((c) => c.status === 'paid');

    if (isPaid) {
      const supabase = await createServiceClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('bio_pro_orders') as any)
        .update({
          status_pagamento: 'pago',
          pagarme_charge_id: order.charges?.[0]?.id ?? orderId,
          pago_em: new Date().toISOString(),
          atualizado_em: new Date().toISOString(),
        })
        .eq('pagarme_order_id', orderId)
        .neq('status_pagamento', 'pago');
    }

    const tx = order.charges?.[0]?.last_transaction;
    return NextResponse.json({
      paid: isPaid,
      order_status: order.status,
      pix_qr_code: tx?.qr_code ?? null,
      pix_qr_code_url: tx?.qr_code_url ?? null,
      expires_at: tx?.expires_at ?? null,
    });
  } catch (err) {
    console.error('[link-bio-pro/pix/status]', err);
    await logCheckoutError({ route: 'link-bio-pro/checkout/pix/status', email, payment_type: 'pix', err, context: { order_id: orderId } });
    return NextResponse.json({ error: 'Erro ao verificar status' }, { status: 500 });
  }
}
