import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { sendTextToNumber } from '@/lib/evolution-grupos'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * POST /api/followup/send
 *   body: { lead_id, rule_days, instance_name, message? }
 *   1. Envia mensagem via Evolution para o telefone do lead
 *   2. Em caso de sucesso, marca followup como contatado (com instance_used)
 *   3. Retorna erro se Evolution falhar (não marca como contatado)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { lead_id, rule_days, instance_name, message } = body

    if (!lead_id || ![20, 60, 120].includes(rule_days) || !instance_name) {
      return NextResponse.json(
        { error: 'lead_id, rule_days (20|60|120) e instance_name são obrigatórios' },
        { status: 400 }
      )
    }

    const sb = createAdminClient()

    // Busca o lead
    const { data: lead, error: lErr } = await sb
      .from('wg_quiz_leads' as any)
      .select('id, name, phone')
      .eq('id', lead_id)
      .single()

    if (lErr || !lead) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })
    }

    const phone = (lead as any).phone
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      return NextResponse.json({ error: 'Lead sem telefone válido' }, { status: 400 })
    }

    // Busca template default se mensagem não foi enviada
    let finalMessage = message as string | undefined
    if (!finalMessage) {
      const { data: tpl } = await sb
        .from('wg_followup_templates' as any)
        .select('message')
        .eq('rule_days', rule_days)
        .single()
      finalMessage = (tpl as any)?.message ?? ''
    }

    // Substitui {nome} pelo primeiro nome
    const firstName = ((lead as any).name ?? '').split(' ')[0] || 'amiga'
    finalMessage = (finalMessage ?? '').replace(/\{nome\}/g, firstName).replace(/\{name\}/g, firstName)

    if (!finalMessage.trim()) {
      return NextResponse.json({ error: 'Mensagem vazia — verifique o template' }, { status: 400 })
    }

    // Envia via Evolution
    try {
      await sendTextToNumber(phone, finalMessage, instance_name)
    } catch (err: any) {
      return NextResponse.json(
        { error: `Evolution falhou: ${err?.message ?? err}` },
        { status: 502 }
      )
    }

    // Marca como contatado (upsert para sobrescrever caso já exista)
    const { error: upErr } = await sb.from('wg_lead_followups' as any).upsert({
      lead_id,
      rule_days,
      contacted_at: new Date().toISOString(),
      instance_used: instance_name,
      send_method: 'evolution',
      notes: null,
    }, { onConflict: 'lead_id,rule_days' })

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, sent_via: instance_name })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
