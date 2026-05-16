import { NextRequest, NextResponse } from 'next/server';
import { pagarme } from '@/lib/pagarme/client';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

// GET /api/checkout/card/status?subscription_id=xxx&email=yyy
// Verifica se a assinatura ficou 'active' (cobrança aprovada) ou 'canceled' (recusada).
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`card-status:${ip}`, { max: 200, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const subId = searchParams.get('subscription_id');
  const email = searchParams.get('email');

  if (!subId || !email) {
    return NextResponse.json({ error: 'subscription_id e email obrigatórios' }, { status: 400 });
  }

  try {
    const sub = await pagarme.get<{
      id: string;
      status: string;
      customer?: { email?: string };
    }>(`/subscriptions/${subId}`);

    // Segurança: email tem que bater
    if (sub.customer?.email?.toLowerCase().trim() !== email.toLowerCase().trim()) {
      return NextResponse.json({ error: 'Assinatura não pertence a esse email' }, { status: 403 });
    }

    const isPaid = sub.status === 'active';
    const isFailed = sub.status === 'canceled' || sub.status === 'failed';

    return NextResponse.json({
      paid: isPaid,
      failed: isFailed,
      status: sub.status,
    });
  } catch (err) {
    console.error('[card/status]', err);
    return NextResponse.json({ error: 'Erro ao verificar status' }, { status: 500 });
  }
}
