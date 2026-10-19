/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomInt } from 'crypto'
import { createAdminClient } from '@/lib/supabase'
import { DISCADOR_PADRAO, lerConfig, processarFila, type ParametrosDiscador } from '@/lib/discador'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Painel do discador (/discador) — protegido pelo login do admin (middleware).
 *  GET   → config, atendentes, aparelhos, fila aberta, últimas ligações, números de hoje
 *  PATCH → { ligado?, motor_ligado?, parametros? }
 *  POST  → { acao: 'simular' | 'atendente' | 'parear' | 'pausar' | 'revogar', ... }
 */
const hash = (s: string) => createHash('sha256').update(s).digest('hex')
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // sem I e O (confundem com 1 e 0)

export async function GET() {
  const sb = createAdminClient()
  const { ligado, motorLigado, p } = await lerConfig(sb)
  const hoje = new Date(); hoje.setUTCHours(3, 0, 0, 0) // meia-noite de Brasília
  if (hoje.getTime() > Date.now()) hoje.setUTCDate(hoje.getUTCDate() - 1)
  const [atendentes, aparelhos, fila, chamadas, hojeCh, erros] = await Promise.all([
    (sb.from('discador_atendentes') as any).select('*').order('id'),
    (sb.from('discador_aparelhos') as any).select('id, atendente_id, nome, pareado_em, pausado, revogado_em, ultimo_contato_em, estado, app_versao, modelo, codigo_expira, padrao, padrao_em').order('id', { ascending: false }),
    (sb.from('discador_tarefas') as any).select('id, nome, email, telefone, motivo, prioridade, tentativas, proxima_em, criada_em, contexto').eq('status', 'aberta').order('prioridade').order('proxima_em').limit(200),
    (sb.from('discador_chamadas') as any).select('id, tarefa_id, tentativa, criada_em, atendeu_em, duracao_s, desfecho, resultado, nota, chip, discador_tarefas(nome, motivo)').order('id', { ascending: false }).limit(30),
    (sb.from('discador_chamadas') as any).select('desfecho, duracao_s, resultado').gte('criada_em', hoje.toISOString()),
    (sb.from('discador_erros') as any).select('id, aparelho_id, tipo, mensagem, detalhe, app_versao, criado_em').order('id', { ascending: false }).limit(15),
  ])
  const h = (hojeCh.data ?? []) as any[]
  return NextResponse.json({
    ligado, motorLigado, parametros: p,
    atendentes: atendentes.data ?? [], aparelhos: aparelhos.data ?? [],
    fila: fila.data ?? [], chamadas: chamadas.data ?? [], erros: erros.data ?? [],
    hoje: {
      ligacoes: h.filter((c) => c.desfecho && c.desfecho !== 'pulou').length,
      atendidas: h.filter((c) => c.desfecho === 'atendeu').length,
      vaiPagar: h.filter((c) => c.resultado === 'vai_comprar').length,
      minutos: Math.round(h.reduce((s, c) => s + (c.desfecho === 'atendeu' ? c.duracao_s ?? 0 : 0), 0) / 60),
    },
  })
}

export async function PATCH(req: NextRequest) {
  const sb = createAdminClient()
  const body = await req.json().catch(() => ({}))
  const atual = await lerConfig(sb)
  const upd: any = { atualizado_em: new Date().toISOString() }
  let p: ParametrosDiscador = { ...atual.p }
  if (body.parametros && typeof body.parametros === 'object') {
    // só chaves conhecidas, números dentro de limites razoáveis
    for (const k of Object.keys(DISCADOR_PADRAO) as (keyof ParametrosDiscador)[]) {
      if (!(k in body.parametros) || k === 'ligado_desde') continue
      const v = body.parametros[k]
      if (typeof DISCADOR_PADRAO[k] === 'number') {
        const n = Number(v); if (!Number.isFinite(n) || n < 0 || n > 10000) continue
        ;(p as any)[k] = n
      } else (p as any)[k] = v
    }
  }
  if (typeof body.motor_ligado === 'boolean') {
    upd.motor_ligado = body.motor_ligado
    // Regra nova não volta ao passado: marca o momento em que ligou.
    if (body.motor_ligado && !atual.motorLigado) p = { ...p, ligado_desde: new Date().toISOString() }
  }
  if (typeof body.ligado === 'boolean') upd.ligado = body.ligado
  upd.parametros = p
  const { error } = await (sb.from('discador_config') as any).update(upd).eq('id', 1)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  const sb = createAdminClient()
  const body = await req.json().catch(() => ({}))
  const acao = String(body.acao ?? '')

  if (acao === 'simular') {
    return NextResponse.json(await processarFila(sb, { seco: true }))
  }

  if (acao === 'atendente') {
    const nome = String(body.nome ?? '').trim()
    if (!nome) return NextResponse.json({ error: 'Informe o nome' }, { status: 400 })
    const dados = { nome, foto_url: String(body.foto_url ?? '').trim() || null, ativo: body.ativo !== false }
    const q = body.id
      ? (sb.from('discador_atendentes') as any).update(dados).eq('id', body.id)
      : (sb.from('discador_atendentes') as any).insert(dados)
    const { error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (acao === 'parear') {
    const atendenteId = Number(body.atendente_id)
    if (!atendenteId) return NextResponse.json({ error: 'Escolha a atendente' }, { status: 400 })
    // Código de 8 letras, uso único, vale 10 min. Só o HASH vai para o banco.
    const codigo = Array.from({ length: 8 }, () => LETRAS[randomInt(LETRAS.length)]).join('')
    const { error } = await (sb.from('discador_aparelhos') as any).insert({
      atendente_id: atendenteId, nome: String(body.nome ?? '').trim() || 'Celular da empresa',
      codigo_hash: hash(codigo), codigo_expira: new Date(Date.now() + 10 * 60_000).toISOString(),
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, codigo: `${codigo.slice(0, 4)}-${codigo.slice(4)}` })
  }

  if (acao === 'pausar' || acao === 'revogar') {
    const id = Number(body.id)
    const upd = acao === 'pausar'
      ? { pausado: !!body.pausado }
      : { revogado_em: new Date().toISOString(), token_hash: null, codigo_hash: null }
    const { error } = await (sb.from('discador_aparelhos') as any).update(upd).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'ação desconhecida' }, { status: 400 })
}
