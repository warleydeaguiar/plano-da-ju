/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * O que o app Android do discador conversa com o site (porte de
 * qd-loja/lib/discador.ts). Mesmos caminhos e o MESMO formato de resposta do
 * app da QD — o app muda só a marca e os textos.
 *
 *   POST /api/discador/parear/        { codigo, modelo, android, versao } → { token, vendedora }
 *   GET  /api/discador/estado/        → tela inicial
 *   POST /api/discador/proxima/       → { acao: 'ligar' | 'esperar', ... }
 *   POST /api/discador/chamada/{id}/  → discou | atendeu | encerrou | resultado | sms
 *
 * SMS: sai do CHIP do próprio celular (plano da operadora), não de um serviço
 * pago. Quando a cliente não atende, a resposta do "encerrou" traz
 * `sms: { id, telefone, texto }`; o app manda pelo Android e devolve
 * `{ evento: 'sms', sms_id, ok, erro? }`. A trava de 1 por dia por telefone
 * fica aqui no site.
 *
 * Autenticação: `Authorization: Bearer <token>` (só o hash fica no banco).
 */
import { createHash, randomBytes } from 'crypto'
import { createAdminClient } from '@/lib/supabase'
import { respostasParaFicha } from '@/lib/email-personalization'
import { MOTIVOS, depoisDe, dentroDoHorario, lerConfig, proximaAbertura, telefoneParaDiscar, type ParametrosDiscador } from '@/lib/discador'

const hash = (s: string) => createHash('sha256').update(s).digest('hex')
const WEB = 'https://planodaju.julianecost.com'
const ADMIN = 'https://admin.julianecost.com'

export class ErroDiscador extends Error {}

export const RESULTADOS_LIGACAO = [
  { id: 'vai_comprar', rotulo: 'Vai pagar', cor: 'verde' },
  { id: 'ligar_depois', rotulo: 'Ligar depois', cor: 'azul' },
  { id: 'sem_decisao', rotulo: 'Vai pensar', cor: 'neutro' },
  { id: 'comprou', rotulo: 'Já pagou', cor: 'verde' },
  { id: 'sem_interesse', rotulo: 'Sem interesse', cor: 'vermelho' },
  { id: 'contato_invalido', rotulo: 'Número errado', cor: 'vermelho' },
] as const
const SEM_ATENDER = ['nao_atendeu', 'ocupado', 'recusou', 'caixa_postal']
const DESFECHOS = ['atendeu', ...SEM_ATENDER, 'erro', 'pulou']

function configParaApp(p: ParametrosDiscador) {
  return {
    toque_segundos: p.toque_segundos,
    pausa_segundos: p.pausa_segundos,
    resultados: RESULTADOS_LIGACAO.map((r) => ({ id: r.id, rotulo: r.rotulo, cor: r.cor })),
  }
}

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
function quandoVolta(d: Date): string {
  const b = new Date(d.getTime() - 3 * 3600_000)
  const hoje = new Date(Date.now() - 3 * 3600_000)
  const hh = `${b.getUTCHours()}:${String(b.getUTCMinutes()).padStart(2, '0')}`
  if (b.toISOString().slice(0, 10) === hoje.toISOString().slice(0, 10)) return `hoje às ${hh}`
  const amanha = new Date(hoje.getTime() + 86400_000)
  if (b.toISOString().slice(0, 10) === amanha.toISOString().slice(0, 10)) return `amanhã às ${hh}`
  return `${DIAS[b.getUTCDay()]} às ${hh}`
}
function textoHorario(p: ParametrosDiscador) {
  const d = p.horario.dias
  const dias = d.length === 5 && [1, 2, 3, 4, 5].every((x) => d.includes(x)) ? 'Seg a sex' : d.map((x) => DIAS[x].slice(0, 3)).join(', ')
  return `${dias}, ${p.horario.inicio.replace(/^0/, '')}–${p.horario.fim.replace(/^0/, '')}`
}

