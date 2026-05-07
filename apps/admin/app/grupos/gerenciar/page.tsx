import GerenciarClient from './GerenciarClient'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export default async function GerenciarPage() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('wg_groups' as any)
    .select('*')
    .order('created_at', { ascending: false })

  return <GerenciarClient initialGroups={(data ?? []) as any[]} />
}
