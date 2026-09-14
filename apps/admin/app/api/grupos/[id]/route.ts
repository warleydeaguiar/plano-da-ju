import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/grupos/:id — atualiza is_receiving, name, status, link, contagem…
 *
 * Duas regras que fazem a distribuição funcionar sem o Evolution:
 * - Link digitado pelo operador liga `link_ok`. O distribuidor só usa grupo
 *   com link válido, e antes só o Evolution marcava isso: com o número banido,
 *   grupo cadastrado à mão nunca recebia ninguém.
 * - Recontar membros zera `entradas_desde_contagem`: a ocupação estimada volta
 *   a ser a contagem nova + as entradas daqui em diante.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createAdminClient()
  const { id } = await params
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, created_at: _criado, ...campos } = (await req.json()) ?? {}
  const agora = new Date().toISOString()
  const update: Record<string, unknown> = { ...campos, updated_at: agora }

  if (typeof campos.invite_link === 'string') {
    const bruto = campos.invite_link.trim()
    const codigo = bruto.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/)?.[1]
      ?? (/^[A-Za-z0-9]{10,}$/.test(bruto) ? bruto : null)
    if (!codigo) return NextResponse.json({ error: 'Link de convite inválido' }, { status: 400 })
    update.invite_link = `https://chat.whatsapp.com/${codigo}`
    update.invite_code = codigo
    if (campos.link_ok === undefined) update.link_ok = true
    update.link_checked_at = agora
  }
  if (campos.link_ok !== undefined) update.link_checked_at = agora

  if (campos.capacity !== undefined) {
    const cap = Math.round(Number(campos.capacity))
    if (!Number.isFinite(cap) || cap < 1 || cap > 1024) {
      return NextResponse.json({ error: 'Limite deve ficar entre 1 e 1024 (máximo do WhatsApp)' }, { status: 400 })
    }
    update.capacity = cap
  }

  if (campos.member_count !== undefined) {
    const n = Math.round(Number(campos.member_count))
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: 'Número de membros inválido' }, { status: 400 })
    }
    update.member_count = n
    update.entradas_desde_contagem = 0
    update.contagem_em = agora
    // Recontou e tem vaga: um grupo marcado como "cheio" volta a valer.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: atual } = await (supabase.from('wg_groups' as any) as any)
      .select('status, capacity').eq('id', id).single()
    const cap = Number(update.capacity ?? atual?.capacity ?? 1024)
    if (atual?.status === 'full' && n < cap && campos.status === undefined) update.status = 'active'
  }

  const { data, error } = await supabase
    .from('wg_groups' as any)
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/** DELETE /api/grupos/:id — arquiva o grupo */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createAdminClient()
  const { id } = await params

  const { error } = await supabase
    .from('wg_groups' as any)
    .update({ status: 'archived', is_receiving: false, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