// ── pareamento e autenticação ────────────────────────────────────────────────
export async function parearAparelho(codigo: string, info: { modelo?: string; android?: string; versao?: string }) {
  const c = String(codigo ?? '').toUpperCase().replace(/[^A-Z]/g, '')
  if (c.length !== 8) return null
  const sb = createAdminClient()
  const token = randomBytes(32).toString('base64url')
  const { data } = await (sb.from('discador_aparelhos') as any)
    .update({
      token_hash: hash(token), codigo_hash: null, codigo_expira: null, pareado_em: new Date().toISOString(),
      ultimo_contato_em: new Date().toISOString(), modelo: info.modelo?.slice(0, 80) ?? null,
      android: info.android?.slice(0, 20) ?? null, app_versao: info.versao?.slice(0, 20) ?? null, estado: 'parado',
    })
    .eq('codigo_hash', hash(c)).gt('codigo_expira', new Date().toISOString()).is('token_hash', null).is('revogado_em', null)
    .select('id, atendente_id').maybeSingle()
  if (!data) return null
  const { data: at } = await (sb.from('discador_atendentes') as any).select('nome').eq('id', data.atendente_id).maybeSingle()
  return { token, vendedora: at?.nome ?? 'Atendente' }
}

export type Aparelho = {
  id: number; atendenteId: number; nome: string | null; pausado: boolean; atendente: string; foto: string | null
  /** O app é o telefone padrão do celular? undefined = app antigo (0.1.0), que não conta. */
  padrao?: boolean
}

export async function aparelhoDaRequisicao(req: Request): Promise<Aparelho | null> {
  const m = (req.headers.get('authorization') ?? '').match(/^Bearer\s+([A-Za-z0-9_-]{30,100})$/)
  if (!m) return null
  const sb = createAdminClient()
  const versao = req.headers.get('x-discador-versao')?.slice(0, 20)
  // Desde a 0.1.1 o app conta em TODA chamada se é o app de telefone padrão.
  const h = req.headers.get('x-discador-padrao')
  const padrao = h === 'sim' ? true : h === 'nao' ? false : undefined
  const { data: antes } = await (sb.from('discador_aparelhos') as any)
    .select('id, padrao').eq('token_hash', hash(m[1])).is('revogado_em', null).maybeSingle()
  if (!antes) return null
  const agora = new Date().toISOString()
  const { data: a } = await (sb.from('discador_aparelhos') as any)
    .update({
      ultimo_contato_em: agora, ...(versao ? { app_versao: versao } : {}),
      ...(padrao !== undefined ? { padrao, ...(antes.padrao !== padrao ? { padrao_em: agora } : {}) } : {}),
    })
    .eq('id', antes.id).select('id, atendente_id, nome, pausado').maybeSingle()
  if (!a) return null
  if (padrao === false && antes.padrao !== false) {
    await (sb.from('discador_erros') as any).insert({ aparelho_id: a.id, tipo: 'perdeu_padrao', app_versao: versao ?? null,
      mensagem: 'O Discador Ju deixou de ser o app de telefone padrão do celular.' })
  }
  const { data: at } = await (sb.from('discador_atendentes') as any).select('nome, foto_url, ativo').eq('id', a.atendente_id).maybeSingle()
  if (!at || at.ativo === false) return null
  return { id: a.id, atendenteId: a.atendente_id, nome: a.nome, pausado: a.pausado, atendente: at.nome, foto: at.foto_url ?? null, padrao }
}

/** Erro, travamento ou diagnóstico mandado pelo celular (POST /api/discador/erro). */
export async function registrarErroDoApp(ap: Aparelho, b: any, versao: string | null) {
  const tipos = ['travou', 'chamada_sumiu', 'perdeu_padrao', 'sms_falhou', 'outro']
  const sb = createAdminClient()
  await (sb.from('discador_erros') as any).insert({
    aparelho_id: ap.id,
    tipo: tipos.includes(b?.tipo) ? b.tipo : 'outro',
    mensagem: String(b?.mensagem ?? '').slice(0, 2000) || null,
    detalhe: b?.detalhe && typeof b.detalhe === 'object' ? b.detalhe : {},
    app_versao: versao?.slice(0, 20) ?? null,
  })
}

