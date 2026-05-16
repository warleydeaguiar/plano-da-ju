import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const VALID_EVENT_TYPES = new Set([
  'offer_viewed',
  'checkout_initiated',
  'pix_generated',
  'card_submitted',
  'payment_confirmed',
  'payment_failed',
  'password_set',
  'photo_uploaded',
  'plan_generated',
  'abandoned',
]);

export async function POST(req: NextRequest) {
  // Rate limit: 30 eventos por IP por minuto (mais que o suficiente)
  const ip = getClientIp(req);
  const rl = checkRateLimit(`event:${ip}`, { max: 30, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: 'Rate limit' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { session_id, event_type, email, payment_type, amount_cents, order_id, metadata } = body;

    if (!session_id || !event_type) {
      return NextResponse.json({ ok: false, error: 'session_id e event_type obrigatórios' }, { status: 400 });
    }

    if (!VALID_EVENT_TYPES.has(event_type)) {
      return NextResponse.json({ ok: false, error: 'event_type inválido' }, { status: 400 });
    }

    // Validação básica de session_id (formato cs_NUMERO_HASH)
    if (!/^cs_\d+_[a-z0-9]{4,12}$/.test(session_id)) {
      return NextResponse.json({ ok: false, error: 'session_id inválido' }, { status: 400 });
    }

    const supabase = await createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('checkout_events') as any).insert({
      session_id,
      event_type,
      email: email ?? null,
      payment_type: payment_type ?? null,
      amount_cents: amount_cents ?? null,
      order_id: order_id ?? null,
      metadata: metadata ?? {},
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[checkout/event]', err);
    return NextResponse.json({ ok: true }); // não bloqueia o cliente
  }
}
