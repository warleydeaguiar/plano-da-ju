import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendCapiEvent } from '@/lib/meta/capi';
import { getTrackingIdentity } from '@/lib/tracking-server';
import { notifyNewSale } from '@/lib/discord';
import { logCheckoutError } from '@/lib/checkout-log';

// Eventos do PagarMe que tratamos
// IMPORTANTE: NÃO ativar perfil em 'subscription.created' — esse evento dispara
// quando a assinatura é criada, ANTES da primeira cobrança ser aprovada.
// Só ativamos em 'charge.paid' / 'order.paid' (pagamento real confirmado).
const HANDLED_EVENTS = new Set([
  'order.paid',
  'charge.paid',
  'subscription.renewed',
  'subscription.canceled',
  'charge.payment_failed',
]);

export async function POST(req: NextRequest) {
  let logEventType: string | null = null;
  let logEmail: string | null = null;
  try {
    // Basic Auth — só rejeita se env vars estiverem setadas (permite deploy gradual)
    const expectedUser = process.env.PAGARME_WEBHOOK_USER;
    const expectedPass = process.env.PAGARME_WEBHOOK_PASS;
    if (expectedUser && expectedPass) {
      const auth = req.headers.get('authorization') ?? '';
      const expected = 'Basic ' + Buffer.from(`${expectedUser}:${expectedPass}`).toString('base64');
      if (auth !== expected) {
        console.warn('[webhook/pagarme] basic auth mismatch — request rejected');
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
      }
    } else {
      console.warn('[webhook/pagarme] PAGARME_WEBHOOK_USER/PASS not set — accepting unauthenticated requests (TEMPORARY)');
    }

    const body = await req.json();
    const eventType: string = body.type;
    logEventType = eventType;
    logEmail = body.data?.customer?.email ?? null;

    if (!HANDLED_EVENTS.has(eventType)) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const supabase = await createServiceClient();

    switch (eventType) {
      // ── Pagamento confirmado (PIX ou cartão) ──────────────────
      case 'order.paid':
      case 'charge.paid': {
        const data = body.data;
        const email = data.customer?.email;
        if (!email) break;

        // Busca perfil atual
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: profile } = await (supabase.from('profiles') as any)
          .select('id, subscription_status, checkout_session_id, full_name, phone, quiz_answers, hair_type, porosity, main_problems, pagarme_subscription_id')
          .eq('email', email)
          .maybeSingle();

        if (profile?.subscription_status === 'active') {
          // Já ativo — idempotente, mas ainda salva o subscriptionId se ainda não foi gravado
          const subscriptionIdIdem: string | null =
            (data as any).subscription?.id ??
            (data as any).subscription_id ??
            (data as any).invoice?.subscription_id ??
            (data as any).invoice?.subscription?.id ??
            null;
          if (subscriptionIdIdem && !profile?.pagarme_subscription_id) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from('profiles') as any)
              .update({ pagarme_subscription_id: subscriptionIdIdem })
              .eq('email', email);
          }
          break;
        }

        const paymentMethod = data.charges?.[0]?.payment_method ?? data.payment_method ?? 'pix';
        const subType = paymentMethod === 'credit_card' ? 'annual_card' : 'annual_pix';

        // Tenta linkar com a sessão do quiz via wg_quiz_leads (email match)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: leadMatch } = await (supabase.from('wg_quiz_leads') as any)
          .select('session_id')
          .ilike('email', email)
          .not('session_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        const quizSessionId: string | null = leadMatch?.session_id ?? null;

        const subscriptionId: string | null =
          (data as any).subscription?.id ??
          (data as any).subscription_id ??
          (data as any).invoice?.subscription_id ??
          (data as any).invoice?.subscription?.id ??
          null;

        // Ativação ATÔMICA + à prova de corrida: o PagarMe dispara order.paid E
        // charge.paid pra mesma venda (às vezes no mesmo segundo). A guarda
        // `subscription_status != 'active'` (incluindo NULL) garante que só UM
        // dos eventos realmente transiciona o perfil — o UPDATE concorrente
        // espera o lock, re-avalia o WHERE já com status='active' e afeta 0 linhas.
        // Só esse evento "vencedor" dispara Discord/CAPI → sem duplicatas.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: activatedRows } = await (supabase.from('profiles') as any)
          .update({
            subscription_type: subType,
            subscription_status: 'active',
            subscription_activated_at: new Date().toISOString(),
            quiz_session_id: quizSessionId,
            subscription_expires_at: new Date(
              Date.now() + 90 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            pagarme_charge_id: data.charges?.[0]?.id ?? data.id ?? null,
            ...(subscriptionId ? { pagarme_subscription_id: subscriptionId } : {}),
            plan_status: 'pending_photo',
            plan_requested_at: new Date().toISOString(),
          })
          .eq('email', email)
          .or('subscription_status.is.null,subscription_status.neq.active')
          .select('id');
        const justActivated = Array.isArray(activatedRows) && activatedRows.length > 0;

        // Idempotência: PagarMe dispara order.paid + charge.paid pra mesma
        // venda. Antes gravávamos 2 events 'payment_confirmed' por session
        // → inflava /checkout (3 vendas quando era 1). Agora só grava o
        // primeiro que chega; o segundo é silenciosamente ignorado.
        const sessionKey = profile?.checkout_session_id ?? data.id ?? email;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existingEvent } = await (supabase.from('checkout_events') as any)
          .select('id')
          .eq('session_id', sessionKey)
          .eq('event_type', 'payment_confirmed')
          .limit(1)
          .maybeSingle();

        // Só grava no evento que REALMENTE ativou o perfil (justActivated é
        // atômico — exatamente 1 dos eventos order.paid/charge.paid vence).
        // Antes o dedup por session_id falhava quando checkout_session_id era
        // nulo (caía em data.id, que difere entre order.paid=or_ e charge.paid=ch_)
        // → 2 payment_confirmed por venda, inflando "PIX pagos" e a conversão.
        if (justActivated && !existingEvent) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('checkout_events') as any).insert({
            session_id: sessionKey,
            event_type: 'payment_confirmed',
            email,
            payment_type: subType === 'annual_card' ? 'card' : 'pix',
            amount_cents: data.amount ?? 3490,
            order_id: data.id,
            metadata: { webhook_event: eventType },
          });
        }

        // Meta CAPI — Purchase server-side
        const ans = (profile?.quiz_answers ?? {}) as Record<string, unknown>;
        // Phone: da coluna profile (já salvo no checkout) ou fallback pelo quiz_answers
        const phoneDigits = String(profile?.phone ?? ans.phone ?? '').replace(/\D/g, '');
        const phoneE164 = phoneDigits.length === 10 || phoneDigits.length === 11
          ? '55' + phoneDigits : phoneDigits || undefined;

        // Garante que phone ficou salvo no profile (segurança para compras antigas)
        if (phoneDigits && !profile?.phone) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('profiles') as any)
            .update({ phone: phoneDigits })
            .eq('email', email);
        }
        const fullName = String(ans.name ?? profile?.full_name ?? '').trim().split(/\s+/);

        // Etapa 3 — Advanced Matching completo: o webhook roda sem navegador,
        // então buscamos fbp/fbc/ip/user_agent/zip/cpf da identidade persistida
        // (por checkout_session_id, com fallback de re-hidratação por email).
        const trk = await getTrackingIdentity(supabase, {
          sessionId: profile?.checkout_session_id,
          email,
        });

        // Purchase (CAPI) + Discord disparam SÓ no evento que ativou o perfil —
        // evita Purchase duplicado no Meta e notificação repetida no Discord.
        if (justActivated) {
        await sendCapiEvent({
          eventName: 'Purchase',
          eventId: data.id, // dedup
          eventSourceUrl: 'https://planodaju.julianecost.com/oferta',
          user: {
            email,
            phone: phoneE164,
            firstName: fullName[0],
            lastName: fullName.slice(1).join(' ') || undefined,
            fbp: trk.fbp,
            fbc: trk.fbc,
            ip: trk.ip,
            userAgent: trk.userAgent,
            zip: trk.zip,
            cpf: trk.cpf,
          },
          customData: {
            value: (data.amount ?? 3490) / 100,
            currency: 'BRL',
            content_name: 'Plano Capilar Personalizado',
            order_id: data.id,
          },
        });

        // Discord notification for Juliane (fire-and-forget)
        notifyNewSale({
          customerName: (ans.name as string) ?? profile?.full_name ?? null,
          email,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          hairType: profile?.hair_type ?? (ans.hair_type as string) ?? null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          porosity: profile?.porosity ?? (ans.porosity as string) ?? null,
          mainProblem:
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (profile?.main_problems as string[] | null)?.[0]
            ?? (Array.isArray(ans.main_problems) ? (ans.main_problems as string[])[0] : null)
            ?? (ans.objetivo as string)
            ?? null,
          paymentMethod: subType === 'annual_card' ? 'card' : 'pix',
          amountCents: data.amount ?? 3490,
        }).catch(err => console.error('[discord notify]', err));
        } // fim if (justActivated)

        break;
      }

      // ── Cobrança recusada — log para análise ──────────────────
      case 'charge.payment_failed': {
        const data = body.data;
        const email = data.customer?.email;
        if (!email) break;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: profile } = await (supabase.from('profiles') as any)
          .select('checkout_session_id')
          .eq('email', email)
          .maybeSingle();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('checkout_events') as any).insert({
          session_id: profile?.checkout_session_id ?? data.id ?? email,
          event_type: 'payment_failed',
          email,
          payment_type: 'card',
          order_id: data.id,
          metadata: {
            failure_message: data.last_transaction?.gateway_response?.errors?.[0]?.message
              ?? data.last_transaction?.acquirer_message
              ?? 'unknown',
          },
        });

        // Se o charge é de uma subscription (renovação falhou), rebaixar status
        const subId =
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (data as any).subscription?.id ??
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (data as any).subscription_id ??
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (data as any).invoice?.subscription_id ??
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (data as any).invoice?.subscription?.id ??
          null;
        if (subId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('profiles') as any)
            .update({ subscription_status: 'past_due' })
            .eq('pagarme_subscription_id', subId)
            .eq('subscription_status', 'active');
        }
        break;
      }

      // ── Renovação ─────────────────────────────────────────────
      case 'subscription.renewed': {
        const sub = body.data;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: renewed, error: renewErr } = await (supabase.from('profiles') as any)
          .update({
            subscription_status: 'active',
            subscription_expires_at: sub.current_cycle?.end_at
              ?? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq('pagarme_subscription_id', sub.id)
          .neq('subscription_status', 'cancelled')
          .neq('subscription_status', 'refunded')
          .select('id');
        if (renewErr) console.error('[webhook subscription.renewed]', renewErr);
        if (!renewed || renewed.length === 0) {
          console.warn(`[webhook subscription.renewed] no profile found (or cancelled/refunded) for pagarme_subscription_id=${sub.id}`);
        }
        break;
      }

      // ── Cancelamento ──────────────────────────────────────────
      case 'subscription.canceled': {
        const sub = body.data;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('profiles') as any)
          .update({ subscription_status: 'cancelled' })
          .eq('pagarme_subscription_id', sub.id);
        break;
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[webhook/pagarme]', err);
    // CRÍTICO: erro aqui pode significar pagamento recebido mas perfil não ativado.
    await logCheckoutError({
      route: 'webhook/pagarme',
      email: logEmail,
      err,
      context: { webhook_event: logEventType },
    });
    return NextResponse.json({ ok: true }); // sempre 200 para PagarMe não retentar
  }
}
