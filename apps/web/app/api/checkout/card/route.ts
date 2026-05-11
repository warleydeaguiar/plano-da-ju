import { NextRequest, NextResponse } from 'next/server';
import { pagarme } from '@/lib/pagarme/client';
import { getOrCreateCardPlan } from '@/lib/pagarme/plans';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveAuthUserId } from '@/lib/supabase/auth-resolve';
import type { PagarMeSubscription } from '@/lib/pagarme/types';

export async function POST(req: NextRequest) {
  try {
    const { name, email, cpf, card_token, quiz_answers } = await req.json();

    if (!name || !email || !card_token) {
      return NextResponse.json(
        { error: 'Nome, e-mail e token do cartão são obrigatórios' },
        { status: 400 },
      );
    }

    const cleanCpf = typeof cpf === 'string' ? cpf.replace(/\D/g, '') : '';

    const plan = await getOrCreateCardPlan();

    const subscription = await pagarme.post<PagarMeSubscription>('/subscriptions', {
      plan_id: plan.id,
      customer: {
        name,
        email,
        type: 'individual',
        ...(cleanCpf.length === 11
          ? { document: cleanCpf, document_type: 'CPF' }
          : {}),
      },
      payment_method: 'credit_card',
      card_token,
      metadata: { source: 'plano-da-ju-web', payment_type: 'card' },
    });

    // Atualizar/criar perfil no Supabase com dados da assinatura.
    // Garantimos um auth.users.id antes de inserir em profiles (FK constraint).
    const supabase = await createServiceClient();
    const userId = await resolveAuthUserId(supabase, email);

    const expiresAt = subscription.current_cycle?.billing_at
      ? new Date(subscription.current_cycle.billing_at)
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('profiles') as any).upsert({
      id: userId,
      email,
      full_name: name,
      quiz_answers,
      subscription_type: 'annual_card',
      subscription_status: subscription.status === 'active' ? 'active' : 'pending',
      subscription_expires_at: expiresAt.toISOString(),
      pagarme_subscription_id: subscription.id,
      plan_status: 'pending_photo',
      plan_requested_at: new Date().toISOString(),
    });

    return NextResponse.json({
      subscription_id: subscription.id,
      status: subscription.status,
      redirect_url: '/obrigado',
    });
  } catch (err) {
    console.error('[checkout/card]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao processar cartão' },
      { status: 500 },
    );
  }
}
