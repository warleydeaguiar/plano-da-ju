import { NextRequest, NextResponse } from 'next/server';
import { pagarme } from '@/lib/pagarme/client';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

// GET /api/checkout/card/status?order_id=xxx&email=yyy
// Verifica se o pedido ficou 'paid' (cobrança aprovada) ou 'failed'.
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`card-status:${ip}`, { max: 200, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('order_id');
  const email   = searchParams.get('email');

  if (!orderId || !email) {
    return NextResponse.json({ error: 'order_id e email obrigatórios' }, { status: 400 });
  }

  try {
    const order = await pagarme.get<{
      id: string;
      status: string;
      customer?: { email?: string };
      charges?: Array<{ status: string }>;
    }>(`/orders/${orderId}`);

    // Segurança: email tem que bater com o do pedido
    if (order.customer?.email?.toLowerCase().trim() !== email.toLowerCase().trim()) {
      return NextResponse.json({ error: 'Pedido não pertence a esse email' }, { status: 403 });
    }

    const chargeStatus = order.charges?.[0]?.status;
    const isPaid   = order.status === 'paid'   || chargeStatus === 'paid';
    const isFailed = order.status === 'failed' || chargeStatus === 'failed' ||
                     order.status === 'canceled';

    return NextResponse.json({
      paid:   isPaid,
      failed: isFailed,
      status: order.status,
    });
  } catch (err) {
    console.error('[card/status]', err);
    return NextResponse.json({ error: 'Erro ao verificar status' }, { status: 500 });
  }
}
