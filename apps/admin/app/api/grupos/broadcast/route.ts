import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { sendTextToGroup, sendImageToGroup, sendVideoToGroup } from '@/lib/evolution-grupos'

const supabase = createAdminClient()

export const dynamic = 'force-dynamic'

/** POST /api/grupos/broadcast — envia mensagem para todos os grupos ativos */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { message, media_url, media_type, title } = body

  if (!message) {
    return NextResponse.json({ error: 'message é obrigatório' }, { status: 400 })
  }

  // Busca todos os grupos com JID (conectados no Evolution)
  const { data: groups } = await supabase
    .from('wg_groups' as any)
    .select('id, jid, name')
    .eq('status', 'active')
    .not('jid', 'is', null)

  if (!groups?.length) {
    return NextResponse.json({ ok: false, error: 'Nenhum grupo ativo com JID cadastrado' })
  }

  // Cria o registro do broadcast
  const { data: broadcast, error: bErr } = await supabase
    .from('wg_broadcasts' as any)
    .insert({
      title:        title || null,
      message,
      media_url:    media_url || null,
      media_type:   media_type || null,
      status:       'sending',
      total_groups: groups.length,
    })
    .select()
    .single()

  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 })

  let success = 0
  let fail = 0

  for (const group of groups as any[]) {
    try {
      if (media_type === 'image' && media_url) {
        await sendImageToGroup(group.jid, media_url, message)
      } else if (media_type === 'video' && media_url) {
        await sendVideoToGroup(group.jid, media_url, message)
      } else {
        await sendTextToGroup(group.jid, message)
      }

      await supabase.from('wg_broadcast_results' as any).insert({
        broadcast_id: (broadcast as any).id,
        group_id: group.id,
        status: 'ok',
        sent_at: new Date().toISOString(),
      })
      success++
    } catch (err) {
      await supabase.from('wg_broadcast_results' as any).insert({
        broadcast_id: (broadcast as any).id,
        group_id: group.id,
        status: 'failed',
        error: String(err),
      })
      fail++
    }
  }

  // Atualiza status final
  await supabase
    .from('wg_broadcasts' as any)
    .update({
      status:        'done',
      sent_at:       new Date().toISOString(),
      success_count: success,
      fail_count:    fail,
    })
    .eq('id', (broadcast as any).id)

  return NextResponse.json({ ok: true, success, fail, total: groups.length })
}

/** GET /api/grupos/broadcast — histórico de broadcasts */
export async function GET() {
  const { data, error } = await supabase
    .from('wg_broadcasts' as any)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
