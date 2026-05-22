import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SECRET = process.env.EMAIL_TRACKING_SECRET ?? '';

function signTracking(payload: string): string {
  if (!SECRET) return '';
  return createHmac('sha256', SECRET).update(payload).digest('hex').slice(0, 16);
}

function b64UrlDecode(s: string): string | null {
  try {
    const padded = s.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(padded, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

/**
 * GET /api/email/track/click?s=<send_id>&u=<base64url>&sig=<hmac>
 *
 * Verifica HMAC, registra o clique, e faz 302 redirect pro destino.
 *
 * Em caso de erro de tracking, AINDA redireciona se a URL for válida —
 * cliente nunca vai pra tela em branco.
 *
 * Em caso de sig inválida, redireciona pra home (não vai pra URL não
 * verificada — protege contra open redirect abuse).
 */
export async function GET(req: NextRequest) {
  const sendId = req.nextUrl.searchParams.get('s');
  const u      = req.nextUrl.searchParams.get('u');
  const sig    = req.nextUrl.searchParams.get('sig') ?? '';

  const homeUrl = 'https://planodaju.julianecost.com';

  if (!sendId || !u) {
    return NextResponse.redirect(homeUrl, 302);
  }

  const destination = b64UrlDecode(u);
  if (!destination || !/^https?:\/\//i.test(destination)) {
    return NextResponse.redirect(homeUrl, 302);
  }

  // Verifica HMAC — protege contra open redirect
  if (SECRET) {
    const expected = signTracking(`click:${sendId}:${destination}`);
    if (expected !== sig) {
      // Sig errada — sai sem rastreamento mas leva pra home (não pro destino
      // não-verificado, pra evitar virar open redirect pra phishing)
      return NextResponse.redirect(homeUrl, 302);
    }
  }

  // IMPORTANTE: gravar ANTES de redirecionar (await). Fire-and-forget não
  // completa em serverless. Timeout de 2.5s pra nunca segurar o redirect além disso.
  await Promise.race([
    recordClick(sendId, destination, req).catch(err => console.error('[email/track/click]', err)),
    new Promise(resolve => setTimeout(resolve, 2500)),
  ]);

  // 302 redirect pro destino verificado
  return NextResponse.redirect(destination, 302);
}

async function recordClick(sendId: string, destination: string, req: NextRequest): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const ua = req.headers.get('user-agent') ?? '';
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb.from('wg_email_sends') as any)
    .select('id, click_count, clicked_at, opened_at, open_count')
    .eq('id', sendId)
    .single();
  if (!data) return;

  // Um clique implica abertura — se ainda não tinha aberto, marca também
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb.from('wg_email_sends') as any)
    .update({
      clicked_at: data.clicked_at ?? new Date().toISOString(),
      last_clicked_at: new Date().toISOString(),
      click_count: (data.click_count ?? 0) + 1,
      opened_at: data.opened_at ?? new Date().toISOString(),
      open_count: data.open_count > 0 ? data.open_count : 1,
    })
    .eq('id', sendId);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb.from('wg_email_events' as any) as any).insert({
      send_id: sendId,
      event_type: 'click',
      url: destination.slice(0, 1000),
      user_agent: ua.slice(0, 500),
      ip: ip || null,
    });
  } catch { /* ignore */ }
}
