import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

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
      // PIX pago / cobrança confirmada
      case 'order.paid':
      case 'charge.paid': {
        const order = body.data;
        const email = order.customer?.email;
        if (!email) break;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: profile } = await (supabase.from('profiles') as any)
          .select('id, subscription_status, checkout_session_id')
          .eq('email', email)
          .maybeSingle();

        // Só ativa se ainda estava pending (evita re-processar)
        if (profile?.subscription_status !== 'active') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('profiles') as any)
            .update({
              subscription_type: 'annual_pix',
              subscription_status: 'active',
              subscription_expires_at: new Date(
                Date.now() + 365 * 24 * 60 * 60 * 1000,
              ).toISOString(),
              pagarme_charge_id: order.charges?.[0]?.id ?? order.id ?? null,
              plan_status: 'pending_photo',
              plan_requested_at: new Date().toISOString(),
            })
            .eq('email', email);

          // Log evento de pagamento confirmado
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('checkout_events') as any).insert({
            session_id: profile?.checkout_session_id ?? order.id ?? email,
            event_type: 'payment_confirmed',
            email,
            payment_type: 'pix',
            amount_cents: order.amount ?? 3490,
            order_id: order.id,
            metadata: { webhook_event: eventType },
          });
        }
        break;
      }

      // Cartão — assinatura criada com sucesso
      case 'subscription.created': {
        const sub = body.data;
        const email = sub.customer?.email;
        if (!email) break;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: profile } = await (supabase.from('profiles') as any)
          .select('checkout_session_id')
          .eq('email', email)
          .maybeSingle();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('profiles') as any)
          .update({
            subscription_type: 'annual_card',
            subscription_status: 'active',
            pagarme_subscription_id: sub.id,
            subscription_expires_at: sub.current_cycle?.end_at ?? null,
          })
          .eq('email', email);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('checkout_events') as any).insert({
          session_id: profile?.checkout_session_id ?? sub.id ?? email,
          event_type: 'payment_confirmed',
          email,
          payment_type: 'card',
          amount_cents: 3490,
          order_id: sub.id,
          metadata: { webhook_event: eventType },
        });
        break;
      }

      // Renovação
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
    return NextResponse.json({ ok: true }); // sempre 200 para PagarMe não retentar
  }
}
