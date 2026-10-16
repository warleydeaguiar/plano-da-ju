/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse, type NextRequest } from 'next/server'
import { ErroDiscador, aparelhoDaRequisicao, registrarEvento } from '@/lib/discador-app'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Um passo da ligação, contado pelo app: discou, atendeu, encerrou, resultado, sms (o celular confirma o SMS que mandou pelo chip). */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const ap = await aparelhoDaRequisicao(req)
  if (!ap) return NextResponse.json({ erro: 'Este aparelho foi desligado no painel. Peça um código novo e pareie de novo.' }, { status: 401 })
  const id = Number((await ctx.params).id)
  if (!id) return NextResponse.json({ erro: 'Esta ligação não foi encontrada no site. Toque em Começar de novo.' }, { status: 400 })
  const b = await req.json().catch(() => ({}))
  try {
    return NextResponse.json(await registrarEvento(ap, id, b), { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    if (e instanceof ErroDiscador) return NextResponse.json({ erro: e.message }, { status: 409 })
    console.error('[discador] chamada', id, String(e?.message ?? e).slice(0, 200))
    return NextResponse.json({ erro: 'O site não conseguiu salvar agora. Toque de novo em alguns segundos.' }, { status: 500 })
  }
}
