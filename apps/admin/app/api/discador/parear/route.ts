import { NextResponse, type NextRequest } from 'next/server'
import { parearAparelho } from '@/lib/discador-app'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * App do discador: troca o código de 8 letras (gerado no painel, 10 min, uso
 * único) pelo token do aparelho. 24⁸ ≈ 110 bilhões de códigos para 10 min de
 * validade — chutar não é viável, então não há trava por IP como no painel da QD.
 */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const r = await parearAparelho(String(b.codigo ?? ''), {
    modelo: b.modelo ? String(b.modelo) : undefined,
    android: b.android ? String(b.android) : undefined,
    versao: b.versao ? String(b.versao) : undefined,
  })
  if (!r) return NextResponse.json({ erro: 'Código inválido ou vencido. Gere outro no painel.' }, { status: 400 })
  return NextResponse.json({ token: r.token, vendedora: r.vendedora }, { headers: { 'Cache-Control': 'no-store' } })
}
