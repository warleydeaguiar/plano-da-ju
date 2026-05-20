import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';

/**
 * Salva campos extras do quiz que migramos do funil pra dentro do app
 * (ex: produtos_casa — pergunta movida pro onboarding pós-foto por causar
 * 84% de abandono no quiz pré-compra).
 *
 * Faz merge no jsonb profiles.quiz_answers — preserva todas as respostas
 * originais e adiciona/sobrescreve só os campos enviados.
 */
export async function POST(req: NextRequest) {
  try {
    // Auth
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const anon = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } },
    );
    const { data: { user }, error: authErr } = await anon.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const produtosCasa: string | undefined = typeof body.produtos_casa === 'string'
      ? body.produtos_casa.trim().slice(0, 2000)
      : undefined;

    // Nada pra salvar — retorna ok pra não bloquear o flow
    if (!produtosCasa) return NextResponse.json({ ok: true, skipped: true });

    const supabase = await createServiceClient();

    // Lê quiz_answers atual e faz merge
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase.from('profiles') as any)
      .select('quiz_answers')
      .eq('id', user.id)
      .maybeSingle();

    const current = (profile?.quiz_answers ?? {}) as Record<string, unknown>;
    const merged = { ...current, produtos_casa: produtosCasa };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('profiles') as any)
      .update({ quiz_answers: merged })
      .eq('id', user.id);

    if (error) {
      console.error('[quiz-extra] update error', error);
      return NextResponse.json({ error: 'Falha ao salvar' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/meu-plano/quiz-extra]', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
