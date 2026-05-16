import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// POST /api/checkout/event
// Logs a checkout funnel event to checkout_events table.
// Lightweight — never blocks user flow (always returns 200).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { session_id, event_type, email, payment_type, amount_cents, order_id, metadata } = body;

    if (!session_id || !event_type) {
      return NextResponse.json({ ok: false, error: 'session_id e event_type obrigatórios' }, { status: 400 });
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
    // Never fail silently — just log
    console.error('[checkout/event]', err);
    return NextResponse.json({ ok: true }); // still 200 to not block client
  }
}
