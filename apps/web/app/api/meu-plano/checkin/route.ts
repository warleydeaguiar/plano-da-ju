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

    // Insert check-in — erro aqui não pode passar despercebido (o cliente
    // navegava embora achando que salvou).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insErr } = await (supabase as any).from('check_ins').insert({
      user_id: user.id,
      checked_at: now,
      hair_feel,
      scalp_feel: scalp_feel ?? null,
      // null = pergunta não respondida (não force "sem quebra")
      breakage_observed: breakage === true ? true : breakage === false ? false : null,
      questions_asked: Object.keys(all_answers ?? { hair_feel, scalp_feel }),
      answers_raw: all_answers ?? { hair_feel, scalp_feel, breakage },
    });
    if (insErr) {
      console.error('[api/meu-plano/checkin] insert', insErr);
      return NextResponse.json({ error: 'Falha ao salvar check-in' }, { status: 500 });
    }

    // Update current_condition in hair_state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: upErr } = await (supabase as any).from('hair_state').upsert({
      user_id: user.id,
      current_condition: hair_feel,
      updated_at: now,
    }, { onConflict: 'user_id' });
    if (upErr) console.error('[api/meu-plano/checkin] hair_state upsert', upErr);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/meu-plano/checkin]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
