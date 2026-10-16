import { NextResponse, type NextRequest } from 'next/server'
import { aparelhoDaRequisicao, estadoDoAparelho } from '@/lib/discador-app'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Tela inicial do app: liga/desliga, horário e tamanho da fila — tudo decidido no painel. */
export async function GET(req: NextRequest) {
  const ap = await aparelhoDaRequisicao(req)
  if (!ap) return NextResponse.json({ erro: 'Este aparelho foi desligado no painel. Peça um código novo e pareie de novo.' }, { status: 401 })
  return NextResponse.json(await estadoDoAparelho(ap), { headers: { 'Cache-Control': 'no-store' } })
}
