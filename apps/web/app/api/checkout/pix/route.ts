import { NextRequest, NextResponse } from 'next/server';
import { pagarme } from '@/lib/pagarme/client';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveAuthUserId } from '@/lib/supabase/auth-resolve';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { extractFieldsFromQuiz } from '@/lib/quiz-to-profile';
import type { PagarMeOrder } from '@/lib/pagarme/types';
import { logCheckoutError } from '@/lib/checkout-log';
import { normalizeEmail, isValidEmailFormat } from '@/lib/normalize-email';

const PRICE_CENTS = 3490; // R$34,90

export const runtime = 'nodejs';
// Headroom pro retry do QR (a PagarMe às vezes demora pra popular o copia-e-cola).
export const maxDuration = 30;

// Busca a ordem algumas vezes até o PIX (qr_code) ficar pronto. Backoff crescente
// ~8s no total (PagarMe normalmente popula em <1s, mas às vezes atrasa). Retorna o
// last_transaction quando o qr_code aparecer, ou o último estado se não vier.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function waitForQrCode(orderId: string, current: any): Promise<any> {
  let pixData = current;
  const delays = [500, 700, 900, 1100, 1300, 1600, 2000]; // ~8.1s total
  for (let i = 0; i < delays.length && !pixData?.qr_code; i++) {
    await new Promise(r => setTimeout(r, delays[i]));
    try {
      const refreshed = await pagarme.get<PagarMeOrder>(`/orders/${orderId}`);
      pixData = refreshed.charges?.[0]?.last_transaction;
    } catch { /* tenta de novo no próximo loop */ }
  }
  return pixData;
}

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

  let logEmail: string | null = null;
  let logSession: string | null = null;

  try {
    const body = await req.json();
    // Corrige typos óbvios do e-mail (vírgula, gmail.con, .co.br…) em vez de bloquear.
    if (body && typeof body.email === 'string') body.email = normalizeEmail(body.email).email;
    const { name, email, cpf, phone, quiz_answers, session_id } = body;
    logEmail = email ?? null;
    logSession = typeof session_id === 'string' ? session_id : null;

    if (!name || !email) {
      return NextResponse.json({ error: 'Nome e e-mail são obrigatórios' }, { status: 400 });
    }

    // Fallback: se mesmo após a autocorreção o formato continua impossível.
    if (!isValidEmailFormat(email)) {
      return NextResponse.json(
        { error: 'E-mail inválido. Confira se digitou certo (ex.: nome@email.com).' },
        { status: 400 },
      );
    }

    const cleanCpf = (cpf ?? '').replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      return NextResponse.json({ error: 'CPF inválido — obrigatório para pagamento via PIX' }, { status: 400 });
    }

    // Telefone: prefere form, fallback quiz_answers (coletado no quiz)
    const rawPhone = phone ?? (quiz_answers as Record<string, unknown>)?.phone
                           ?? (quiz_answers as Record<string, unknown>)?.telefone ?? '';
    const cleanPhone = String(rawPhone).replace(/\D/g, '');
    const areaCode = cleanPhone.length >= 10 ? cleanPhone.slice(0, 2) : '';
    const phoneNumber = cleanPhone.length >= 10 ? cleanPhone.slice(2) : '';

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
          let pixData = reused.charges?.[0]?.last_transaction;
          // Se a ordem reusada ainda não tem QR, espera ele aparecer (não cria
          // uma 2ª ordem órfã sem copia-e-cola — era o que travava a cliente).
          if (!pixData?.qr_code) pixData = await waitForQrCode(reused.id, pixData);
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
        ...(areaCode && phoneNumber ? {
          phones: {
            mobile_phone: { country_code: '55', area_code: areaCode, number: phoneNumber },
          },
        } : {}),
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

    let pixData = order.charges?.[0]?.last_transaction;

    // A PagarMe às vezes cria a ordem mas ainda NÃO populou o qr_code na
    // resposta imediata (transação processando). Buscamos a ordem algumas vezes
    // (~até 8s) até o PIX ficar pronto antes de desistir.
    if (!pixData?.qr_code) {
      pixData = await waitForQrCode(order.id, pixData);
    }

    if (!pixData?.qr_code) {
      throw new Error('QR Code PIX não retornado pelo PagarMe');
    }

    // Extrai campos do quiz pras colunas individuais (hair_type, porosity, etc.)
    const extracted = extractFieldsFromQuiz(quiz_answers);

    // phone: prefere o que veio do form (cleanPhone), fallback pro quiz_answers
    const profilePhone = cleanPhone || extracted.phone || null;

    // Upsert do perfil (cria se não existir, atualiza se existir)
    if (!existing) {
      const userId = await resolveAuthUserId(supabase, email);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('profiles') as any).upsert({
        id: userId,
        email,
        full_name: name,
        quiz_answers,
        ...extracted,
        phone: profilePhone,
        quiz_session_id: typeof session_id === 'string' ? session_id : null,
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
          ...extracted,
          phone: profilePhone,
          quiz_session_id: typeof session_id === 'string' ? session_id : null,
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
    await logCheckoutError({
      route: 'checkout/pix',
      email: logEmail,
      payment_type: 'pix',
      session_id: logSession,
      err,
    });
    // Mensagem amigável quando foi instabilidade na geração do PIX (QR não
    // veio / 5xx da PagarMe) — em vez do erro técnico cru.
    const raw = err instanceof Error ? err.message : '';
    const friendly = /qr code|504|502|timeout|gateway/i.test(raw)
      ? 'Tivemos uma instabilidade ao gerar o PIX agora. Tente de novo em alguns segundos — ou pague no cartão (aprovação na hora). 💛'
      : (raw || 'Erro ao gerar PIX');
    return NextResponse.json({ error: friendly }, { status: 500 });
  }
}
