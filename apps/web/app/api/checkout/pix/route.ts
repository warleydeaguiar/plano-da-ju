import { NextRequest, NextResponse } from 'next/server';
import { pagarme } from '@/lib/pagarme/client';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveAuthUserId } from '@/lib/supabase/auth-resolve';
import type { PagarMeOrder } from '@/lib/pagarme/types';

const PRICE_CENTS = 3490; // R$34,90

export async function POST(req: NextRequest) {
  try {
    const { name, email, cpf, quiz_answers, session_id } = await req.json();

    if (!name || !email) {
      return NextResponse.json({ error: 'Nome e e-mail são obrigatórios' }, { status: 400 });
    }

    const cleanCpf = (cpf ?? '').replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      return NextResponse.json({ error: 'CPF inválido — obrigatório para pagamento via PIX' }, { status: 400 });
    }

    // Create PIX order in PagarMe
    const order = await pagarme.post<PagarMeOrder>('/orders', {
      customer: {
        name,
        email,
        type: 'individual',
        document: cleanCpf,
        document_type: 'CPF',
      },
      items: [
        {
          amount: PRICE_CENTS,
          description: 'Plano da Ju — Plano Capilar Personalizado',
          quantity: 1,
          code: 'plano-da-ju-pix',
        },
      ],
      payments: [
        {
          payment_method: 'pix',
          pix: {
            expires_in: 3600, // 1 hora
            additional_information: [{ name: 'Produto', value: 'Plano da Ju' }],
          },
        },
      ],
      metadata: { source: 'plano-da-ju-web', payment_type: 'pix', session_id: session_id ?? '' },
    });

    const charge = order.charges?.[0];
    const pixData = charge?.last_transaction;

    if (!pixData?.qr_code) {
      throw new Error('QR Code PIX não retornado pelo PagarMe');
    }

    const supabase = await createServiceClient();

    // Criar/atualizar perfil com status pending e salvar o order_id do PIX
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (!existingUser) {
      const userId = await resolveAuthUserId(supabase, email);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('profiles') as any).upsert({
        id: userId,
        email,
        full_name: name,
        quiz_answers,
        subscription_type: 'none',
        subscription_status: 'pending',
        plan_status: 'pending_photo',
        pagarme_pix_order_id: order.id,
        checkout_session_id: session_id ?? null,
      });
    } else {
      // Atualiza o order_id do PIX no perfil existente
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('profiles') as any)
        .update({ pagarme_pix_order_id: order.id, checkout_session_id: session_id ?? null })
        .eq('email', email);
    }

    // Log checkout event
    if (session_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('checkout_events') as any).insert({
        session_id,
        event_type: 'pix_generated',
        email,
        payment_type: 'pix',
        amount_cents: PRICE_CENTS,
        order_id: order.id,
      });
    }

    return NextResponse.json({
      order_id: order.id,
      pix_qr_code: pixData.qr_code,
      pix_qr_code_url: pixData.qr_code_url,
      expires_at: pixData.expires_at,
      amount: PRICE_CENTS,
    });
  } catch (err) {
    console.error('[checkout/pix]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao gerar PIX' },
      { status: 500 },
    );
  }
}
