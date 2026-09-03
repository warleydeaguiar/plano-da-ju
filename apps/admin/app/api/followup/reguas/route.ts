import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Réguas de contato: de quantos em quantos dias falar com cada lead.
 *
 * Ficavam num `const RULES = [20, 60, 120]` dentro da API, então mudar a
 * cadência exigia deploy. Aqui a Juliane edita direto.
 */

/** GET — lista as réguas, com quantos leads cada uma está devendo hoje. */
export async function GET() {
  const sb = createAdminClient()
  const [{ data: reguas, error }, { data: contagens }] = await Promise.all([
    (sb.from('followup_reguas' as any) as any).select('*').order('dias'),
    (sb.rpc as any)('followup_contagens'),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const pendentes: Record<string, number> = {}
  for (const c of ((contagens ?? []) as any[])) {
    pendentes[String(c.dias)] = (pendentes[String(c.dias)] ?? 0) + Number(c.quantos)
  }
  return NextResponse.json({
    reguas: ((reguas ?? []) as any[]).map((r) => ({ ...r, pendentes: pendentes[String(r.dias)] ?? 0 })),
  })
}

/** POST — cria uma régua. */
export async function POST(req: NextRequest) {
  const { dias, rotulo } = await req.json().catch(() => ({}))
  const n = Number(dias)
  if (!Number.isInteger(n) || n < 1 || n > 3650) {
    return NextResponse.json({ error: 'Informe um número de dias entre 1 e 3650.' }, { status: 400 })
  }
  const sb = createAdminClient()
  const { data, error } = await (sb.from('followup_reguas' as any) as any)
    .insert({ dias: n, rotulo: (rotulo ?? '').trim() || null })
    .select().single()
  if (error) {
    // 23505 = unique_violation: já existe régua com esse número de dias.
    const msg = (error as any).code === '23505'
      ? `Já existe uma régua de ${n} dias.`
      : error.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  return NextResponse.json({ regua: data })
}

/** PATCH — liga/desliga ou renomeia. O número de dias não muda: seria outra régua. */
export async function PATCH(req: NextRequest) {
  const { id, ativa, rotulo } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

  const campos: Record<string, unknown> = {}
  if (typeof ativa === 'boolean') campos.ativa = ativa
  if (typeof rotulo === 'string') campos.rotulo = rotulo.trim() || null
  if (!Object.keys(campos).length) {
    return NextResponse.json({ error: 'Nada para alterar.' }, { status: 400 })
  }

  const sb = createAdminClient()
  const { data, error } = await (sb.from('followup_reguas' as any) as any)
    .update(campos).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ regua: data })
}

/**
 * DELETE — apaga a régua.
 *
 * O histórico de quem já foi contatado por ela fica: `wg_lead_followups` guarda
 * `rule_days` como número, sem chave estrangeira. Apagar a régua para de gerar
 * tarefas novas, não reescreve o que já aconteceu.
 */
export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })
  const sb = createAdminClient()
  const { error } = await (sb.from('followup_reguas' as any) as any).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
