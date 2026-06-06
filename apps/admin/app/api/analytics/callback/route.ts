import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode, GA_REDIRECT_URI } from '@/lib/analytics';

export const dynamic = 'force-dynamic';

// Base do admin derivada do redirect URI registrado (evita pegar localhost atrás do proxy).
const ADMIN_BASE = GA_REDIRECT_URI.replace('/api/analytics/callback', '');

/** GET /api/analytics/callback → troca o code por tokens e volta pra /analytics. */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const error = req.nextUrl.searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(`${ADMIN_BASE}/analytics?erro=${encodeURIComponent(error ?? 'sem_code')}`);
  }
  try {
    await exchangeCode(code);
    return NextResponse.redirect(`${ADMIN_BASE}/analytics?conectado=1`);
  } catch (e) {
    console.error('[analytics callback]', e);
    return NextResponse.redirect(`${ADMIN_BASE}/analytics?erro=token`);
  }
}
