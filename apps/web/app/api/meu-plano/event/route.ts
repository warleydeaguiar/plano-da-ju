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

    // Insert hair event (retorna o id pra permitir desfazer no app)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inserted } = await (supabase as any).from('hair_events').insert({
      user_id: user.id,
      event_type,
      occurred_at: now,
      created_at: now,
    }).select('id').single();

    // Upsert hair_state
    const field = STATE_FIELD[event_type];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stateData: any = { user_id: user.id, updated_at: now };
    if (field) stateData[field] = now;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('hair_state').upsert(stateData, { onConflict: 'user_id' });

    return NextResponse.json({ ok: true, id: inserted?.id ?? null });
  } catch (err) {
    console.error('[api/meu-plano/event]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// DELETE — desfaz um registro recém-criado (toque errado no "Registrar").
// Apaga o hair_event e recalcula o campo de hair_state pro evento anterior
// do mesmo tipo (ou null se não houver mais nenhum).
export async function DELETE(req: NextRequest) {
  try {
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const anonClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } },
    );
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { event_id } = await req.json();
    if (!event_id) return NextResponse.json({ error: 'event_id required' }, { status: 400 });

    const supabase = await createServiceClient();

    // Apaga só se pertencer ao usuário; retorna o tipo pra recalcular o state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: deleted } = await (supabase as any).from('hair_events')
      .delete()
      .eq('id', event_id)
      .eq('user_id', user.id)
      .select('event_type')
      .single();

    if (!deleted) return NextResponse.json({ ok: true }); // nada apagado (id inválido/não é dono)

    const field = STATE_FIELD[deleted.event_type];
    if (field) {
      // Recalcula o campo pro evento mais recente que sobrou desse tipo
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: prev } = await (supabase as any).from('hair_events')
        .select('occurred_at')
        .eq('user_id', user.id)
        .eq('event_type', deleted.event_type)
        .order('occurred_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('hair_state').upsert(
        { user_id: user.id, [field]: prev?.occurred_at ?? null, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/meu-plano/event DELETE]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
