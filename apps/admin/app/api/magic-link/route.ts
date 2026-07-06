import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const WEB_URL = 'https://planodaju.julianecost.com';

/**
 * GET /api/magic-link?user=<id|email>
 *
 * Gera um LINK DE ACESSO (login sem senha) pra cliente e devolve pro admin copiar
 * e mandar (Chatwoot/WhatsApp/etc.). O segredo fica só no servidor do admin.
 */
export async function GET(req: NextRequest) {
  const user = (req.nextUrl.searchParams.get('user') ?? '').trim();
  if (!user) return NextResponse.json({ error: 'informe o e-mail da cliente' }, { status: 400 });
  const secret = process.env.PLAN_PREVIEW_SECRET;
  if (!secret) return NextResponse.json({ error: 'PLAN_PREVIEW_SECRET não configurado' }, { status: 500 });

  try {
    const r = await fetch(`${WEB_URL}/api/admin/magic-link?user=${encodeURIComponent(user)}&k=${encodeURIComponent(secret)}`, { cache: 'no-store' });
    const j = await r.json();
    if (!r.ok) return NextResponse.json({ error: j?.error ?? 'falha ao gerar o link' }, { status: r.status });
    return NextResponse.json({ link: j.link, email: j.email, full_name: j.full_name });
  } catch {
    return NextResponse.json({ error: 'não foi possível gerar o link agora' }, { status: 502 });
  }
}
