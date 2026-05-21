import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendCapiEvent } from '@/lib/meta/capi';
import { notifyNewSale } from '@/lib/discord';

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
  try {
    const body = await req.json();
    const eventType: string = body.type;

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
          .select('id, subscription_status, checkout_session_id, full_name, quiz_answers, hair_type, porosity, main_problems')
          .eq('email', email)
          .maybeSingle();

        if (profile?.subscription_status === 'active') {
          // Já ativo — idempotente
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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('profiles') as any)
          .update({
            subscription_type: subType,
            subscription_status: 'active',
            subscription_activated_at: new Date().toISOString(),
            quiz_session_id: quizSessionId,
            subscription_expires_at: new Date(
              Date.now() + 365 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            pagarme_charge_id: data.charges?.[0]?.id ?? data.id ?? null,
            plan_status: 'pending_photo',
            plan_requested_at: new Date().toISOString(),
          })
          .eq('email', email);

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

        if (!existingEvent) {
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

        await sendCapiEvent({
          eventName: 'Purchase',
          eventId: data.id, // dedup
          user: {
            email,
            phone: phoneE164,
            firstName: fullName[0],
            lastName: fullName.slice(1).join(' ') || undefined,
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
        break;
      }

      // ── Renovação ─────────────────────────────────────────────
      case 'subscription.renewed': {
        const sub = body.data;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('profiles') as any)
          .update({
            subscription_status: 'active',
            subscription_expires_at: sub.current_cycle?.end_at ?? null,
          })
          .eq('pagarme_subscription_id', sub.id);
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
    return NextResponse.json({ ok: true }); // sempre 200 para PagarMe não retentar
  }
}
