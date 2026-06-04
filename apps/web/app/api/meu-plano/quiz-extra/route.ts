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

    // Conjunto de respostas do quiz in-app (cadastro manual). Só campos
    // conhecidos, coagidos a string curta — evita gravar lixo no jsonb.
    const ALLOWED_KEYS = new Set([
      'tipo', 'cor', 'idade', 'espessura', 'quimica', 'incomoda', 'porosidade',
      'oleosidade', 'lavagem', 'calor', 'caspa', 'objetivo', 'como_plano',
    ]);
    const rawAnswers = (body && typeof body.answers === 'object' && body.answers)
      ? body.answers as Record<string, unknown> : null;
    const answers: Record<string, string> = {};
    if (rawAnswers) {
      for (const [k, v] of Object.entries(rawAnswers)) {
        if (ALLOWED_KEYS.has(k) && typeof v === 'string' && v.trim()) {
          answers[k] = v.trim().slice(0, 200);
        }
      }
    }

    // Nada pra salvar — retorna ok pra não bloquear o flow
    if (!produtosCasa && Object.keys(answers).length === 0) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const supabase = await createServiceClient();

    // Lê quiz_answers atual e faz merge
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase.from('profiles') as any)
      .select('quiz_answers')
      .eq('id', user.id)
      .maybeSingle();

    const current = (profile?.quiz_answers ?? {}) as Record<string, unknown>;
    const merged = {
      ...current,
      ...answers,
      ...(produtosCasa ? { produtos_casa: produtosCasa } : {}),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatePayload: Record<string, unknown> = { quiz_answers: merged };
    // Espelha o tipo de cabelo na coluna dedicada (prioriza catálogo no plano)
    if (answers.tipo) updatePayload.hair_type = answers.tipo;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('profiles') as any)
      .update(updatePayload)
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
