/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse, type NextRequest } from 'next/server'
import { aparelhoDaRequisicao, proximaLigacao } from '@/lib/discador-app'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * "Quem é o próximo?" — o app pergunta antes de CADA ligação. A resposta é
 * ligar (número + ficha) ou esperar (com o motivo, para a tela). É o que faz o
 * painel mandar: mudou lá, vale aqui na próxima pergunta.
 */
export async function POST(req: NextRequest) {
  const ap = await aparelhoDaRequisicao(req)
  if (!ap) return NextResponse.json({ erro: 'Este aparelho foi desligado no painel. Peça um código novo e pareie de novo.' }, { status: 401 })
  try {
    return NextResponse.json(await proximaLigacao(ap), { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    console.error('[discador] proxima', ap.id, String(e?.message ?? e).slice(0, 200))
    return NextResponse.json({ erro: 'O site não conseguiu buscar a próxima ligação. Tentando de novo…' }, { status: 500 })
  }
}
