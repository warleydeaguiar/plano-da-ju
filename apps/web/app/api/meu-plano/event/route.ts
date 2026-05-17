import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';

// Map event type → hair_state column
const STATE_FIELD: Record<string, string> = {
  wash:            'last_wash_at',
  hydration_mask:  'last_hydration_at',
  nutrition_mask:  'last_nutrition_at',
  reconstruction:  'last_reconstruction_at',
  oil_treatment:   'last_oil_at',
};

export async function POST(req: NextRequest) {
  try {
    // Authenticate via Bearer token
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify token with anon client
    const anonClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } },
    );
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { event_type } = await req.json();
    if (!event_type) return NextResponse.json({ error: 'event_type required' }, { status: 400 });

    const supabase = await createServiceClient();
    const now = new Date().toISOString();

    // Insert hair event
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('hair_events').insert({
      user_id: user.id,
      event_type,
      occurred_at: now,
      created_at: now,
    });

    // Upsert hair_state
    const field = STATE_FIELD[event_type];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stateData: any = { user_id: user.id, updated_at: now };
    if (field) stateData[field] = now;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('hair_state').upsert(stateData, { onConflict: 'user_id' });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/meu-plano/event]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
