/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse, type NextRequest } from 'next/server'
import { aparelhoDaRequisicao, registrarErroDoApp } from '@/lib/discador-app'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * O celular conta o que deu errado lá: travamento (com o rastro do erro),
 * chamada que não chegou ao app, perda do papel de telefone padrão. Aparece
 * no painel do discador, para a gente ver o problema sem precisar do aparelho.
 */
export async function POST(req: NextRequest) {
  const ap = await aparelhoDaRequisicao(req)
  if (!ap) return NextResponse.json({ erro: 'Aparelho não autorizado.' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const lista = Array.isArray(b?.erros) ? b.erros.slice(0, 20) : [b]
  for (const e of lista) await registrarErroDoApp(ap, e, req.headers.get('x-discador-versao'))
  return NextResponse.json({ ok: true })
}