// ── estado (tela inicial) ────────────────────────────────────────────────────
export async function estadoDoAparelho(ap: Aparelho) {
  const sb = createAdminClient()
  const { ligado, p } = await lerConfig(sb)
  const inicioDia = new Date(); inicioDia.setUTCHours(3, 0, 0, 0)
  if (inicioDia.getTime() > Date.now()) inicioDia.setUTCDate(inicioDia.getUTCDate() - 1)
  const [hoje, fila, pend] = await Promise.all([
    (sb.from('discador_chamadas') as any).select('desfecho').eq('aparelho_id', ap.id).gte('criada_em', inicioDia.toISOString()),
    (sb.from('discador_tarefas') as any).select('id', { count: 'exact', head: true }).eq('status', 'aberta').lte('proxima_em', new Date().toISOString()).not('telefone', 'is', null),
    (sb.from('discador_chamadas') as any).select('id, duracao_s, discador_tarefas!inner(nome, status)')
      .eq('aparelho_id', ap.id).eq('desfecho', 'atendeu').is('resultado', null)
      .gt('encerrou_em', new Date(Date.now() - 24 * 3600_000).toISOString())
      .eq('discador_tarefas.status', 'aberta').order('id', { ascending: false }).limit(1),
  ])
  const h = (hoje.data ?? []) as any[]
  let aviso: string | null = null
  if (!ligado) aviso = 'O discador está desligado no painel.'
  else if (ap.pausado) aviso = 'Este aparelho está pausado no painel.'
  else if (!dentroDoHorario(p.horario)) aviso = `Fora do horário de ligar. Volta ${quandoVolta(proximaAbertura(p.horario))}.`
  const pendente = (pend.data ?? [])[0]
  return {
    vendedora: ap.atendente,
    foto_url: ap.foto,
    aparelho: ap.nome,
    resultado_pendente: pendente
      ? { chamada_id: pendente.id, nome: (pendente.discador_tarefas?.nome ?? '').trim() || 'Cliente', duracao_s: pendente.duracao_s ?? 0 }
      : null,
    pode_ligar: !aviso,
    aviso,
    fila: fila.count ?? 0,
    hoje: { ligacoes: h.filter((c) => c.desfecho && c.desfecho !== 'pulou').length, atendidas: h.filter((c) => c.desfecho === 'atendeu').length },
    horario: textoHorario(p),
    config: configParaApp(p),
  }
}

