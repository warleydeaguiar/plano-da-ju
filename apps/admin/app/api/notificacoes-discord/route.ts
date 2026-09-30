import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// PATCH — liga/desliga ou troca o webhook de uma notificação (chave no body)
export async function PATCH(req: NextRequest) {
  const { chave, ...updates } = await req.json()
  if (!chave) return NextResponse.json({ error: 'chave obrigatória' }, { status: 400 })
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('wg_notif_discord' as any)
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('chave', chave)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
