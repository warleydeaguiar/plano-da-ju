import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '../../../../lib/supabase';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const sb = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.from('hair_plans') as any)
    .select('week_number,focus,tasks,products,tips,approved_by_juliane,juliane_notes')
    .eq('user_id', userId)
    .order('week_number');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ weeks: data ?? [] });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body.action as 'approve' | 'reject';
  const notes = body.notes as string | undefined;

  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json(
      { error: 'action deve ser approve ou reject' },
      { status: 400 },
    );
  }

  const sb = createAdminClient();
  const update: Record<string, unknown> = {
    approved_by_juliane: action === 'approve',
    approved_at: action === 'approve' ? new Date().toISOString() : null,
  };
  if (typeof notes === 'string') update.juliane_notes = notes;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.from('hair_plans') as any)
    .update(update)
    .eq('user_id', userId)
    .eq('week_number', 1); // por enquanto, só week 1 — pode expandir

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Se aprovado, marca também o profile como ready
  if (action === 'approve') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb.from('profiles') as any)
      .update({ plan_status: 'ready', plan_released_at: new Date().toISOString() })
      .eq('id', userId);
  }

  return NextResponse.json({ ok: true });
}
