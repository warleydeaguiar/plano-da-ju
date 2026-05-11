import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { syncGroupMemberCounts, getActiveInstance } from '@/lib/evolution-grupos'

export const dynamic = 'force-dynamic'

const CAPACITY = 1024

/** POST /api/grupos/sync — atualiza member_count via Evolution API */
export async function POST() {
  const supabase = createAdminClient()
  const { data: groups, error } = await supabase
    .from('wg_groups' as any)
    .select('id, jid, member_count, name, status')
    .eq('status', 'active')
    .not('jid', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!groups?.length) {
    return NextResponse.json({ ok: true, synced: 0, total: 0, message: 'Nenhum grupo com JID para sincronizar' })
  }

  const jids = (groups as any[]).map((g) => g.jid).filter(Boolean)

  // Usa a instância ativa (open) para evitar falhas com instâncias desconectadas
  const activeInstance = await getActiveInstance()

  let counts: Record<string, number> = {}
  try {
    counts = await syncGroupMemberCounts(jids, activeInstance)
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: 'Evolution API offline', detail: String(err) },
      { status: 503 }
    )
  }

  let synced = 0
  const eventRows: { group_id: string; action: 'join' | 'leave' }[] = []

  for (const group of groups as any[]) {
    const count = counts[group.jid]
    if (count === undefined) continue

    const isFull = count >= CAPACITY

    // Registrar delta de entradas/saídas com base na diferença de membros
    const prev = group.member_count ?? 0
    const delta = count - prev
    if (delta > 0) {
      for (let i = 0; i < delta; i++) eventRows.push({ group_id: group.id, action: 'join' })
    } else if (delta < 0) {
      for (let i = 0; i < Math.abs(delta); i++) eventRows.push({ group_id: group.id, action: 'leave' })
    }

    // Só altera is_receiving automaticamente quando o grupo ficou cheio.
    // Nunca força is_receiving=true para não sobrescrever pausas manuais do admin.
    await supabase
      .from('wg_groups' as any)
      .update({
        member_count:   count,
        last_synced_at: new Date().toISOString(),
        updated_at:     new Date().toISOString(),
        ...(isFull ? { status: 'full', is_receiving: false } : {}),
      })
      .eq('id', group.id)

    synced++
  }

  // Grava eventos em batch (max 500 por vez para não estourar limite)
  if (eventRows.length > 0) {
    const chunkSize = 500
    for (let i = 0; i < eventRows.length; i += chunkSize) {
      await supabase
        .from('wg_member_events' as any)
        .insert(eventRows.slice(i, i + chunkSize))
    }
  }

  return NextResponse.json({ ok: true, synced, total: groups.length, events: eventRows.length })
}