// ── próxima ligação ──────────────────────────────────────────────────────────
export async function proximaLigacao(ap: Aparelho) {
  const sb = createAdminClient()
  const { ligado, p } = await lerConfig(sb)
  const app = configParaApp(p)
  const esperar = async (motivo: string, s: number) => {
    await (sb.from('discador_aparelhos') as any).update({ estado: 'esperando' }).eq('id', ap.id)
    return { acao: 'esperar', motivo, tentar_em_s: s, config: app }
  }
  if (!ligado) return esperar('O discador está desligado no painel.', 60)
  if (ap.pausado) return esperar('Este aparelho está pausado no painel.', 60)
  if (!dentroDoHorario(p.horario)) {
    const volta = proximaAbertura(p.horario)
    return esperar(`Fora do horário de ligar. Volta ${quandoVolta(volta)}.`, Math.max(30, Math.min(300, Math.round((volta.getTime() - Date.now()) / 1000))))
  }
  // Sem ser o app de telefone padrão, quem disca é o telefone do celular: a
  // atendente não vê a ficha e o app não sabe se atenderam. Não liga.
  if (ap.padrao === false) {
    return esperar('O Discador Ju não é o app de telefone padrão deste celular. Toque em "Usar como app de telefone" e depois em Começar.', 60)
  }
  // Trava para o app antigo (0.1.0), que não conta se é o padrão: em 19/10 ele
  // seguiu discando com as chamadas indo para o telefone da Samsung — 10 erros
  // em 4 min. Duas chamadas seguidas que não chegaram ao app = para 10 min.
  if (ap.padrao === undefined) {
    const { data: ult } = await (sb.from('discador_chamadas') as any).select('desfecho, encerrou_em')
      .eq('aparelho_id', ap.id).not('encerrou_em', 'is', null).order('id', { ascending: false }).limit(2)
    const u = (ult ?? []) as any[]
    if (u.length === 2 && u.every((c) => c.desfecho === 'erro') && Date.now() - new Date(u[0].encerrou_em).getTime() < 10 * 60_000) {
      return esperar('As últimas ligações não chegaram ao app. Confira se o Discador Ju é o app de telefone padrão e atualize o app.', 120)
    }
  }

  // Tenta algumas vezes: a tarefa escolhida pode ter sido paga agora há pouco.
  for (let i = 0; i < 5; i++) {
    const { data: r, error } = await (sb.rpc as any)('discador_proxima', { p_aparelho: ap.id })
    if (error) throw new ErroDiscador('O site não conseguiu montar a fila agora. Tente de novo em instantes.')
    if (r?.acao !== 'ligar') return esperar(r?.motivo === 'fila vazia' ? 'Nenhuma ligação na fila agora.' : (r?.motivo ?? 'Aguarde.'), 60)
    const { data: t } = await (sb.from('discador_tarefas') as any).select('*').eq('id', r.tarefa_id).maybeSingle()
    // Pagou depois que a tarefa nasceu? Sai da fila na hora, sem ligar.
    const { count: pagou } = await (sb.from('checkout_events') as any).select('id', { count: 'exact', head: true })
      .eq('event_type', 'payment_confirmed').ilike('email', t.email).gte('created_at', t.criada_em)
    if (pagou) {
      await (sb.from('discador_chamadas') as any).update({ desfecho: 'pulou', encerrou_em: new Date().toISOString() }).eq('id', r.chamada_id)
      await (sb.from('discador_tarefas') as any).update({ status: 'concluida', resultado: 'comprou', fim_motivo: 'comprou', concluida_em: new Date().toISOString() }).eq('id', t.id)
      continue
    }
    await (sb.from('discador_aparelhos') as any).update({ estado: 'discando' }).eq('id', ap.id)
    return {
      acao: 'ligar', chamada_id: r.chamada_id, telefone: telefoneParaDiscar(t.telefone),
      ficha: await montarFicha(sb, t, p, ap.atendente), config: app,
    }
  }
  return esperar('Nenhuma ligação na fila agora.', 30)
}

