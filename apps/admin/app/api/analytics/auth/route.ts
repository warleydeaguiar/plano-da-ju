import { NextResponse } from 'next/server';
import { buildAuthUrl, gaConfigured } from '@/lib/analytics';

export const dynamic = 'force-dynamic';

/** GET /api/analytics/auth → manda o usuário pro consentimento do Google. */
export async function GET() {
  if (!gaConfigured()) {
    return NextResponse.json({ error: 'Integração Analytics não configurada (faltam credenciais OAuth).' }, { status: 500 });
  }
  return NextResponse.redirect(buildAuthUrl());
}
