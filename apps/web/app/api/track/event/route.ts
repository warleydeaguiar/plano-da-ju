import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getClientIp } from '@/lib/rate-limit';
import { sendCapiEvent } from '@/lib/meta/capi';
import { getTrackingIdentity } from '@/lib/tracking-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/track/event
 *
 * Espelha um evento de funil do Pixel (browser) no CAPI (server-side) com o
 * MESMO event_id → o Meta deduplica e fica com a versão de melhor qualidade.
 * Enriquece com Advanced Matching completo lendo a identidade persistida
 * (fbp/fbc/ip/ua/zip/cpf/email/phone) por session_id.
 *
 * Eventos suportados: Lead, InitiateCheckout, AddPaymentInfo.
 * Purchase NÃO passa aqui — é disparado server-side no webhook/polling (Etapa 3).
 *
 * Body: { session_id, event_name, event_id, value?, currency?, email?, phone?,
 *         content_name?, content_category?, event_source_url? }
 * Best-effort: nunca quebra o cliente.
 */

const ALLOWED = new Set(['Lead', 'InitiateCheckout', 'AddPaymentInfo', 'PageView']);

function clean(v: unknown, max = 200): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
}

// Diagnóstico: confirma se o token do CAPI está disponível em runtime (NUNCA expõe o valor).
// GET /api/track/event?diag=1&k=<WA_AUTOREPLY_SECRET>
export async function GET(req: NextRequest) {
  const k = req.nextUrl.searchParams.get('k');
  if (k !== process.env.WA_AUTOREPLY_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const t = process.env.META_CAPI_ACCESS_TOKEN || '';
  return NextResponse.json({ capi_token_present: !!t, len: t.length });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const session_id = clean(body.session_id, 64);
    const event_name = clean(body.event_name, 32);
    const event_id = clean(body.event_id, 80);

    if (!session_id || !event_name || !event_id || !ALLOWED.has(event_name)) {
      return NextResponse.json({ ok: false, error: 'parâmetros inválidos' }, { status: 400 });
    }

    // Esta request VEM do navegador do cliente → ip/ua são reais e confiáveis.
    const ipRaw = getClientIp(req);
    const ip = ipRaw && ipRaw !== 'unknown' ? ipRaw : undefined;
    const userAgent = req.headers.get('user-agent')?.slice(0, 500) ?? undefined;

    const sb = await createServiceClient();
    const emailIn = clean(body.email);
    const phoneIn = clean(body.phone);

    // Identidade persistida (fbp/fbc/zip/cpf + email/phone de fallback)
    const trk = await getTrackingIdentity(sb, { sessionId: session_id, email: emailIn ?? null });

    // PageView e Lead NÃO levam `value` (Lead com preço fixo faz o Meta acusar
    // "todos os Leads com o mesmo preço" e derruba a qualidade/ROAS). Lead mantém
    // só `currency`. IC/AddPaymentInfo levam value (fallback 34.90 BRL do plano).
    const isPageView = event_name === 'PageView';
    const noValueEvent = isPageView || event_name === 'Lead';
    const value = noValueEvent ? undefined : (typeof body.value === 'number' && isFinite(body.value) ? body.value : 34.9);
    const currency = isPageView ? undefined : (clean(body.currency, 8) ?? 'BRL');

    await sendCapiEvent({
      eventName: event_name as 'Lead' | 'InitiateCheckout' | 'AddPaymentInfo' | 'PageView',
      eventId: event_id, // dedup com o Pixel (mesmo eventID no fbq)
      eventSourceUrl: clean(body.event_source_url, 500),
      user: {
        email: emailIn ?? trk.email,
        phone: phoneIn ?? trk.phone,
        fbp: trk.fbp,
        fbc: trk.fbc,
        ip: ip ?? trk.ip,
        userAgent: userAgent ?? trk.userAgent,
        zip: trk.zip,
        cpf: trk.cpf,
      },
      customData: {
        ...(value !== undefined ? { value } : {}),
        ...(currency !== undefined ? { currency } : {}),
        content_name: clean(body.content_name, 100),
        content_category: clean(body.content_category, 100),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[track/event]', err);
    // Tracking é best-effort — nunca quebra o fluxo do cliente.
    return NextResponse.json({ ok: true });
  }
}
