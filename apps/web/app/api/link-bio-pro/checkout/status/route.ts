import { NextRequest, NextResponse } from 'next/server';
import { pagarme } from '@/lib/pagarme/client';
import { createServiceClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { logCheckoutError } from '@/lib/checkout-log';
import { PagarMeError } from '@/lib/pagarme/client';
import { marcarPedidoPago, sessionIdValido } from '@/lib/bio-pro';

/**
 * GET /api/link-bio-pro/checkout/status?order_id=or_xxx&session_id=yyy
 *
 * Consulta da tela (PIX esperando pagamento, cartão em análise). Confere a
 * posse pelo `session_id` gravado no metadata da order — antes conferia pelo
 * e-mail, e quando o servidor corrigia um typo ("gmail.con") a consulta dava
 * 403 pra sempre e a página nunca avançava mesmo com o PIX pago.
 */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`bio-pro-status:${ip}`, { max: 120, windowMs: 60_000 }).allowed) {
    return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('order_id') ?? '';
  const sessionId = searchParams.get('session_id');
  if (!/^or_[A-Za-z0-9]+$/.test(orderId) || !sessionIdValido(sessionId)) {
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
  }

  try {
    const order = await pagarme.get<{
      id: string;
      status: string;
      metadata?: { session_id?: string };
      charges?: { id: string; status: string; last_transaction?: { qr_code?: string; qr_code_url?: string; expires_at?: string; status?: string } }[];
    }>(`/orders/${orderId}`);

    if (order.metadata?.session_id !== sessionId) {
      return NextResponse.json({ error: 'Pedido não pertence a esta sessão' }, { status: 403 });
    }

    const charge = order.charges?.[0];
    const pago = order.status === 'paid' || order.charges?.some((c) => c.status === 'paid');
    if (pago) {
      await marcarPedidoPago(await createServiceClient(), { sessionId, orderId, chargeId: charge?.id }, {
        ip, userAgent: req.headers.get('user-agent') ?? undefined, origem: 'confirmação na tela',
      });
    }

    const tx = charge?.last_transaction;
    const falhou = !pago && (['failed', 'canceled'].includes(order.status) || ['failed', 'canceled'].includes(charge?.status ?? ''));
    return NextResponse.json({
      paid: !!pago,
      falhou,
      order_status: order.status,
      pix_qr_code: tx?.qr_code ?? null,
      pix_qr_code_url: tx?.qr_code_url ?? null,
      expires_at: tx?.expires_at ?? null,
    });
  } catch (err) {
    // Order que não existe (link velho, localStorage de outro ambiente): a tela
    // trata como PIX falho e oferece gerar outro — não é erro nosso.
    if (err instanceof PagarMeError && err.status === 404) {
      return NextResponse.json({ paid: false, falhou: true, order_status: 'not_found' });
    }
    console.error('[link-bio-pro/status]', err);
    await logCheckoutError({ route: 'link-bio-pro/checkout/status', err, context: { order_id: orderId } });
    return NextResponse.json({ error: 'Erro ao verificar status' }, { status: 500 });
  }
}
