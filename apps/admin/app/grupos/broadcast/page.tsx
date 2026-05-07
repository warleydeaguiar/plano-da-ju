import BroadcastClient from './BroadcastClient'
import { createAdminClient } from '@/lib/supabase'
const supabase = createAdminClient()

export const dynamic = 'force-dynamic'

export default async function BroadcastPage() {
  const { data: history } = await supabase
    .from('wg_broadcasts' as any)
    .select('*, wg_broadcast_results(id, group_id, status, error)')
    .order('created_at', { ascending: false })
    .limit(20)

  const { data: groups } = await supabase
    .from('wg_groups' as any)
    .select('id, name, jid, status, is_receiving, member_count')
    .eq('status', 'active')
    .order('name')

  return (
    <BroadcastClient
      history={(history ?? []) as any[]}
      groups={(groups ?? []) as any[]}
    />
  )
}
