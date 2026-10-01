import { NextRequest, NextResponse, after } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveAuthUserId } from '@/lib/supabase/auth-resolve';
import { sendCapiEvent } from '@/lib/meta/capi';
import { getTrackingIdentity } from '@/lib/tracking-server';
import { notifyNewSale } from '@/lib/discord';
import { logCheckoutError } from '@/lib/checkout-log';
import { PLAN_BASE_CENTS } from '@/lib/pricing';

// Teste A/B checkout próprio × Hotmart — ver migration 037 e
// project_plano_da_ju_hotmart_ab. Mesmo padrão do webhook/pagarme: só ativa
// em evento de pagamento de verdade confirmado (nunca em assinatura criada).
const HANDLED_EVENTS = new Set([
  'PURCHASE_APPROVED',
  'PURCHASE_REFUNDED',
  'PURCHASE_CHARGEBACK',
  'PURCHASE_CANCELED',
  'PURCHASE_PROTEST',
]);

const CANCEL_EVENTS = new Set([
  'PURCHASE_REFUNDED',
  'PURCHASE_CHARGEBACK',
  'PURCHASE_CANCELED',
  'PURCHASE_PROTEST',
]);

function digitsOnly(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '');
}

export async function POST(req: NextRequest) {
  let logEmail: string | null = null;
  let logEventType: string | null = null;

  try {
    const rawBody = await req.text();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = JSON.parse(rawBody);

    // Hottok — a Hotmart manda tanto no header quanto no campo `hottok` do
    // corpo, dependendo da versão. Só rejeita se a env estiver setada
    // (permite ligar o webhook antes de configurar o secret, como no
    // pagarme).
    const expectedHottok = process.env.HOTMART_HOTTOK;
    if (expectedHottok) {
      const receivedHottok =
        req.headers.get('x-hotmart-hottok') ?? body.hottok ?? null;
      if (receivedHottok !== expectedHottok) {
        console.warn('[webhook/hotmart] hottok mismatch — request rejected');
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
      }
    } else {
      console.warn('[webhook/hotmart] HOTMART_HOTTOK not set — accepting unauthenticated requests (TEMPORARY)');
    }

    const eventType: string = body.event;
    logEventType = eventType;
    const data = body.data ?? {};
    logEmail = data.buyer?.email ?? null;

    if (!HANDLED_EVENTS.has(eventType)) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const supabase = await createServiceClient();

    // ── Reembolso / chargeback / cancelamento — rebaixa acesso ──────
    if (CANCEL_EVENTS.has(eventType)) {
      const transactionId: string | null = data.purchase?.transaction ?? null;
      const email: string | null = data.buyer?.email ?? null;
      if (transactionId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('profiles') as any)
          .update({ subscription_status: 'cancelled' })
          .eq('hotmart_transaction_id', transactionId);
      } else if (email) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('profiles') as any)
          .update({ subscription_status: 'cancelled' })
          .eq('email', email)
          .like('subscription_type', 'hotmart_%');
      }
      return NextResponse.json({ ok: true });
    }

    // ── PURCHASE_APPROVED — pagamento confirmado (PIX ou cartão) ────
    const buyer = data.buyer ?? {};
    const purchase = data.purchase ?? {};
    const email: string | undefined = buyer.email;
    if (!email) {
      return NextResponse.json({ ok: true, ignored: true, reason: 'no email' });
    }

    const name: string =
      buyer.name ??
      [buyer.first_name, buyer.last_name].filter(Boolean).join(' ') ??
      '';

    const phone = digitsOnly(`${buyer.checkout_phone_code ?? ''}${buyer.checkout_phone ?? ''}`);
    // checkout_phone já costuma vir sem o código do país nos campos acima;
    // se colar os dois e o resultado ficar maior que um celular BR com DDI,
    // usamos como está — nunca bloqueia a ativação por causa do telefone
    // (diferente do checkout próprio, aqui o pagamento JÁ foi aprovado).

    const paymentTypeRaw: string = purchase.payment?.type ?? 'PIX';
    const paymentMethod: 'card' | 'pix' = paymentTypeRaw === 'CREDIT_CARD' ? 'card' : 'pix';
    const subType = paymentMethod === 'card' ? 'hotmart_card' : 'hotmart_pix';

    const amountCents = Math.round(
      ((purchase.price?.value ?? purchase.full_price?.value ?? PLAN_BASE_CENTS / 100) as number) * 100,
    );
    const transactionId: string | null = purchase.transaction ?? null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase.from('profiles') as any)
      .select('id, subscription_status, checkout_session_id, full_name, phone')
      .eq('email', email)
      .maybeSingle();

    if (profile?.subscription_status === 'active') {
      // Já ativo — idempotente (a Hotmart pode reenviar o mesmo evento).
      return NextResponse.json({ ok: true, already_active: true });
    }

    const userId = profile?.id ?? (await resolveAuthUserId(supabase, email));

    // Linka com a sessão do quiz via wg_quiz_leads (email match) — mesmo
    // padrão do webhook/pagarme. É esse campo que o painel /experimentos usa
    // pra saber de qual lado do teste A/B (checkout próprio × Hotmart) essa
    // venda veio.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: leadMatch } = await (supabase.from('wg_quiz_leads') as any)
      .select('session_id')
      .ilike('email', email)
      .not('session_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const quizSessionId: string | null = leadMatch?.session_id ?? null;

    // Mesma ativação atômica do webhook/pagarme: só o request "vencedor"
    // transiciona o perfil de fora de 'active' para 'active'.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: activatedRows } = await (supabase.from('profiles') as any)
      .upsert({
        id: userId,
        email,
        full_name: name || profile?.full_name || null,
        phone: phone || profile?.phone || null,
        subscription_type: subType,
        subscription_status: 'active',
        subscription_activated_at: new Date().toISOString(),
        subscription_expires_at: new Date(
          Date.now() + 90 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        quiz_session_id: quizSessionId,
        hotmart_transaction_id: transactionId,
        plan_status: 'pending_photo',
        plan_requested_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      .select('id');
    const justActivated = Array.isArray(activatedRows) && activatedRows.length > 0;

    // Evento pro painel /checkout (mesma tabela que o checkout próprio usa)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('checkout_events') as any).insert({
      session_id: transactionId ?? email,
      event_type: 'payment_confirmed',
      email,
      payment_type: paymentMethod,
      amount_cents: amountCents,
      order_id: transactionId,
      metadata: { webhook_event: eventType, source: 'hotmart' },
    });

    if (justActivated) {
      const fullName = name.trim().split(/\s+/);
      const phoneE164 = phone.length === 10 || phone.length === 11 ? '55' + phone : (phone || undefined);

      const trk = await getTrackingIdentity(supabase, { sessionId: null, email });

      await sendCapiEvent({
        eventName: 'Purchase',
        eventId: transactionId ?? `hotmart_${email}`,
        eventSourceUrl: 'https://hotmart.com',
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
          value: amountCents / 100,
          currency: 'BRL',
          content_name: 'Plano Capilar Personalizado (Hotmart)',
          order_id: transactionId ?? undefined,
        },
      });

      after(() => notifyNewSale({
        customerName: name || null,
        email,
        hairType: null,
        porosity: null,
        mainProblem: null,
        paymentMethod,
        amountCents,
      }).catch(err => console.error('[discord notify hotmart]', err)));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[webhook/hotmart]', err);
    await logCheckoutError({
      route: 'webhook/hotmart',
      email: logEmail,
      err,
      context: { webhook_event: logEventType },
    });
    return NextResponse.json({ ok: true }); // sempre 200 pra Hotmart não retentar
  }
}
