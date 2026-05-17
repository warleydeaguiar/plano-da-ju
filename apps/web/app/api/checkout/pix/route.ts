import { NextRequest, NextResponse } from 'next/server';
import { pagarme } from '@/lib/pagarme/client';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveAuthUserId } from '@/lib/supabase/auth-resolve';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import type { PagarMeOrder } from '@/lib/pagarme/types';

const PRICE_CENTS = 3490; // R$34,90

export async function POST(req: NextRequest) {
  // ── Rate limit: máx 5 PIX por IP em 1 min ───────────────────
  const ip = getClientIp(req);
  const rl = checkRateLimit(`pix:${ip}`, { max: 5, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Aguarde 1 minuto.' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  try {
    const { name, email, cpf, phone, quiz_answers, session_id } = await req.json();

    if (!name || !email) {
      return NextResponse.json({ error: 'Nome e e-mail são obrigatórios' }, { status: 400 });
    }

    const cleanCpf = (cpf ?? '').replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      return NextResponse.json({ error: 'CPF inválido — obrigatório para pagamento via PIX' }, { status: 400 });
    }

    // Telefone: DDD (2 dígitos) + número (8-9 dígitos)
    const cleanPhone = (phone ?? '').replace(/\D/g, '');
    const areaCode = cleanPhone.length >= 10 ? cleanPhone.slice(0, 2) : '11';
    const phoneNumber = cleanPhone.length >= 10 ? cleanPhone.slice(2) : '999999999';

    const supabase = await createServiceClient();

    // ── Idempotência: se já existe PIX pendente recente, reusa ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase.from('profiles') as any)
      .select('pagarme_pix_order_id, subscription_status')
      .eq('email', email)
      .maybeSingle();

    if (existing?.pagarme_pix_order_id && existing.subscription_status === 'pending') {
      try {
        const reused = await pagarme.get<PagarMeOrder & { status: string }>(
          `/orders/${existing.pagarme_pix_order_id}`,
        );
        // Reusa se ainda está pendente (não foi pago nem expirou)
        if (reused.status === 'pending' || reused.status === 'waiting_payment') {
          const charge = reused.charges?.[0];
          const pixData = charge?.last_transaction;
          if (pixData?.qr_code) {
            return NextResponse.json({
              order_id: reused.id,
              pix_qr_code: pixData.qr_code,
              pix_qr_code_url: pixData.qr_code_url,
              expires_at: pixData.expires_at,
              amount: PRICE_CENTS,
              reused: true,
            });
          }
        }
      } catch {
        // Se falhar ao reusar, cria novo PIX
      }
    }

    // ── Cria nova ordem PIX ─────────────────────────────────────
    const order = await pagarme.post<PagarMeOrder>('/orders', {
      customer: {
        name,
        email,
        type: 'individual',
        document: cleanCpf,
        document_type: 'CPF',
        phones: {
          mobile_phone: {
            country_code: '55',
            area_code: areaCode,
            number: phoneNumber,
          },
        },
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
            expires_in: 3600,
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

    // Upsert do perfil (cria se não existir, atualiza se existir)
    if (!existing) {
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('profiles') as any)
        .update({
          full_name: name,
          quiz_answers,
          pagarme_pix_order_id: order.id,
          checkout_session_id: session_id ?? null,
        })
        .eq('email', email);
    }

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
