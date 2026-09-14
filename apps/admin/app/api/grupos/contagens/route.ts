import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST /api/grupos/contagens — lança a contagem de membros de vários grupos
 * de uma vez: { itens: [{ id, member_count }] }.
 *
 * É o caminho quando não há número conectado no Evolution (banido desde
 * 28/07/2026): o operador confere no WhatsApp e digita. Cada contagem zera as
 * entradas pelo link — a ocupação estimada passa a partir do número novo.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const itens: unknown[] = Array.isArray(body?.itens) ? body.itens : []
  if (!itens.length) return NextResponse.json({ error: 'Nenhuma contagem enviada' }, { status: 400 })

  const validos: { id: string; n: number }[] = []
  for (const item of itens) {
    const { id, member_count } = (item ?? {}) as { id?: unknown; member_count?: unknown }
    const n = Math.round(Number(member_count))
    if (typeof id !== 'string' || !Number.isFinite(n) || n < 0 || n > 5000) {
      return NextResponse.json({ error: 'Há uma contagem inválida' }, { status: 400 })
    }
    validos.push({ id, n })
  }

  const sb = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: atuais, error } = await (sb.from('wg_groups' as any) as any)
    .select('id, status, capacity').in('id', validos.map(v => v.id))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const porId = new Map<string, any>(((atuais ?? []) as any[]).map(g => [g.id, g]))

  const agora = new Date().toISOString()
  const grupos: unknown[] = []
  const falhas: string[] = []
  for (const { id, n } of validos) {
    const atual = porId.get(id)
    if (!atual) { falhas.push(id); continue }
    const cap = Number(atual.capacity || 1024)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: erro } = await (sb.from('wg_groups' as any) as any)
      .update({
        member_count: n,
        entradas_desde_contagem: 0,
        contagem_em: agora,
        updated_at: agora,
        // Recontou e tem vaga: um grupo marcado como "cheio" volta a valer.
        ...(atual.status === 'full' && n < cap ? { status: 'active' } : {}),
      })
      .eq('id', id).select().single()
    if (erro) falhas.push(id)
    else grupos.push(data)
  }

  return NextResponse.json({ atualizados: grupos.length, falhas: falhas.length, grupos })
}
