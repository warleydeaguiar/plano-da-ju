import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { syncGroupMemberCounts } from '@/lib/evolution-grupos'

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
    return NextResponse.json({ ok: true, synced: 0, message: 'Nenhum grupo com JID para sincronizar' })
  }

  const jids = (groups as any[]).map((g) => g.jid).filter(Boolean)

  let counts: Record<string, number> = {}
  try {
    counts = await syncGroupMemberCounts(jids)
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: 'Evolution API offline', detail: String(err) },
      { status: 503 }
    )
  }

  let synced = 0
  for (const group of groups as any[]) {
    const count = counts[group.jid]
    if (count === undefined) continue

    const isFull = count >= CAPACITY
    await supabase
      .from('wg_groups' as any)
      .update({
        member_count:   count,
        last_synced_at: new Date().toISOString(),
        updated_at:     new Date().toISOString(),
        ...(isFull
          ? { status: 'full', is_receiving: false }
          : { is_receiving: true }),
      })
      .eq('id', group.id)

    synced++
  }

  return NextResponse.json({ ok: true, synced, total: groups.length })
}
