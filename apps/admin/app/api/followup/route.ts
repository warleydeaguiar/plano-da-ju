import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const RULES = [20, 60, 120] as const
type Rule = typeof RULES[number]

/**
 * GET /api/followup?rule=20|60|120|history
 *   Lista leads que entraram na régua mas ainda não foram contatados naquela régua.
 *   rule=history → leads JÁ contatados em alguma régua, ordenado por contacted_at desc.
 */
export async function GET(req: NextRequest) {
  const sb = createAdminClient()
  const rule = new URL(req.url).searchParams.get('rule') ?? '20'

  // Buscar todos os leads ativos
  const { data: leads, error: lErr } = await sb
    .from('wg_quiz_leads' as any)
    .select('id, name, email, phone, utm_source, utm_campaign, created_at')
    .order('created_at', { ascending: false })
    .limit(1000)
  if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 })

  // Buscar todos os followups já feitos
  const { data: followups, error: fErr } = await sb
    .from('wg_lead_followups' as any)
    .select('*')
  if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 })

  const followupMap = new Map<string, any[]>()
  for (const f of (followups ?? []) as any[]) {
    if (!followupMap.has(f.lead_id)) followupMap.set(f.lead_id, [])
    followupMap.get(f.lead_id)!.push(f)
  }

  const now = Date.now()
  const daysSince = (iso: string) => Math.floor((now - new Date(iso).getTime()) / 86400000)

  // ── HISTORY: todos os leads já contatados em alguma régua ──
  if (rule === 'history') {
    const history: any[] = []
    for (const lead of (leads ?? []) as any[]) {
      const fs = followupMap.get(lead.id) ?? []
      for (const f of fs) {
        history.push({
          ...lead,
          days_since: daysSince(lead.created_at),
          rule_days: f.rule_days,
          contacted_at: f.contacted_at,
          contacted_by: f.contacted_by,
          notes: f.notes,
          outcome: f.outcome,
          followup_id: f.id,
        })
      }
    }
    history.sort((a, b) => +new Date(b.contacted_at) - +new Date(a.contacted_at))
    return NextResponse.json({ leads: history, total: history.length })
  }

  // ── RULE: 20, 60 ou 120 dias ──
  const ruleNum = parseInt(rule, 10) as Rule
  if (!RULES.includes(ruleNum)) {
    return NextResponse.json({ error: 'Régua inválida' }, { status: 400 })
  }

  const result = (leads ?? [])
    .map((lead: any) => ({ ...lead, days_since: daysSince(lead.created_at) }))
    .filter((lead: any) => {
      if (lead.days_since < ruleNum) return false
      const fs = followupMap.get(lead.id) ?? []
      return !fs.some(f => f.rule_days === ruleNum)
    })
    .sort((a: any, b: any) => b.days_since - a.days_since)

  // Contagem das outras réguas para badges
  const counts: Record<string, number> = { '20': 0, '60': 0, '120': 0 }
  for (const lead of (leads ?? []) as any[]) {
    const ds = daysSince(lead.created_at)
    const fs = followupMap.get(lead.id) ?? []
    for (const r of RULES) {
      if (ds >= r && !fs.some(f => f.rule_days === r)) counts[String(r)]++
    }
  }

  return NextResponse.json({ leads: result, total: result.length, counts })
}

/**
 * POST /api/followup
 *   body: { lead_id, rule_days, notes?, outcome?, contacted_by? }
 *   Marca um lead como contatado em uma régua específica.
 */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { lead_id, rule_days, notes, outcome, contacted_by } = body
  if (!lead_id || !RULES.includes(rule_days)) {
    return NextResponse.json({ error: 'lead_id e rule_days (20|60|120) são obrigatórios' }, { status: 400 })
  }
  const sb = createAdminClient()
  const { error } = await sb.from('wg_lead_followups' as any).upsert({
    lead_id,
    rule_days,
    contacted_at: new Date().toISOString(),
    notes: notes ?? null,
    outcome: outcome ?? null,
    contacted_by: contacted_by ?? null,
  }, { onConflict: 'lead_id,rule_days' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

/**
 * DELETE /api/followup?lead_id=...&rule_days=20
 *   Desfaz um followup (volta o lead para a fila pendente).
 */
export async function DELETE(req: NextRequest) {
  const params = new URL(req.url).searchParams
  const lead_id = params.get('lead_id')
  const rule_days = parseInt(params.get('rule_days') ?? '0', 10)
  if (!lead_id || !RULES.includes(rule_days as Rule)) {
    return NextResponse.json({ error: 'lead_id e rule_days são obrigatórios' }, { status: 400 })
  }
  const sb = createAdminClient()
  const { error } = await sb.from('wg_lead_followups' as any)
    .delete()
    .eq('lead_id', lead_id)
    .eq('rule_days', rule_days)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
