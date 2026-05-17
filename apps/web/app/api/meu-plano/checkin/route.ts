import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';

export async function POST(req: NextRequest) {
  try {
    // Authenticate via Bearer token
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const anonClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } },
    );
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { hair_feel, scalp_feel, breakage, all_answers } = await req.json();
    if (!hair_feel) return NextResponse.json({ error: 'hair_feel required' }, { status: 400 });

    const supabase = await createServiceClient();
    const now = new Date().toISOString();

    // Insert check-in
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('check_ins').insert({
      user_id: user.id,
      checked_at: now,
      hair_feel,
      scalp_feel: scalp_feel ?? null,
      breakage_observed: breakage === true,
      questions_asked: Object.keys(all_answers ?? { hair_feel, scalp_feel }),
      answers_raw: all_answers ?? { hair_feel, scalp_feel, breakage },
    });

    // Update current_condition in hair_state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('hair_state').upsert({
      user_id: user.id,
      current_condition: hair_feel,
      updated_at: now,
    }, { onConflict: 'user_id' });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/meu-plano/checkin]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
