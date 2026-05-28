import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { extractFieldsFromQuiz } from '@/lib/quiz-to-profile';

export const dynamic = 'force-dynamic';

/**
 * POST /api/quiz/save-to-profile
 *
 * Usado pelo quiz no passo final. Se a cliente está LOGADA com assinatura ativa
 * MAS ainda não tem quiz_answers (cadastro manual / gift), salva as respostas
 * no profile dela (e extrai hair_type/porosity/main_problems/chemical_history),
 * e devolve `{ handled: true, redirect: '/meu-plano' }` pro quiz mandar ela direto
 * pro app — pulando a oferta/pagamento, já que ela já é assinante.
 *
 * Para usuárias anônimas (o fluxo normal de funil) retorna `{ handled: false }` —
 * o quiz segue para /roleta → /oferta normalmente.
 *
 * Body: { answers: Record<string, unknown> }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const answers = body?.answers && typeof body.answers === 'object' ? body.answers : null;
    if (!answers) return NextResponse.json({ handled: false });

    // Auth via cookies — só age se a pessoa estiver realmente logada.
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ handled: false });

    // Lê o profile com service role (bypassa RLS).
    const service = await createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (service.from('profiles') as any)
      .select('id, subscription_status, quiz_answers')
      .eq('id', user.id)
      .maybeSingle();
    if (!profile) return NextResponse.json({ handled: false });

    const isActive = profile.subscription_status === 'active';
    const noQuiz = !profile.quiz_answers || (typeof profile.quiz_answers === 'object' && Object.keys(profile.quiz_answers).length === 0);
    if (!isActive || !noQuiz) {
      // Usuária comum (ainda não comprou) OU já tem quiz preenchido → não interfere
      return NextResponse.json({ handled: false });
    }

    // Extrai campos derivados (hair_type, porosity, main_problems, etc.)
    const extracted = extractFieldsFromQuiz(answers);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service.from('profiles') as any)
      .update({
        quiz_answers: answers,
        ...extracted,
        plan_requested_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    return NextResponse.json({ handled: true, redirect: '/meu-plano' });
  } catch (err) {
    console.error('[quiz/save-to-profile]', err);
    return NextResponse.json({ handled: false });
  }
}
