import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getGroupByInviteCode } from '@/lib/evolution-grupos'

const supabase = createAdminClient()

export const dynamic = 'force-dynamic'

/** GET /api/grupos — lista todos os grupos */
export async function GET() {
  const { data, error } = await supabase
    .from('wg_groups' as any)
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/** POST /api/grupos — adiciona novo grupo pelo link de convite */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { invite_link, name, is_receiving } = body

  if (!invite_link) {
    return NextResponse.json({ error: 'invite_link é obrigatório' }, { status: 400 })
  }

  // Extrai o invite_code da URL
  const match = invite_link.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/)
  if (!match) {
    return NextResponse.json({ error: 'Link de convite inválido' }, { status: 400 })
  }
  const invite_code = match[1]

  // Valida o grupo via Evolution (obtém JID e nome real)
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
      status:       'active',
      is_receiving: is_receiving ?? false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
