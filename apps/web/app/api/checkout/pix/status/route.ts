import { NextRequest, NextResponse } from 'next/server';
import { pagarme } from '@/lib/pagarme/client';
import { createServiceClient } from '@/lib/supabase/server';

// GET /api/checkout/pix/status?order_id=xxx&email=yyy
// Polls PagarMe to check if PIX was paid. Called every 5s from the frontend.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('order_id');
  const email   = searchParams.get('email');

  if (!orderId) {
    return NextResponse.json({ error: 'order_id obrigatório' }, { status: 400 });
  }

  try {
    const order = await pagarme.get<{ status: string; charges?: { status: string }[] }>(
      `/orders/${orderId}`
    );

    const isPaid =
      order.status === 'paid' ||
      order.charges?.some((c) => c.status === 'paid');

    if (isPaid && email) {
      const supabase = await createServiceClient();

      // Ativa a assinatura (idempotente — safe to call multiple times)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('profiles') as any)
        .update({
          subscription_type: 'annual_pix',
          subscription_status: 'active',
          subscription_expires_at: new Date(
            Date.now() + 365 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          pagarme_charge_id: orderId,
          plan_status: 'pending_photo',
          plan_requested_at: new Date().toISOString(),
          pixel_purchase_sent_at: null, // será preenchido pelo client após disparar pixel
        })
        .eq('email', email)
        .eq('subscription_status', 'pending'); // só atualiza se ainda pending

      // Log checkout event
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('checkout_events') as any).insert({
        session_id: orderId,
        event_type: 'payment_confirmed',
        email,
        payment_type: 'pix',
        amount_cents: 3490,
        order_id: orderId,
        metadata: { source: 'pix_polling' },
      }).select().maybeSingle(); // ignore duplicates silently
    }

    return NextResponse.json({ paid: isPaid, order_status: order.status });
  } catch (err) {
    console.error('[pix/status]', err);
    return NextResponse.json({ error: 'Erro ao verificar status' }, { status: 500 });
  }
}
