import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getGroupByInviteCode } from '@/lib/evolution-grupos'

export const dynamic = 'force-dynamic'

/** GET /api/grupos — lista todos os grupos */
export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('wg_groups' as any)
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/**
 * POST /api/grupos — adiciona grupo.
 *
 * Dois modos:
 * 1. Por link de convite: { invite_link, name?, is_receiving? }
 * 2. Por JID direto (import do discover): { jid, name, is_receiving? }
 */
export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()
  const { invite_link, jid, name, is_receiving } = body

  // ── Modo 2: JID direto (vem do discover) ──
  if (jid && !invite_link) {
    const { data, error } = await supabase
      .from('wg_groups' as any)
      .insert({
        name:         name || `Grupo ${jid.slice(0, 12)}`,
        jid,
        invite_code:  null,
        invite_link:  null,
        member_count: body.size ?? 0,
        capacity:     1024,
        status:       'active',
        is_receiving: is_receiving ?? false,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  }

  // ── Modo 1: link de convite ──
  if (!invite_link) {
    return NextResponse.json({ error: 'invite_link ou jid é obrigatório' }, { status: 400 })
  }

  const match = invite_link.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/)
  if (!match) {
    return NextResponse.json({ error: 'Link de convite inválido' }, { status: 400 })
  }
  const invite_code = match[1]

  let groupInfo: { subject?: string; id?: string; size?: number } = {}
  try {
    groupInfo = await getGroupByInviteCode(invite_code)
  } catch (err) {
    console.warn('[grupos] Evolution offline — salvando sem validar:', err)
  }

  const { data, error } = await supabase
    .from('wg_groups' as any)
    .insert({
      name:         name || groupInfo?.subject || `Grupo ${invite_code.slice(0, 6)}`,
      jid:          groupInfo?.id || null,
      invite_code,
      invite_link:  invite_link.trim(),
      member_count: groupInfo?.size ?? 0,
      capacity:     1024,
      status:       'active',
      is_receiving: is_receiving ?? false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
