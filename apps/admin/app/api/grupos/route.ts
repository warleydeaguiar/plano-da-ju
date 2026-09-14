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

  // Mesmo convite duas vezes dividiria a contagem de entradas em dois registros.
  const { data: repetido } = await supabase
    .from('wg_groups' as any).select('id, name').eq('invite_code', invite_code).neq('status', 'archived').limit(1)
  if (repetido && repetido.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return NextResponse.json({ error: `Esse link já está cadastrado em "${(repetido[0] as any).name}"` }, { status: 409 })
  }

  // O Evolution só completa nome e membros quando está no ar. Com o número
  // banido ele pode demorar a responder: 6 s e segue sem ele.
  let groupInfo: { subject?: string; id?: string; size?: number } = {}
  try {
    groupInfo = await Promise.race([
      getGroupByInviteCode(invite_code),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Evolution demorou mais de 6 s')), 6000)),
    ])
  } catch (err) {
    console.warn('[grupos] Evolution indisponível — salvando com os dados digitados:', err)
  }

  const membrosDigitados = Number(body.member_count)
  const limite = Math.round(Number(body.capacity))
  const agora = new Date().toISOString()
  const { data, error } = await supabase
    .from('wg_groups' as any)
    .insert({
      name:         name || groupInfo?.subject || `Grupo ${invite_code.slice(0, 6)}`,
      jid:          groupInfo?.id || null,
      invite_code,
      invite_link:  `https://chat.whatsapp.com/${invite_code}`,
      member_count: Number.isFinite(membrosDigitados) && membrosDigitados >= 0 ? Math.round(membrosDigitados) : (groupInfo?.size ?? 0),
      capacity:     limite >= 1 && limite <= 1024 ? limite : 1024,
      status:       'active',
      is_receiving: is_receiving ?? false,
      // O operador colou o link: ele garante que o convite funciona. Sem isto o
      // distribuidor ignorava o grupo (só o Evolution ligava link_ok).
      link_ok:         true,
      link_checked_at: agora,
      contagem_em:     agora,
      entradas_desde_contagem: 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
