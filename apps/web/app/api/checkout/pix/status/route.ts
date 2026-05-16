import { NextRequest, NextResponse } from 'next/server';
import { pagarme } from '@/lib/pagarme/client';
import { createServiceClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { sendCapiEvent } from '@/lib/meta/capi';

// GET /api/checkout/pix/status?order_id=xxx&email=yyy
// Polling do PIX — chamado a cada 5s pelo frontend.
export async function GET(req: NextRequest) {
  // Rate limit: 200 reqs por IP em 1 min (polling legítimo)
  const ip = getClientIp(req);
  const rl = checkRateLimit(`pix-status:${ip}`, { max: 200, windowMs: 60_000 });
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
      amount?: number;
      customer?: { email?: string };
      charges?: { status: string; last_transaction?: { qr_code?: string } }[];
    }>(`/orders/${orderId}`);

    // ── Validação de segurança: email do request DEVE bater com o do PagarMe ──
    // Sem isso, qualquer um poderia ativar perfis alheios pagando 1 PIX.
    if (order.customer?.email?.toLowerCase().trim() !== email.toLowerCase().trim()) {
      return NextResponse.json({ error: 'Order não pertence a esse email' }, { status: 403 });
    }

    const isPaid =
      order.status === 'paid' ||
      order.charges?.some((c) => c.status === 'paid');

    if (isPaid) {
      const supabase = await createServiceClient();

      // Busca perfil para metadados (idempotência via filtro)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase.from('profiles') as any)
        .select('id, subscription_status, checkout_session_id, full_name, quiz_answers')
        .eq('email', email)
        .maybeSingle();

      // Só ativa se ainda estava pending (idempotente)
      if (profile?.subscription_status === 'pending') {
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
          })
          .eq('email', email)
          .eq('subscription_status', 'pending');

        // Log evento
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('checkout_events') as any).insert({
          session_id: profile?.checkout_session_id ?? orderId,
          event_type: 'payment_confirmed',
          email,
          payment_type: 'pix',
          amount_cents: order.amount ?? 3490,
          order_id: orderId,
          metadata: { source: 'pix_polling' },
        });

        // ── Meta CAPI: Purchase server-side ─────────────────────
        // Quiz answers pode ter phone — usa para advanced matching
        const ans = (profile?.quiz_answers ?? {}) as Record<string, unknown>;
        const phoneDigits = String(ans.phone ?? '').replace(/\D/g, '');
        const phoneE164 = phoneDigits.length === 10 || phoneDigits.length === 11
          ? '55' + phoneDigits : phoneDigits || undefined;
        const fullName = String(ans.name ?? profile?.full_name ?? '').trim().split(/\s+/);

        await sendCapiEvent({
          eventName: 'Purchase',
          eventId: orderId, // dedup com pixel client
          user: {
            email,
            phone: phoneE164,
            firstName: fullName[0],
            lastName: fullName.slice(1).join(' ') || undefined,
            ip,
            userAgent: req.headers.get('user-agent') ?? undefined,
          },
          customData: {
            value: (order.amount ?? 3490) / 100,
            currency: 'BRL',
            content_name: 'Plano Capilar Personalizado',
            order_id: orderId,
          },
        });
      }
    }

    return NextResponse.json({ paid: isPaid, order_status: order.status });
  } catch (err) {
    console.error('[pix/status]', err);
    return NextResponse.json({ error: 'Erro ao verificar status' }, { status: 500 });
  }
}
