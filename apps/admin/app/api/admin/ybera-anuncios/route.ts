import { NextRequest, NextResponse } from 'next/server'
import { getGrupoAdSpendPorMes } from '@/lib/meta-ads'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/ybera-anuncios?meses=2026-06,2026-07
 *
 * Mostra o gasto com campanhas "Grupo" que a página /ybera usa para preencher
 * os meses que ninguém digitou. Existe para conferir o número sem abrir o
 * painel — o token da Meta é sensível e não pode ser lido de fora da Vercel,
 * então esta é a única forma de verificar se a conta responde de verdade.
 *
 * Protegido pelo middleware do admin (Bearer CRON_SECRET/ADMIN_SECRET).
 */
export async function GET(req: NextRequest) {
  const meses = (req.nextUrl.searchParams.get('meses') ?? '')
    .split(',').map(m => m.trim()).filter(m => /^\d{4}-\d{2}$/.test(m)).slice(0, 12)
  if (meses.length === 0) {
    return NextResponse.json({ error: 'passe ?meses=YYYY-MM,YYYY-MM' }, { status: 400 })
  }
  const gasto = await getGrupoAdSpendPorMes(meses)
  return NextResponse.json({
    ok: true,
    // null = a Meta não respondeu por aquele mês (token, permissão ou janela
    // fora do alcance da conta). Zero seria uma afirmação errada.
    gasto,
    token_configurado: !!(process.env.META_ADS_QUIZ_TOKEN ?? process.env.META_ADS_ACCESS_TOKEN),
  })
}
