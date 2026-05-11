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

/** PATCH /api/followup/templates — atualiza mensagem e/ou instância default de um template */
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { rule_days, message, default_instance } = body
  if (![20, 60, 120].includes(rule_days)) {
    return NextResponse.json({ error: 'rule_days obrigatório (20|60|120)' }, { status: 400 })
  }
  const updates: Record<string, any> = { updated_at: new Date().toISOString() }
  if (typeof message === 'string') updates.message = message
  if (default_instance !== undefined) updates.default_instance = default_instance || null
  const sb = createAdminClient()
  const { error } = await sb
    .from('wg_followup_templates' as any)
    .update(updates)
    .eq('rule_days', rule_days)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
