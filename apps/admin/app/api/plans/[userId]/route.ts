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
  const action = body.action as string;

  const sb = createAdminClient();

  // ── Edição manual de uma semana ─────────────────────────────────────────
  if (action === 'update_week') {
    const weekNumber = Number(body.week_number);
    if (!weekNumber || weekNumber < 1) {
      return NextResponse.json({ error: 'week_number inválido' }, { status: 400 });
    }

    const focus    = typeof body.focus    === 'string' ? body.focus    : '';
    const tasks    = Array.isArray(body.tasks)    ? body.tasks    : [];
    const products = Array.isArray(body.products) ? body.products : [];
    const tips     = Array.isArray(body.tips)     ? body.tips     : [];

    // Verifica se a semana já existe
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (sb.from('hair_plans') as any)
      .select('id')
      .eq('user_id', userId)
      .eq('week_number', weekNumber)
      .maybeSingle();

    if (existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (sb.from('hair_plans') as any)
        .update({ focus, tasks, products, tips })
        .eq('user_id', userId)
        .eq('week_number', weekNumber);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (sb.from('hair_plans') as any)
        .insert({ user_id: userId, week_number: weekNumber, focus, tasks, products, tips });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Garante que o profile tem plano
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (sb.from('profiles') as any)
        .update({ plan_status: 'manual_required' })
        .eq('id', userId)
        .eq('plan_status', 'pending_photo'); // só muda se ainda estava aguardando
    }

    return NextResponse.json({ ok: true });
  }

  // ── Approve / Reject ────────────────────────────────────────────────────
  if (action === 'approve' || action === 'reject') {
    const notes = body.notes as string | undefined;
    const weekNumber = body.week_number ? Number(body.week_number) : 1;

    const update: Record<string, unknown> = {
      approved_by_juliane: action === 'approve',
      approved_at: action === 'approve' ? new Date().toISOString() : null,
    };
    if (typeof notes === 'string') update.juliane_notes = notes;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb.from('hair_plans') as any)
      .update(update)
      .eq('user_id', userId)
      .eq('week_number', weekNumber);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (action === 'approve') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (sb.from('profiles') as any)
        .update({ plan_status: 'ready', plan_released_at: new Date().toISOString() })
        .eq('id', userId);
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'action inválida' }, { status: 400 });
}
