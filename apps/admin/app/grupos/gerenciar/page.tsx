import GerenciarClient from './GerenciarClient'
import { createAdminClient } from '@/lib/supabase'
const supabase = createAdminClient()

export const dynamic = 'force-dynamic'

export default async function GerenciarPage() {
  const { data } = await supabase
    .from('wg_groups' as any)
    .select('*')
    .order('created_at', { ascending: false })

  return <GerenciarClient initialGroups={(data ?? []) as any[]} />
}
