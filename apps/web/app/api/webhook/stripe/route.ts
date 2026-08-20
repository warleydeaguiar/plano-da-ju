import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe/client';
import { createServiceClient } from '@/lib/supabase/server';
import { sendCapiEvent } from '@/lib/meta/capi';
import { PLAN_BASE_CENTS } from '@/lib/pricing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/webhook/stripe
 * Recebe eventos do Stripe. Só agimos em `payment_intent.succeeded` (Apple Pay /
 * Google Pay confirmados). A ativação espelha o webhook da PagarMe: UPDATE atômico
 * guardado por subscription_status != 'active' (idempotente / à prova de corrida),
 * registra o faturamento em checkout_events e dispara o Purchase (Meta CAPI).
 * Assinatura verificada com STRIPE_WEBHOOK_SECRET — nunca confiar no corpo cru.
 */
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return NextResponse.json({ error: 'stripe_not_configured' }, { status: 503 });

  const sig = req.headers.get('stripe-signature') ?? '';
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    console.error('[stripe webhook] assinatura inválida', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }

  // payment_intent.succeeded → wallets (Apple/Google Pay) do funil BR
  // checkout.session.completed → Stripe Checkout do funil EUA (US$)
  const HANDLED = ['payment_intent.succeeded', 'checkout.session.completed'];
  if (!HANDLED.includes(event.type)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    // Normaliza os dois formatos num só conjunto de campos.
    let md: Record<string, string> = {};
    let email = '';
    let paidCents = 0;
    let refId = '';
    let currency = 'brl';
    if (event.type === 'checkout.session.completed') {
      const cs = event.data.object as Stripe.Checkout.Session;
      if (cs.payment_status !== 'paid') return NextResponse.json({ ok: true, not_paid: true });
      md = (cs.metadata ?? {}) as Record<string, string>;
      email = (md.email ?? cs.customer_email ?? cs.customer_details?.email ?? '').toLowerCase().trim();
      paidCents = cs.amount_total ?? 0;
      currency = cs.currency ?? 'usd';
      refId = cs.id;
    } else {
      const pi = event.data.object as Stripe.PaymentIntent;
      md = (pi.metadata ?? {}) as Record<string, string>;
      email = (md.email ?? pi.receipt_email ?? '').toLowerCase().trim();
      paidCents = pi.amount_received || pi.amount || PLAN_BASE_CENTS;
      currency = pi.currency ?? 'brl';
      refId = pi.id;
    }
    if (!email) return NextResponse.json({ ok: true, no_email: true });

    const supabase = await createServiceClient();

    // Perfil atual (idempotência de alto nível: já ativo → não refaz).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase.from('profiles') as any)
      .select('id, subscription_status, full_name, phone, quiz_answers')
      .eq('email', email)
      .maybeSingle();
    if (!profile) return NextResponse.json({ ok: true, no_profile: true });
    if (profile.subscription_status === 'active') return NextResponse.json({ ok: true, already_active: true });

    // Linka com a sessão do quiz (mesmo critério do PagarMe).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: leadMatch } = await (supabase.from('wg_quiz_leads') as any)
      .select('session_id').ilike('email', email).not('session_id', 'is', null)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    const quizSessionId: string | null = leadMatch?.session_id ?? md.session_id ?? null;

    // Ativação ATÔMICA — só o "vencedor" (status ainda não 'active') transiciona.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: activatedRows } = await (supabase.from('profiles') as any)
      .update({
        subscription_type: 'annual_card',       // Apple/Google Pay rodam sobre cartão
        subscription_status: 'active',
        subscription_activated_at: new Date().toISOString(),
        quiz_session_id: quizSessionId,
        subscription_expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        plan_status: 'pending_photo',
        plan_requested_at: new Date().toISOString(),
      })
      .eq('email', email)
      .or('subscription_status.is.null,subscription_status.neq.active')
      .select('id');
    const justActivated = Array.isArray(activatedRows) && activatedRows.length > 0;
    if (!justActivated) return NextResponse.json({ ok: true, race_lost: true });

    // Faturamento — 1 evento por venda (idempotente por order_id = payment_intent).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingEvent } = await (supabase.from('checkout_events') as any)
      .select('id').eq('order_id', refId).eq('event_type', 'payment_confirmed').maybeSingle();
    if (!existingEvent) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('checkout_events') as any).insert({
        session_id: quizSessionId ?? md.session_id ?? `stripe-${refId}`,
        event_type: 'payment_confirmed',
        email,
        payment_type: 'card',
        amount_cents: paidCents,
        order_id: refId,
        metadata: { gateway: 'stripe', source: md.source ?? 'stripe_wallet', market: md.market ?? 'br', currency },
      });
    }

    // Meta CAPI — Purchase server-side (dedup pelo id do PaymentIntent).
    const phoneDigits = String(md.phone ?? profile.phone ?? '').replace(/\D/g, '');
    const phoneE164 = phoneDigits.length === 10 || phoneDigits.length === 11 ? '55' + phoneDigits : phoneDigits || undefined;
    try {
      await sendCapiEvent({
        eventName: 'Purchase',
        eventId: refId,
        eventSourceUrl: 'https://planodaju.julianecost.com/oferta',
        user: { email, phone: phoneE164, cpf: String(md.cpf ?? '').replace(/\D/g, '') || undefined },
        customData: { value: paidCents / 100, currency: currency.toUpperCase(), content_name: 'Plano Capilar' },
      });
    } catch (e) {
      console.error('[stripe webhook] CAPI Purchase falhou', e);
    }

    return NextResponse.json({ ok: true, activated: true });
  } catch (err) {
    console.error('[stripe webhook] erro', err);
    // 200 pra não entrar em loop de retry infinito do Stripe por erro nosso não-crítico;
    // o cron de recuperação de planos cobre ativações que não completaram.
    return NextResponse.json({ ok: false, handled_error: true });
  }
}
