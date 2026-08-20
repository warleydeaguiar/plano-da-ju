import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe/client';
import { PLAN_USD_CENTS } from '@/lib/pricing';
import { normalizeEmail, isValidEmailFormat } from '@/lib/normalize-email';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveAuthUserId } from '@/lib/supabase/auth-resolve';
import { extractFieldsFromQuiz } from '@/lib/quiz-to-profile';
import { logCheckoutError } from '@/lib/checkout-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/checkout/stripe/usa
 * Checkout do funil EUA — US$ 9,90 via Stripe Checkout (hospedado).
 * Escolhido em vez de formulário próprio porque já traz Apple Pay / Google Pay,
 * 3DS e PCI resolvidos — aqui o objetivo é validar o mercado rápido.
 * A ativação acontece SÓ no webhook (checkout.session.completed).
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`stripe-usa:${ip}`, { max: 8, windowMs: 60_000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Muitas tentativas. Aguarde 1 minuto.' }, { status: 429 });

  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: 'Pagamento indisponível no momento.' }, { status: 503 });

  let logEmail: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? normalizeEmail(body.email).email : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const sessionId = typeof body.session_id === 'string' ? body.session_id : '';
    const quizAnswers = (body.quiz_answers && typeof body.quiz_answers === 'object') ? body.quiz_answers : {};
    logEmail = email || null;

    if (!email || !isValidEmailFormat(email)) {
      return NextResponse.json({ error: 'Confira seu e-mail (ex.: nome@email.com).' }, { status: 400 });
    }
    if (!name) return NextResponse.json({ error: 'Informe seu nome.' }, { status: 400 });

    // Pré-cria o perfil (o webhook ativa casando por e-mail) — mesmo padrão do BR.
    try {
      const supabase = await createServiceClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabase.from('profiles') as any)
        .select('id, subscription_status').eq('email', email).maybeSingle();
      const extracted = extractFieldsFromQuiz(quizAnswers);
      if (!existing) {
        const userId = await resolveAuthUserId(supabase, email);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('profiles') as any).upsert({
          id: userId, email, full_name: name, quiz_answers: quizAnswers, ...extracted,
          quiz_session_id: sessionId || null, checkout_session_id: sessionId || null,
          subscription_type: 'none', subscription_status: 'pending', plan_status: 'pending_photo',
        });
      } else if (existing.subscription_status !== 'active') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('profiles') as any)
          .update({ full_name: name, quiz_answers: quizAnswers, ...extracted, checkout_session_id: sessionId || null })
          .eq('email', email);
      }
    } catch (e) {
      console.error('[stripe usa] pre-perfil', e);
    }

    const origin = req.nextUrl.origin;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: PLAN_USD_CENTS,
          product_data: {
            name: 'Plano Capilar Personalizado — Juliane Cost',
            description: 'Para brasileiras que moram nos Estados Unidos',
          },
        },
      }],
      success_url: `${origin}/obrigado?src=usa`,
      cancel_url: `${origin}/oferta/eua?canceled=1`,
      metadata: {
        email, name: name.slice(0, 120), session_id: sessionId,
        market: 'usa', product: 'plano_capilar_usa',
      },
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (err) {
    await logCheckoutError({
      route: 'checkout/stripe/usa', email: logEmail, session_id: null,
      payment_type: 'card', kind: 'exception', err,
    }).catch(() => {});
    return NextResponse.json({ error: 'Não consegui abrir o pagamento. Tente de novo.' }, { status: 500 });
  }
}
