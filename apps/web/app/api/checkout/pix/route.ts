import { NextRequest, NextResponse } from 'next/server';
import { pagarme } from '@/lib/pagarme/client';
import { createServiceClient } from '@/lib/supabase/server';
import type { PagarMeOrder } from '@/lib/pagarme/types';

export async function POST(req: NextRequest) {
  try {
    const { name, email, quiz_answers } = await req.json();

    if (!name || !email) {
      return NextResponse.json({ error: 'Nome e e-mail são obrigatórios' }, { status: 400 });
    }

    // Create PIX order in PagarMe (R$49,90 — pagamento único)
    const order = await pagarme.post<PagarMeOrder>('/orders', {
      customer: {
        name,
        email,
        type: 'individual',
      },
      items: [
        {
          amount: 4990, // R$49,90 em centavos
          description: 'Plano da Ju — Acesso Anual (PIX)',
          quantity: 1,
          code: 'plano-da-ju-anual-pix',
        },
      ],
      payments: [
        {
          payment_method: 'pix',
          pix: {
            expires_in: 3600, // 1 hora
            additional_information: [{ name: 'Produto', value: 'Plano da Ju Anual' }],
          },
        },
      ],
      metadata: { source: 'plano-da-ju-web', payment_type: 'pix' },
    });

    const charge = order.charges?.[0];
    const pixData = charge?.last_transaction;

    if (!pixData?.qr_code) {
      throw new Error('QR Code PIX não retornado pelo PagarMe');
    }

    // Registrar intenção de compra no Supabase (sem assinatura ativa ainda)
    const supabase = await createServiceClient();
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (!existingUser) {
      // Usuária não tem conta — salvar lead com quiz_answers para criar conta no webhook
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('profiles') as any).upsert({
        id: crypto.randomUUID(),
        email,
        full_name: name,
        quiz_answers,
        subscription_type: 'none',
        subscription_status: 'pending',
        plan_status: 'pending_photo',
      });
    }

    return NextResponse.json({
      order_id: order.id,
      pix_qr_code: pixData.qr_code,
      pix_qr_code_url: pixData.qr_code_url,
      expires_at: pixData.expires_at,
      amount: 4990,
    });
  } catch (err) {
    console.error('[checkout/pix]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao gerar PIX' },
      { status: 500 },
    );
  }
}
