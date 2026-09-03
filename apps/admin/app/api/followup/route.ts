import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * Fila de followup.
 *
 * O cálculo mora no banco (migration 016). A versão anterior buscava os 2.000
 * leads mais recentes e TODOS os followups e cruzava em memória — com 98.771
 * leads isso significava montar a fila sobre 2% da base, e justamente os 2%
 * mais NOVOS, que são os que ainda não venceram régua nenhuma. A tela ficava
 * lenta e, pior, mostrava um quadro errado.
 *
 * As réguas (de quantos em quantos dias falar) também saíram do código para a
 * tabela `followup_reguas`: mudar a cadência é edição na tela, não deploy.
 */

const PAGINA_PADRAO = 50

async function reguasAtivas(sb: ReturnType<typeof createAdminClient>): Promise<number[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb.from('followup_reguas' as any) as any)
    .select('dias').eq('ativa', true).order('dias')
  return ((data ?? []) as { dias: number }[]).map((r) => r.dias)
}

/**
 * GET /api/followup
 *   ?mode=kanban[&rule=N][&situacao=atrasados|hoje|amanha][&limite=][&offset=]
 *       → uma PÁGINA de cards + contagens completas (contadas no banco)
 *   ?mode=history → followups já feitos
 *   ?mode=reguas  → só as réguas configuradas
 */
export async function GET(req: NextRequest) {
  const sb = createAdminClient()
  const url = new URL(req.url)
  const mode = url.searchParams.get('mode') ?? 'kanban'
  const ruleParam = url.searchParams.get('rule')
  const rule = ruleParam ? parseInt(ruleParam, 10) : null
  const limite = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limite') ?? String(PAGINA_PADRAO), 10)))
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') ?? '0', 10))

  /* eslint-disable @typescript-eslint/no-explicit-any */

  if (mode === 'reguas') {
    const { data, error } = await (sb.from('followup_reguas' as any) as any)
      .select('*').order('dias')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ reguas: data ?? [] })
  }

  // ── HISTÓRICO: followups feitos, do mais recente para o mais antigo ──
  // Parte dos followups (são poucos) e busca só os leads citados, em vez de
  // varrer a base inteira atrás de quem foi contatado.
  if (mode === 'history') {
    const { data: fups, error } = await (sb.from('wg_lead_followups' as any) as any)
      .select('*').order('contacted_at', { ascending: false })
      .range(offset, offset + limite - 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const ids = [...new Set(((fups ?? []) as any[]).map((f) => f.lead_id))]
    const { data: leads } = ids.length
      ? await (sb.from('wg_quiz_leads' as any) as any)
          .select('id, name, email, phone, utm_source, utm_campaign, created_at')
          .in('id', ids)
      : { data: [] as any[] }
    const porId = new Map(((leads ?? []) as any[]).map((l) => [l.id, l]))

    const agora = Date.now()
    const historico = ((fups ?? []) as any[]).map((f) => {
      const l = porId.get(f.lead_id) ?? {}
      return {
        ...l,
        days_since: l.created_at
          ? Math.floor((agora - new Date(l.created_at).getTime()) / 86400000)
          : null,
        rule_days: f.rule_days,
        contacted_at: f.contacted_at,
        contacted_by: f.contacted_by,
        notes: f.notes,
        outcome: f.outcome,
        instance_used: f.instance_used,
        send_method: f.send_method,
        followup_id: f.id,
      }
    })
    return NextResponse.json({ leads: historico, total: historico.length, temMais: historico.length === limite })
  }

  // ── KANBAN: contagens no banco + UMA página por coluna ──
  const [{ data: contagens }, { data: resumo }, reguas] = await Promise.all([
    (sb.rpc as any)('followup_contagens'),
    (sb.rpc as any)('followup_resumo'),
    reguasAtivas(sb),
  ])

  const soma = (situacao: string) =>
    ((contagens ?? []) as any[])
      .filter((c) => c.situacao === situacao && (!rule || c.dias === rule))
      .reduce((t, c) => t + Number(c.quantos), 0)

  const pagina = async (situacao: string) => {
    const { data, error } = await (sb.rpc as any)('followup_fila', {
      p_situacao: situacao, p_dias: rule, p_limite: limite, p_offset: offset,
    })
    if (error) throw new Error(error.message)
    return ((data ?? []) as any[]).map((c) => ({ ...c, status: situacao }))
  }

  try {
    const [atrasados, hoje, amanha] = await Promise.all([
      pagina('atrasados'), pagina('hoje'), pagina('amanha'),
    ])

    // Quanto cada régua ainda deve, somando todas as situações. É o número que
    // aparece nos botões de filtro por régua.
    const ruleCounts: Record<string, number> = {}
    for (const d of reguas) ruleCounts[String(d)] = 0
    for (const c of ((contagens ?? []) as any[])) {
      ruleCounts[String(c.dias)] = (ruleCounts[String(c.dias)] ?? 0) + Number(c.quantos)
    }

    const totais = {
      atrasados: soma('atrasados'),
      hoje: soma('hoje'),
      amanha: soma('amanha'),
    }

    return NextResponse.json({
      atrasados, hoje, amanha,
      counts: {
        ...totais,
        total: totais.atrasados + totais.hoje + totais.amanha,
        totalLeads: Number((resumo as any)?.[0]?.total_leads ?? 0),
        waitingForRule: Number((resumo as any)?.[0]?.aguardando ?? 0),
      },
      ruleCounts,
      reguas,
      // Diz à tela se ainda há o que buscar em cada coluna.
      temMais: {
        atrasados: offset + atrasados.length < totais.atrasados,
        hoje: offset + hoje.length < totais.hoje,
        amanha: offset + amanha.length < totais.amanha,
      },
      offset,
      limite,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

/** POST — marca followup manual */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { lead_id, rule_days, notes, outcome, contacted_by } = body
  const sb = createAdminClient()

  // A régua tem que existir e estar ativa — antes a validação era contra uma
  // lista fixa no código, que quebraria assim que a Juliane criasse a quarta.
  const validas = await reguasAtivas(sb)
  if (!lead_id || !validas.includes(Number(rule_days))) {
    return NextResponse.json(
      { error: `lead_id e rule_days válidos são obrigatórios (ativas: ${validas.join(', ')})` },
      { status: 400 },
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.from('wg_lead_followups' as any) as any).upsert({
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
  if (!lead_id || !rule_days) {
    return NextResponse.json({ error: 'lead_id e rule_days são obrigatórios' }, { status: 400 })
  }
  const sb = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.from('wg_lead_followups' as any) as any)
    .delete().eq('lead_id', lead_id).eq('rule_days', rule_days)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
