import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// PagarMe webhook events we handle
const HANDLED_EVENTS = new Set([
  'order.paid',
  'subscription.created',
  'subscription.canceled',
  'subscription.renewed',
  'charge.paid',
]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const eventType: string = body.type;

    if (!HANDLED_EVENTS.has(eventType)) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const supabase = await createServiceClient();

    switch (eventType) {
      // PIX pago — ativar assinatura
      case 'order.paid':
      case 'charge.paid': {
        const order = body.data;
        const email = order.customer?.email;
        if (!email) break;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('profiles') as any)
          .update({
            subscription_type: 'annual_pix',
            subscription_status: 'active',
            subscription_expires_at: new Date(
              Date.now() + 365 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            pagarme_charge_id: order.charges?.[0]?.id ?? null,
            plan_status: 'pending_photo',
            plan_requested_at: new Date().toISOString(),
          })
          .eq('email', email);
        break;
      }

      // Assinatura criada (cartão)
      case 'subscription.created': {
        const sub = body.data;
        const email = sub.customer?.email;
        if (!email) break;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('profiles') as any)
          .update({
            subscription_type: 'annual_card',
            subscription_status: 'active',
            pagarme_subscription_id: sub.id,
            subscription_expires_at: sub.current_cycle?.end_at ?? null,
          })
          .eq('email', email);
        break;
      }

      // Renovação de assinatura
      case 'subscription.renewed': {
        const sub = body.data;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('profiles') as any)
          .update({
            subscription_status: 'active',
            subscription_expires_at: sub.current_cycle?.end_at ?? null,
          })
          .eq('pagarme_subscription_id', sub.id);
        break;
      }

      // Cancelamento
      case 'subscription.canceled': {
        const sub = body.data;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('profiles') as any)
          .update({ subscription_status: 'cancelled' })
          .eq('pagarme_subscription_id', sub.id);
        break;
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[webhook/pagarme]', err);
    // Sempre retornar 200 para o PagarMe não retentar
    return NextResponse.json({ ok: true });
  }
}