/** Link de pagamento: a oferta, com o cupom de 50% se a pessoa recebeu um que ainda vale. */
async function linkDaPessoa(sb: any, t: any): Promise<{ link: string; cupomCents: number | null }> {
  const base = WEB.replace(/^https?:\/\//, '')
  const leadId = t.contexto?.lead_id
  if (leadId) {
    const { data: c } = await (sb.from('cupons') as any).select('codigo, expira_em, ativo, usos, usos_max, valor_cents')
      .ilike('descricao', `%lead ${leadId}%`).order('id', { ascending: false }).limit(1).maybeSingle()
    if (c && c.ativo && new Date(c.expira_em).getTime() > Date.now() && (c.usos_max == null || c.usos < c.usos_max)) {
      return { link: `${base}/oferta?cupom=${c.codigo}`, cupomCents: c.valor_cents ?? null }
    }
  }
  return { link: `${base}/oferta`, cupomCents: null }
}

const INCOMODA: Record<string, string> = { cresc: 'crescimento', queda: 'queda', pontas: 'pontas', frizz: 'frizz', quebra: 'quebra' }

/** "16/10 13:24" no horário de Brasília. */
function quando(iso: string): string {
  const d = new Date(new Date(iso).getTime() - 3 * 3600_000)
  const p2 = (n: number) => String(n).padStart(2, '0')
  return `${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`
}
const TEMPLATE_AMIGAVEL: Record<string, string> = {
  consulta_50off_v1: 'WhatsApp com 50% OFF (cupom de 24 h)',
  consulta_pendente_v1: 'WhatsApp "sua consulta está pendente"',
  diagnostico_quiz_v1: 'WhatsApp "quer o seu diagnóstico?"',
  inscricao_pendente_util_v5: 'WhatsApp "inscrição pendente"',
}
const DESFECHO_AMIGAVEL: Record<string, string> = {
  atendeu: 'atendeu', nao_atendeu: 'não atendeu', ocupado: 'ocupado', recusou: 'recusou', caixa_postal: 'caixa postal',
  erro: 'não completou', pulou: 'pulada', expirou: 'não completou',
}
const RESULTADO_AMIGAVEL: Record<string, string> = Object.fromEntries(RESULTADOS_LIGACAO.map((r) => [r.id, r.rotulo.toLowerCase()]))

/** O que já aconteceu com ela, do mais antigo ao mais novo: o que recebeu, o que respondeu, as ligações anteriores. */
async function historicoDaPessoa(sb: any, t: any): Promise<string[]> {
  const itens: { em: string; txt: string }[] = []
  const leadId = t.contexto?.lead_id
  const [lead, chamadas, sms] = await Promise.all([
    leadId ? (sb.from('wg_quiz_leads') as any).select('created_at, inscricao_wa_enviada_em, inscricao_wa_template, inscricao_wa_erro, respondeu_em, resposta_texto').eq('id', leadId).maybeSingle() : Promise.resolve({ data: null }),
    (sb.from('discador_chamadas') as any).select('criada_em, desfecho, duracao_s, resultado, nota').eq('tarefa_id', t.id).not('encerrou_em', 'is', null).order('id'),
    (sb.from('discador_sms') as any).select('enviado_em, ok').eq('tarefa_id', t.id).eq('ok', true),
  ])
  const l = lead.data as any
  if (l?.created_at) itens.push({ em: l.created_at, txt: 'Fez o quiz' })
  if (l?.inscricao_wa_enviada_em && !l.inscricao_wa_erro) {
    itens.push({ em: l.inscricao_wa_enviada_em, txt: `Recebeu ${TEMPLATE_AMIGAVEL[l.inscricao_wa_template] ?? 'WhatsApp da régua'}` })
  }
  if (l?.respondeu_em) itens.push({ em: l.respondeu_em, txt: `Respondeu no WhatsApp${l.resposta_texto ? `: "${String(l.resposta_texto).slice(0, 80)}"` : ''}` })
  for (const c of (chamadas.data ?? []) as any[]) {
    if (c.desfecho === 'pulou') continue
    const dur = c.desfecho === 'atendeu' && c.duracao_s ? ` (${Math.max(1, Math.round(c.duracao_s / 60))} min)` : ''
    const res = c.resultado ? ` · ${RESULTADO_AMIGAVEL[c.resultado] ?? c.resultado}` : ''
    const nota = c.nota ? ` — "${String(c.nota).slice(0, 100)}"` : ''
    itens.push({ em: c.criada_em, txt: `Ligação: ${DESFECHO_AMIGAVEL[c.desfecho] ?? c.desfecho}${dur}${res}${nota}` })
  }
  for (const m of (sms.data ?? []) as any[]) itens.push({ em: m.enviado_em, txt: 'Recebeu SMS do discador' })
  return itens.sort((a, b) => a.em.localeCompare(b.em)).slice(-10).map((i) => `${quando(i.em)} · ${i.txt}`)
}

const formatarTel = (t?: string | null) => {
  const d = String(t ?? '').replace(/\D/g, '')
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : d
}

async function montarFicha(sb: any, t: any, p: ParametrosDiscador, atendente: string) {
  const [respostas, historico, { link, cupomCents }] = await Promise.all([
    respostasParaFicha(sb, t.contexto?.session_id ?? null, t.email ?? null),
    historicoDaPessoa(sb, t),
    linkDaPessoa(sb, t),
  ])
  const cupom = cupomCents != null
  const valorCents = cupomCents ?? t.contexto?.valor_cents ?? 9700
  const primeiro = (t.nome ?? '').trim().split(/\s+/)[0] ?? ''
  const nomeBonito = primeiro ? primeiro[0].toUpperCase() + primeiro.slice(1).toLowerCase() : ''
  const mensagem = p.mensagem_link.replaceAll('{nome}', nomeBonito).replaceAll('{atendente}', atendente)
    .replaceAll('{vendedora}', atendente).replaceAll('{link}', link).replace(/Oi !/, 'Oi!')
  const incomoda = respostas.find((r) => r.pergunta === 'O que mais incomoda')?.resposta
  const detalhes = [incomoda ? `Incomoda: ${incomoda}` : null, cupom ? 'tem cupom de 50% válido' : null].filter(Boolean).join(' · ')
  return {
    nome: (t.nome ?? '').trim() || 'Cliente sem nome',
    motivo: MOTIVOS[t.motivo as keyof typeof MOTIVOS]?.rotulo ?? t.motivo,
    detalhe: detalhes || null,
    tentativa: t.tentativas + 1,
    tentativas_max: p.tentativas_max,
    situacao: null,
    ja_comprou: false,
    pedido: {
      codigo: 'Consulta', valor: valorCents / 100,
      pagamento: t.motivo === 'pix_nao_pago' ? 'PIX não pago' : t.motivo === 'cartao_recusado' ? 'Cartão recusado' : 'Não chegou a pagar',
      criado_em: t.contexto?.quando ?? t.criada_em,
      itens: ['Consulta com a Tricologista Juliane Cost', ...(cupom ? [`Com o cupom de 50% (R$ ${(valorCents / 100).toFixed(2).replace('.', ',')})`] : [])],
    },
    link_painel: `${ADMIN}/funil?pessoa=${encodeURIComponent(t.email ?? t.telefone ?? '')}`,
    link_pagamento: link,
    mensagem,
    // 0.1.1+: a ficha completa na tela da ligação
    email: t.email ?? null,
    telefone_formatado: formatarTel(t.telefone),
    respostas,
    historico,
  }
}

// ── quem está ligando? (retorno da cliente) ──────────────────────────────────
/**
 * O SMS de quem não atende pede "me liga neste número": quando ela liga de volta,
 * o app pergunta quem é e mostra a ficha dela na chamada recebida. Só acha quem
 * está (ou esteve nos últimos 10 dias) na fila do discador.
 */
export async function quemEstaLigando(ap: Aparelho, telefone: string) {
  const d = String(telefone ?? '').replace(/\D/g, '')
  if (d.length < 8) return { achou: false }
  const sb = createAdminClient()
  const { p } = await lerConfig(sb)
  const { data } = await (sb.from('discador_tarefas') as any).select('*')
    .like('telefone', `%${d.slice(-8)}`)
    .gte('criada_em', new Date(Date.now() - 10 * 86400_000).toISOString())
    .order('status', { ascending: true }) // 'aberta' antes de 'cancelada'/'concluida'
    .order('id', { ascending: false }).limit(1)
  const t = (data ?? [])[0]
  if (!t) return { achou: false }
  const ficha = await montarFicha(sb, t, p, ap.atendente)
  const fim = t.status === 'aberta' ? null : t.fim_motivo === 'comprou' || t.resultado === 'comprou' ? 'Já pagou' : 'Saiu da fila'
  return { achou: true, ficha: { ...ficha, situacao: ['Retornou a ligação', fim].filter(Boolean).join(' · ') } }
}

// ── eventos da chamada ───────────────────────────────────────────────────────
type Evento =
  | { evento: 'discou'; chip?: string } | { evento: 'atendeu' }
  | { evento: 'encerrou'; desfecho?: string; duracao_s?: number }
  | { evento: 'resultado'; resultado: string; nota?: string }
  | { evento: 'sms'; sms_id: number; ok: boolean; erro?: string }

export async function registrarEvento(ap: Aparelho, chamadaId: number, e: Evento) {
  const sb = createAdminClient()
  const agora = new Date().toISOString()
  const { data: ch } = await (sb.from('discador_chamadas') as any)
    .select('id, tarefa_id, atendeu_em, encerrou_em, desfecho, resultado, tentativa').eq('id', chamadaId).eq('aparelho_id', ap.id).maybeSingle()
  if (!ch) throw new ErroDiscador('Esta ligação não foi encontrada no site. Toque em Começar de novo.')

  if (e.evento === 'discou') {
    const chip = String((e as any).chip ?? '').trim().slice(0, 60) || null
    await (sb.from('discador_chamadas') as any).update({ discou_em: agora, ...(chip ? { chip } : {}) }).eq('id', ch.id).is('discou_em', null)
    return { ok: true }
  }
  if (e.evento === 'atendeu') {
    await (sb.from('discador_chamadas') as any).update({ atendeu_em: agora }).eq('id', ch.id).is('atendeu_em', null).is('encerrou_em', null)
    await (sb.from('discador_aparelhos') as any).update({ estado: 'em_ligacao' }).eq('id', ap.id)
    return { ok: true }
  }

  if (e.evento === 'encerrou') {
    if (ch.encerrou_em) return { ok: true }
    let desfecho = String((e as any).desfecho ?? '')
    if (!DESFECHOS.includes(desfecho)) desfecho = ch.atendeu_em ? 'atendeu' : 'nao_atendeu'
    // Caixa postal o Android vê como "atendeu"; só a atendente sabe — o botão dela vale.
    if (desfecho !== 'caixa_postal' && desfecho !== 'pulou' && ch.atendeu_em) desfecho = 'atendeu'
    if (desfecho === 'atendeu' && !ch.atendeu_em) desfecho = 'nao_atendeu'
    const d = Number((e as any).duracao_s)
    const dur = Number.isFinite(d) ? Math.max(0, Math.min(36_000, Math.round(d))) : null
    await (sb.from('discador_chamadas') as any).update({ encerrou_em: agora, desfecho, duracao_s: dur }).eq('id', ch.id)
    await (sb.from('discador_aparelhos') as any).update({ estado: desfecho === 'atendeu' ? 'resultado' : 'parado' }).eq('id', ap.id)
    if (desfecho === 'pulou') {
      // Pular não conta tentativa: volta para a fila daqui a pouco.
      await (sb.from('discador_tarefas') as any).update({ proxima_em: new Date(Date.now() + 30 * 60_000).toISOString() }).eq('id', ch.tarefa_id).eq('status', 'aberta')
    }
    if (SEM_ATENDER.includes(desfecho) && ch.tarefa_id) return { ok: true, ...(await semAtender(sb, ch.tarefa_id, ap)) }
    return { ok: true }
  }

  if (e.evento === 'resultado') {
    const id = String((e as any).resultado ?? '')
    if (!RESULTADOS_LIGACAO.some((r) => r.id === id)) throw new ErroDiscador('Escolha um dos botões para dizer como foi a ligação.')
    if (!ch.atendeu_em || (ch.desfecho && ch.desfecho !== 'atendeu')) throw new ErroDiscador('Esta ligação não foi atendida, então não precisa de resultado.')
    if (ch.resultado) return { ok: true }
    const nota = String((e as any).nota ?? '').trim().slice(0, 1000) || null
    await (sb.from('discador_chamadas') as any).update({ resultado: id, nota, encerrou_em: ch.encerrou_em ?? agora, desfecho: 'atendeu' }).eq('id', ch.id)
    await (sb.from('discador_aparelhos') as any).update({ estado: 'parado' }).eq('id', ap.id)
    if (!ch.tarefa_id) return { ok: true }
    const { p } = await lerConfig(sb)
    const t: any = { atualizada_em: agora, resultado: id, nota, tentativas: ch.tentativa }
    if (id === 'ligar_depois') Object.assign(t, { resultado: null, proxima_em: depoisDe(p.horario, p.ligar_depois_horas).toISOString() })
    else if (id === 'vai_comprar') Object.assign(t, { proxima_em: depoisDe(p.horario, 24).toISOString() }) // confere amanhã
    else if (id === 'sem_decisao') Object.assign(t, { proxima_em: depoisDe(p.horario, 48).toISOString() })
    else if (id === 'comprou') Object.assign(t, { status: 'concluida', fim_motivo: 'comprou', concluida_em: agora })
    else Object.assign(t, { status: 'cancelada', fim_motivo: 'resultado', concluida_em: agora }) // sem interesse / número errado
    await (sb.from('discador_tarefas') as any).update(t).eq('id', ch.tarefa_id).eq('status', 'aberta')
    return { ok: true }
  }
  if (e.evento === 'sms') {
    const ok = !!(e as any).ok
    await (sb.from('discador_sms') as any)
      .update({ ok, erro: ok ? null : (String((e as any).erro ?? '').trim() || 'falhou no celular').slice(0, 300), enviado_em: agora,
        chip: String((e as any).chip ?? '').trim().slice(0, 60) || null })
      .eq('id', Number((e as any).sms_id)).eq('tarefa_id', ch.tarefa_id)
    if (ok) await (sb.from('discador_chamadas') as any).update({ sms_enviado_em: agora }).eq('id', ch.id)
    return { ok: true }
  }
  throw new ErroDiscador('O app mandou algo que o site não conhece. Atualize o app do discador.')
}

/** Sem acento: o SMS fica em GSM-7 (160 caracteres por parte em vez de 70) — sai mais barato no plano. */
const semAcento = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E\n]/g, '')

