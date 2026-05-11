import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST /api/grupos/bulk
 * Body: { action: 'activate_all' | 'deactivate_all' }
 * Ativa ou desativa todos os grupos com status 'active'
 */
export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()
  const { action } = body

  if (action !== 'activate_all' && action !== 'deactivate_all') {
    return NextResponse.json({ error: 'Ação inválida. Use activate_all ou deactivate_all.' }, { status: 400 })
  }

  const is_receiving = action === 'activate_all'

  const { data, error } = await supabase
    .from('wg_groups' as any)
    .update({ is_receiving, updated_at: new Date().toISOString() })
    .eq('status', 'active')
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, updated: (data as any[]).length })
}
