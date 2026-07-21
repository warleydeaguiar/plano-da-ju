import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const WEB_URL = 'https://planodaju.julianecost.com';

/**
 * GET /api/preview-link?user=<id|email>
 *
 * Monta o link de pré-visualização "como o cliente vê" (tela real do app do
 * cliente, em modo somente-leitura). O segredo fica SÓ no servidor do admin —
 * só a URL final (com o token) chega ao navegador quando o admin clica.
 */
export async function GET(req: NextRequest) {
  const user = (req.nextUrl.searchParams.get('user') ?? '').trim();
  if (!user) return NextResponse.json({ error: 'missing user' }, { status: 400 });
  const secret = process.env.PLAN_PREVIEW_SECRET;
  if (!secret) return NextResponse.json({ error: 'PLAN_PREVIEW_SECRET não configurado' }, { status: 500 });
  const url = `${WEB_URL}/meu-plano/plano?preview_user=${encodeURIComponent(user)}&k=${encodeURIComponent(secret)}`;
  const pdfUrl = `${WEB_URL}/api/admin/plan-pdf?user=${encodeURIComponent(user)}&k=${encodeURIComponent(secret)}`;
  return NextResponse.json({ url, pdfUrl });
}