/**
 * Não atendeu: conta a tentativa, agenda a próxima (ou encerra depois da
 * última) e, se ainda não houve SMS hoje para esse telefone, devolve o SMS
 * para o CELULAR mandar pelo chip.
 */
async function semAtender(sb: any, tarefaId: number, ap: Aparelho) {
  const { p } = await lerConfig(sb)
  const { data: t } = await (sb.from('discador_tarefas') as any).select('*').eq('id', tarefaId).maybeSingle()
  if (!t || t.status !== 'aberta') return {}
  const tentativas = (t.tentativas ?? 0) + 1
  const acabou = tentativas >= p.tentativas_max
  await (sb.from('discador_tarefas') as any).update({
    tentativas, atualizada_em: new Date().toISOString(),
    ...(acabou
      ? { status: 'cancelada', resultado: 'nao_respondeu', fim_motivo: 'tentativas', concluida_em: new Date().toISOString() }
      : { proxima_em: depoisDe(p.horario, p.intervalo_horas).toISOString() }),
  }).eq('id', tarefaId).eq('status', 'aberta')

  if (!p.sms_sem_atender || !t.telefone) return {}
  const inicioDia = new Date(); inicioDia.setUTCHours(3, 0, 0, 0)
  if (inicioDia.getTime() > Date.now()) inicioDia.setUTCDate(inicioDia.getUTCDate() - 1)
  // Conta também os pedidos que o celular ainda não confirmou: nunca 2 no mesmo dia.
  const { count } = await (sb.from('discador_sms') as any).select('id', { count: 'exact', head: true })
    .eq('telefone', t.telefone).gte('enviado_em', inicioDia.toISOString())
  if (count) return {}
  const primeiro = (t.nome ?? '').trim().split(/\s+/)[0] ?? ''
  const nome = primeiro ? primeiro[0].toUpperCase() + primeiro.slice(1).toLowerCase() : ''
  const texto = semAcento(p.sms_texto.replaceAll('{nome}', nome).replaceAll('{atendente}', ap.atendente)
    .replaceAll('{vendedora}', ap.atendente).replaceAll('{link}', (await linkDaPessoa(sb, t)).link).replace(/Oi !/, 'Oi!'))
  const { data: sms } = await (sb.from('discador_sms') as any)
    .insert({ tarefa_id: tarefaId, telefone: t.telefone, texto, ok: false }).select('id').single()
  if (!sms) return {}
  return { sms: { id: sms.id, telefone: telefoneParaDiscar(t.telefone), texto } }
}
