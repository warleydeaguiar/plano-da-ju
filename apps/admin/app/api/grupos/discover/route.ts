import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { discoverGroupsFromAllInstances } from '@/lib/evolution-grupos'

export const dynamic = 'force-dynamic'

/**
 * GET /api/grupos/discover
 * Busca grupos de todas as instâncias abertas no Evolution e
 * marca quais já estão cadastrados no banco.
 */
export async function GET() {
  const supabase = createAdminClient()

  const [evoGroups, { data: existing }] = await Promise.all([
    discoverGroupsFromAllInstances(),
    supabase.from('wg_groups' as any).select('jid'),
  ])

  const existingJids = new Set((existing ?? []).map((g: any) => g.jid).filter(Boolean))

  const groups = evoGroups.map(g => ({
    ...g,
    already_saved: existingJids.has(g.id),
  }))

  return NextResponse.json(groups)
}
