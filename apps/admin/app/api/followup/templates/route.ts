import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/** GET /api/followup/templates — lista os 3 templates (20/60/120) */
export async function GET() {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('wg_followup_templates' as any)
    .select('*')
    .order('rule_days', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

/** PATCH /api/followup/templates — atualiza mensagem de um template */
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { rule_days, message } = body
  if (![20, 60, 120].includes(rule_days) || typeof message !== 'string') {
    return NextResponse.json({ error: 'rule_days e message obrigatórios' }, { status: 400 })
  }
  const sb = createAdminClient()
  const { error } = await sb
    .from('wg_followup_templates' as any)
    .update({ message, updated_at: new Date().toISOString() })
    .eq('rule_days', rule_days)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
