import { NextResponse, type NextRequest } from 'next/server'
import { aparelhoDaRequisicao, quemEstaLigando } from '@/lib/discador-app'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/discador/quem?tel=… — a ficha de quem está ligando para o celular (retorno da cliente). */
export async function GET(req: NextRequest) {
  const ap = await aparelhoDaRequisicao(req)
  if (!ap) return NextResponse.json({ erro: 'Aparelho não autorizado.' }, { status: 401 })
  const tel = req.nextUrl.searchParams.get('tel') ?? ''
  return NextResponse.json(await quemEstaLigando(ap, tel), { headers: { 'Cache-Control': 'no-store' } })
}
