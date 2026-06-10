import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';
import { logServerError } from '@/lib/server-log';

export const runtime = 'nodejs';

/** Adiciona N dias ÚTEIS (pula sábado/domingo) a partir de uma data. */
function addBusinessDays(from: Date, n: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}

/**
 * POST /api/meu-plano/plan-feedback
 * Body: { rating?: number (1-5), message?: string }
 * - Salva a avaliação. Se vier `message` (pedido de ajuste), abre um chamado
 *   em plan_feedback (status 'open'), define SLA de 2 dias ÚTEIS e marca o
 *   perfil como 'revision_requested' → aparece na Revisão de Planos do admin.
 */
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const anon = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } },
    );
    const { data: { user } } = await anon.auth.getUser(token);
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const body = await req.json();
    const rating = Number.isFinite(body.rating) ? Math.max(1, Math.min(5, Math.round(body.rating))) : null;
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 2000) : '';
    const wantsRevision = message.length > 0;

    if (!rating && !wantsRevision) {
      return NextResponse.json({ error: 'Envie uma nota ou uma mensagem.' }, { status: 400 });
    }

    const sb = await createServiceClient();
    const now = new Date();
    const dueAt = wantsRevision ? addBusinessDays(now, 2).toISOString() : null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb.from('plan_feedback') as any).insert({
      user_id: user.id,
      email: user.email ?? null,
      rating,
      message: message || null,
      status: wantsRevision ? 'open' : 'resolved',
      due_at: dueAt,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = { plan_feedback_rating: rating ?? undefined };
    if (wantsRevision) {
      updates.plan_status = 'revision_requested'; // entra na fila de Revisão de Planos
      updates.plan_revision_due_at = dueAt;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb.from('profiles') as any).update(updates).eq('id', user.id);

    return NextResponse.json({ ok: true, revision: wantsRevision, due_at: dueAt });
  } catch (err) {
    await logServerError({ route: 'meu-plano/plan-feedback', err, context: { impact: 'cliente não conseguiu avaliar/pedir ajuste do plano' } });
    return NextResponse.json({ error: 'Erro ao enviar avaliação' }, { status: 500 });
  }
}
