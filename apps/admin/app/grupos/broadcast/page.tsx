import BroadcastClient from './BroadcastClient'
import { createAdminClient } from '@/lib/supabase'
import { fetchAllInstances } from '@/lib/evolution-grupos'

export const dynamic = 'force-dynamic'

export default async function BroadcastPage() {
  const supabase = createAdminClient()

  const [historyRes, groupsRes, instances, savedRes] = await Promise.all([
    supabase
      .from('wg_broadcasts' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('wg_groups' as any)
      .select('id, name, jid, status, is_receiving, member_count')
      .eq('status', 'active')
      .order('name'),
    fetchAllInstances().catch(() => []),
    supabase
      .from('wg_saved_messages' as any)
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false }),
  ])

  return (
    <BroadcastClient
      history={(historyRes.data ?? []) as any[]}
      groups={(groupsRes.data ?? []) as any[]}
      instances={instances as any[]}
      savedMessages={(savedRes.data ?? []) as any[]}
    />
  )
}
