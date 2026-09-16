import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { precoDoCliente } from '@/lib/preco-servidor';
import { PLAN_ANCHOR_CENTS } from '@/lib/pricing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/preco?s=<sessão do quiz>&e=<e-mail>
 *
 * O preço que esta cliente vai pagar, decidido no servidor a partir da resposta
 * do quiz. A oferta e a roleta consultam daqui para MOSTRAR o mesmo valor que o
 * checkout vai cobrar — se a tela calculasse por conta própria, bastaria mexer
 * no navegador para ver um preço e ser cobrada outro.
 */
export async function GET(req: NextRequest) {
  const s = req.nextUrl.searchParams.get('s');
  const e = req.nextUrl.searchParams.get('e');
  const sb = await createServiceClient();
  const { precoCents, origem } = await precoDoCliente(sb, { email: e, quizSessionId: s });
  return NextResponse.json(
    {
      preco_cents: precoCents,
      ancora_cents: PLAN_ANCHOR_CENTS,
      desconto_pct: Math.round((1 - precoCents / PLAN_ANCHOR_CENTS) * 100),
      origem,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
