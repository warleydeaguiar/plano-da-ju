import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const RULES = [20, 60, 120] as const
type Rule = typeof RULES[number]

/**
 * GET /api/followup
 *   ?mode=kanban[&rule=20|60|120] → retorna { atrasados, hoje, amanha, counts }
 *   ?mode=history                → retorna { leads } com followups já feitos
 *   (sem mode)                   → lista todos pending (compat antigo)
 */
export async function GET(req: NextRequest) {
  const sb = createAdminClient()
  const url = new URL(req.url)
  const mode = url.searchParams.get('mode') ?? 'pending'
  const ruleParam = url.searchParams.get('rule') // opcional para filtrar
  const ruleFilter = ruleParam ? (parseInt(ruleParam, 10) as Rule) : null

  // Busca todos os leads
  const { data: leads, error: lErr } = await sb
    .from('wg_quiz_leads' as any)
    .select('id, name, email, phone, utm_source, utm_campaign, created_at')
    .order('created_at', { ascending: false })
    .limit(2000)
  if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 })

  // Busca followups feitos
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

  // ── HISTORY: leads já contatados, ordem desc ──
  if (mode === 'history') {
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
          instance_used: f.instance_used,
          send_method: f.send_method,
          followup_id: f.id,
        })
      }
    }
    history.sort((a, b) => +new Date(b.contacted_at) - +new Date(a.contacted_at))
    return NextResponse.json({ leads: history, total: history.length })
  }

  // ── KANBAN: agrupa por status (atrasados / hoje / amanhã) ──
  if (mode === 'kanban') {
    const cards: any[] = []
    for (const lead of (leads ?? []) as any[]) {
      const ds = daysSince(lead.created_at)
      const fs = followupMap.get(lead.id) ?? []
      for (const r of RULES) {
        if (ruleFilter && r !== ruleFilter) continue
        if (fs.some(f => f.rule_days === r)) continue // já contatado nessa régua
        const diff = ds - r // dias além do agendado
        // Só entra no kanban se está atrasado, hoje ou amanhã (diff >= -1)
        if (diff < -1) continue
        let status: 'atrasados' | 'hoje' | 'amanha'
        if (diff >= 1) status = 'atrasados'
        else if (diff === 0) status = 'hoje'
        else status = 'amanha' // diff === -1
        cards.push({
          ...lead,
          days_since: ds,
          rule_days: r,
          status,
          days_overdue: Math.max(0, diff),
        })
      }
    }

    const atrasados = cards.filter(c => c.status === 'atrasados')
      .sort((a, b) => b.days_overdue - a.days_overdue)
    const hoje = cards.filter(c => c.status === 'hoje')
      .sort((a, b) => a.rule_days - b.rule_days)
    const amanha = cards.filter(c => c.status === 'amanha')
      .sort((a, b) => a.rule_days - b.rule_days)

    // Conta leads "aguardando" (na base mas ainda não hit 20 dias)
    let waitingForRule = 0
    let totalLeads = 0
    for (const lead of (leads ?? []) as any[]) {
      totalLeads++
      const ds = daysSince(lead.created_at)
      if (ds < 20) waitingForRule++
    }

    // Contagem global por régua (sem filtro)
    const ruleCounts: Record<string, number> = { '20': 0, '60': 0, '120': 0 }
    for (const lead of (leads ?? []) as any[]) {
      const ds = daysSince(lead.created_at)
      const fs = followupMap.get(lead.id) ?? []
      for (const r of RULES) {
        if (ds >= r && !fs.some(f => f.rule_days === r)) ruleCounts[String(r)]++
      }
    }

    return NextResponse.json({
      atrasados, hoje, amanha,
      counts: {
        atrasados: atrasados.length,
        hoje: hoje.length,
        amanha: amanha.length,
        total: atrasados.length + hoje.length + amanha.length,
        totalLeads,
        waitingForRule,
      },
      ruleCounts,
    })
  }

  // ── DEFAULT (compat antigo): lista pending por régua ──
  const result = (leads ?? [])
    .map((lead: any) => ({ ...lead, days_since: daysSince(lead.created_at) }))
    .filter((lead: any) => {
      if (!ruleFilter) return false
      if (lead.days_since < ruleFilter) return false
      const fs = followupMap.get(lead.id) ?? []
      return !fs.some(f => f.rule_days === ruleFilter)
    })
    .sort((a: any, b: any) => b.days_since - a.days_since)

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

/** POST — marca followup manual */
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
    send_method: 'manual',
  }, { onConflict: 'lead_id,rule_days' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

/** DELETE — desfaz followup */
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
