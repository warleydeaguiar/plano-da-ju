import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe/client';
import { PLAN_BASE_CENTS } from '@/lib/pricing';
import { precoParaCobrar } from '@/lib/cupom';
import { normalizeEmail, isValidEmailFormat } from '@/lib/normalize-email';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { logCheckoutError } from '@/lib/checkout-log';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveAuthUserId } from '@/lib/supabase/auth-resolve';
import { extractFieldsFromQuiz } from '@/lib/quiz-to-profile';

export const dynamic = 'force-dynamic';

/**
 * POST /api/checkout/stripe/intent
 * Cria um PaymentIntent do Stripe pro pagamento único do plano (R$34,90) via
 * Apple Pay / Google Pay. Devolve o client_secret pro front confirmar no próprio
 * checkout (sem redirect). A ativação real acontece no webhook do Stripe
 * (payment_intent.succeeded), nunca aqui — o cliente não deve "se ativar" sozinho.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`stripe-intent:${ip}`, { max: 8, windowMs: 60_000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Muitas tentativas. Aguarde 1 minuto.' }, { status: 429 });

  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: 'Pagamento indisponível no momento.' }, { status: 503 });

  let logEmail: string | null = null;
  let logSession: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    let email = typeof body.email === 'string' ? normalizeEmail(body.email).email : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.replace(/\D/g, '') : '';
    const cpf = typeof body.cpf === 'string' ? body.cpf.replace(/\D/g, '') : '';
    const sessionId = typeof body.session_id === 'string' ? body.session_id : '';
    logEmail = email || null;
    logSession = sessionId || null;

    if (!email || !isValidEmailFormat(email)) {
      return NextResponse.json({ error: 'E-mail inválido. Confira se digitou certo (ex.: nome@email.com).' }, { status: 400 });
    }
    if (!name) return NextResponse.json({ error: 'Informe seu nome.' }, { status: 400 });

    // Garante que o PERFIL existe ANTES do pagamento (o webhook ativa casando por
    // email). Mesmo padrão do PIX: cria a conta/perfil como 'pending' se ainda não
    // existir. Não ativa nada aqui — a ativação é só no webhook (payment succeeded).
    const quizAnswers = (body.quiz_answers && typeof body.quiz_answers === 'object') ? body.quiz_answers : {};
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
          phone: phone || extracted.phone || null,
          quiz_session_id: sessionId || null,
          subscription_type: 'none', subscription_status: 'pending',
          plan_status: 'pending_photo', checkout_session_id: sessionId || null,
        });
      } else if (existing.subscription_status !== 'active') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('profiles') as any)
          .update({ full_name: name, quiz_answers: quizAnswers, ...extracted, phone: phone || extracted.phone || null, quiz_session_id: sessionId || null, checkout_session_id: sessionId || null })
          .eq('email', email);
      }
    } catch (e) {
      // Falha ao pré-criar o perfil não deve travar o pagamento — o cron de
      // recuperação e o próprio webhook (que tenta por email) cobrem.
      console.error('[stripe intent] pre-perfil falhou', e);
    }

    // Pagamento único, à vista (Apple Pay não parcela).
    // O valor sai do cupom, no servidor, igual ao PIX e ao cartão. Sem isto a
    // carteira mostrava e cobrava R$34,90 mesmo com o desconto aplicado na
    // tela — prometer um preço e cobrar outro, agora dentro do Apple Pay.
    const { precoCents: amount } = await precoParaCobrar(body.cupom, PLAN_BASE_CENTS, email);

    const intent = await stripe.paymentIntents.create({
      amount,
      currency: 'brl',
      // 'card' cobre Apple Pay e Google Pay (wallets rodam sobre o método cartão).
      payment_method_types: ['card'],
      description: 'Plano Capilar Personalizado — Juliane Cost',
      receipt_email: email,
      metadata: {
        email,
        name: name.slice(0, 120),
        phone,
        cpf,
        session_id: sessionId,
        source: 'stripe_wallet', // apple_pay / google_pay
        product: 'plano_capilar',
      },
    });

    return NextResponse.json({
      ok: true,
      client_secret: intent.client_secret,
      publishable_key: process.env.STRIPE_PUBLISHABLE_KEY ?? '',
      amount,
    });
  } catch (err) {
    await logCheckoutError({
      route: 'checkout/stripe/intent', email: logEmail, session_id: logSession,
      payment_type: 'card', kind: 'exception', err,
    }).catch(() => {});
    return NextResponse.json({ error: 'Não consegui iniciar o pagamento. Tente de novo.' }, { status: 500 });
  }
}
