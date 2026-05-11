import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST /api/grupos/webhook
 * Recebe eventos da Evolution API em tempo real.
 * Configurar no Evolution Manager: Webhook → URL → https://admin.julianecost.com/api/grupos/webhook
 * Eventos relevantes: GROUP_PARTICIPANTS_UPDATE
 *
 * Payload da Evolution v2:
 * {
 *   "event": "group.participants.update",
 *   "instance": "nome-da-instancia",
 *   "data": {
 *     "id": "1234567890@g.us",
 *     "participants": ["5511999999999@s.whatsapp.net"],
 *     "action": "add" | "remove" | "promote" | "demote"
 *   }
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Evolution pode enviar como array ou objeto único
    const events = Array.isArray(body) ? body : [body]

    const supabase = createAdminClient()

    for (const ev of events) {
      const eventName: string = (ev.event ?? '').toLowerCase()

      // Só processa GROUP_PARTICIPANTS_UPDATE
      if (!eventName.includes('group') || !eventName.includes('participant')) continue

      const data = ev.data ?? {}
      const groupJid: string | undefined = data.id
      const rawAction: string = data.action ?? ''
      const participants: string[] = Array.isArray(data.participants) ? data.participants : []

      if (!groupJid || !participants.length) continue

      // Mapeia action Evolution → nossa action
      const action = rawAction === 'add' ? 'join' : rawAction === 'remove' ? 'leave' : null
      if (!action) continue

      // Busca o grupo pelo JID
      const { data: group } = await supabase
        .from('wg_groups' as any)
        .select('id, member_count')
        .eq('jid', groupJid)
        .single()

      if (!group) continue

      // Insere um evento por participante
      const rows = participants.map(() => ({
        group_id: group.id,
        action,
      }))

      await supabase.from('wg_member_events' as any).insert(rows)

      // Atualiza member_count incrementalmente
      const delta = action === 'join' ? participants.length : -participants.length
      const newCount = Math.max(0, (group.member_count ?? 0) + delta)
      await supabase
        .from('wg_groups' as any)
        .update({ member_count: newCount, updated_at: new Date().toISOString() })
        .eq('id', group.id)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[webhook] erro:', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
