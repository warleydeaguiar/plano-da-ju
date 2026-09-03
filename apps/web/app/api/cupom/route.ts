import { NextRequest, NextResponse } from 'next/server';
import { conferirCupom } from '@/lib/cupom';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/cupom?codigo=XXXX
 *
 * Diz se o cupom vale e por quanto fica. NÃO consome uso — quem consome é a
 * rota de checkout, no momento do pagamento. Assim conferir o cupom dez vezes
 * na tela não gasta as dez unidades da promoção.
 *
 * Tem limite por IP porque este endereço é um oráculo: sem ele, dava para
 * varrer códigos até achar um que funcione.
 */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`cupom:${ip}`, { max: 12, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { valido: false, erro: 'Muitas tentativas. Aguarde um minuto.' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  const codigo = req.nextUrl.searchParams.get('codigo');
  const c = await conferirCupom(codigo);
  if (!c) {
    return NextResponse.json({ valido: false, erro: 'Cupom inválido ou expirado.' });
  }
  return NextResponse.json({
    valido: true,
    codigo: c.codigo,
    preco_cents: c.precoCents,
    desconto_cents: c.descontoCents,
    descricao: c.descricao,
  });
}
