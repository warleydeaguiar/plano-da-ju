/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Discador do Plano da Ju (16/10/2026) — porte do discador da QD
 * (qd-loja/lib/discador.ts). Aqui: configuração, horário de expediente e o
 * MOTOR que monta a fila de ligações de recuperação de venda.
 *
 * O painel manda, o app só pergunta: tudo que decide quem é chamado, quando e
 * quantas vezes vem de `discador_config.parametros` (editável em /discador).
 */

export type MotivoLigacao = 'pix_nao_pago' | 'cartao_recusado' | 'checkout_abandonado' | 'quiz_sem_checkout'

export const MOTIVOS: Record<MotivoLigacao, { rotulo: string; prioridade: number }> = {
  pix_nao_pago:        { rotulo: 'Gerou o PIX e não pagou',           prioridade: 1 },
  cartao_recusado:     { rotulo: 'Cartão recusado / não concluído',    prioridade: 1 },
  checkout_abandonado: { rotulo: 'Abriu o pagamento e saiu',           prioridade: 2 },
  quiz_sem_checkout:   { rotulo: 'Fez o quiz e não abriu o pagamento', prioridade: 3 },
}

export type Horario = { dias: number[]; inicio: string; fim: string } // dias: 0=dom … 6=sáb

export type ParametrosDiscador = {
  toque_segundos: number
  pausa_segundos: number
  tentativas_max: number
  intervalo_horas: number          // entre tentativas (5 em 5 dias → ~1 por dia)
  ligar_depois_horas: number       // resultado "Ligar depois"
  espera_pix_min: number
  espera_cartao_min: number
  espera_checkout_min: number
  espera_quiz_min: number
  janela_dias: number              // até quantos dias depois do evento a tarefa ainda nasce
  limite_quiz_dia: number          // teto de tarefas novas do quiz por dia
  horario: Horario
  sms_sem_atender: boolean
  sms_texto: string
  mensagem_link: string
  ligado_desde: string | null      // regra nova não volta ao passado
}

export const DISCADOR_PADRAO: ParametrosDiscador = {
  toque_segundos: 25,
  pausa_segundos: 5,
  tentativas_max: 5,
  intervalo_horas: 20,
  ligar_depois_horas: 3,
  espera_pix_min: 15,
  espera_cartao_min: 15,
  espera_checkout_min: 120,
  espera_quiz_min: 120,
  janela_dias: 5,
  limite_quiz_dia: 30,
  horario: { dias: [1, 2, 3, 4, 5], inicio: '08:00', fim: '17:00' },
  sms_sem_atender: true,
  sms_texto: 'Oi {nome}! Aqui é a {atendente}, da equipe da Juliane Cost. Te liguei sobre a sua consulta. Finalize aqui: {link}',
  mensagem_link: 'Oi {nome}! Aqui é a {atendente}, da equipe da Juliane Cost 💛 Para finalizar a sua consulta: {link}',
  ligado_desde: null,
}

export async function lerConfig(sb: any): Promise<{ ligado: boolean; motorLigado: boolean; p: ParametrosDiscador }> {
  const { data } = await (sb.from('discador_config') as any).select('ligado, motor_ligado, parametros').eq('id', 1).maybeSingle()
  const p = { ...DISCADOR_PADRAO, ...(data?.parametros ?? {}) } as ParametrosDiscador
  p.horario = { ...DISCADOR_PADRAO.horario, ...(data?.parametros?.horario ?? {}) }
  return { ligado: !!data?.ligado, motorLigado: !!data?.motor_ligado, p }
}

// ── Horário de expediente (Brasília, UTC-3, sem horário de verão) ────────────
const BR_MS = 3 * 3600_000
function minutos(hhmm: string): number { const [h, m] = hhmm.split(':').map(Number); return (h || 0) * 60 + (m || 0) }
function partesBR(d: Date) { const b = new Date(d.getTime() - BR_MS); return { dia: b.getUTCDay(), min: b.getUTCHours() * 60 + b.getUTCMinutes(), b } }

export function dentroDoHorario(h: Horario, d = new Date()): boolean {
  const { dia, min } = partesBR(d)
  return h.dias.includes(dia) && min >= minutos(h.inicio) && min < minutos(h.fim)
}

/** Próximo instante em que o expediente está aberto, a partir de `d`. */
export function proximaAbertura(h: Horario, d = new Date()): Date {
  if (dentroDoHorario(h, d)) return d
  const ini = minutos(h.inicio)
  for (let i = 0; i < 8; i++) {
    const b = new Date(d.getTime() - BR_MS)
    b.setUTCDate(b.getUTCDate() + i)
    b.setUTCHours(Math.floor(ini / 60), ini % 60, 0, 0)
    const real = new Date(b.getTime() + BR_MS)
    if (real > d && h.dias.includes(b.getUTCDay())) return real
  }
  return new Date(d.getTime() + 24 * 3600_000)
}

/** "Depois de N horas", empurrado para dentro do expediente. */
export function depoisDe(h: Horario, horas: number, d = new Date()): Date {
  return proximaAbertura(h, new Date(d.getTime() + horas * 3600_000))
}

// ── Telefone ─────────────────────────────────────────────────────────────────
/** Só dígitos com DDD (10–11). Devolve null se não der para discar. */
export function telefoneNacional(bruto?: string | null): string | null {
  let d = String(bruto ?? '').replace(/\D/g, '')
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2)
  if (d.length < 10 || d.length > 11) return null
  return d
}
export function telefoneParaDiscar(nacional: string): string { return `+55${nacional}` }

/** Equipe, testes e e-mails internos nunca viram tarefa. */
function ehTesteOuEquipe(email: string, nome?: string | null): boolean {
  return /teste|test@|@exemplo\.|julianecost\.com$|quadrosdecorativos|grupokonor/i.test(email)
    || /\bteste\b/i.test(nome ?? '')
}

// ── Motor ────────────────────────────────────────────────────────────────────
type Candidato = { email: string; motivo: MotivoLigacao; quando: string; valor?: number | null }

export type ResultadoMotor = {
  seco: boolean
  ligado: boolean
  encerradas: { comprou: number; cortesia: number; optout: number; expiradas: number }
  novas: Record<MotivoLigacao, number>
  semTelefone: number
}

/**
 * Uma passagem do robô (cron a cada 5 min):
 *  1. encerra a tarefa de quem comprou, ganhou cortesia ou pediu para sair;
 *  2. cria as tarefas novas, por ordem de urgência, uma por pessoa.
 * `seco` = só conta (botão Simular): não grava nada.
 */
export async function processarFila(sb: any, { seco = false } = {}): Promise<ResultadoMotor> {
  const { motorLigado, p } = await lerConfig(sb)
  const agora = Date.now()
  const out: ResultadoMotor = {
    seco, ligado: motorLigado,
    encerradas: { comprou: 0, cortesia: 0, optout: 0, expiradas: 0 },
    novas: { pix_nao_pago: 0, cartao_recusado: 0, checkout_abandonado: 0, quiz_sem_checkout: 0 },
    semTelefone: 0,
  }

  // 1) Encerrar tarefas abertas que não fazem mais sentido.
  const { data: abertas } = await (sb.from('discador_tarefas') as any)
    .select('id, email, telefone, criada_em').eq('status', 'aberta').limit(2000)
  const listaAbertas = (abertas ?? []) as any[]
  if (listaAbertas.length) {
    const emails = [...new Set(listaAbertas.map((t) => t.email.toLowerCase()))]
    const [pagos, perfis, optout, acessoTel] = await Promise.all([
      emailsQuePagaram(sb, emails, new Date(agora - 40 * 86400_000).toISOString()),
      perfisPorEmail(sb, emails),
      telefonesOptout(sb),
      // Falhou aqui? Segue encerrando pelo e-mail (quem pagou nunca fica na fila por erro desta conferência).
      telefonesComAcesso(sb, listaAbertas.map((t) => chaveTelefone(t.telefone))).catch(() => new Map<string, 'pago' | 'cortesia'>()),
    ])
    for (const t of listaAbertas) {
      const e = t.email.toLowerCase()
      const perfil = perfis.get(e)
      const peloTel = acessoTel.get(chaveTelefone(t.telefone))
      let fim: string | null = null
      if (pagos.has(e) || (perfil && perfil.subscription_status === 'active' && perfil.subscription_type !== 'parceria' && perfil.subscription_type !== 'none')) fim = 'comprou'
      else if (perfil?.subscription_type === 'parceria' || peloTel === 'cortesia') fim = 'cortesia'
      else if (peloTel === 'pago') fim = 'comprou'
      else if (t.telefone && optout.has(t.telefone.slice(-8))) fim = 'optout'
      else if (new Date(t.criada_em).getTime() < agora - (p.janela_dias + 3) * 86400_000) fim = 'expirou'
      if (!fim) continue
      if (fim === 'comprou') out.encerradas.comprou++
      else if (fim === 'cortesia') out.encerradas.cortesia++
      else if (fim === 'optout') out.encerradas.optout++
      else out.encerradas.expiradas++
      if (!seco) {
        await (sb.from('discador_tarefas') as any).update({
          status: fim === 'comprou' ? 'concluida' : 'cancelada',
          resultado: fim === 'comprou' ? 'comprou' : null,
          fim_motivo: fim, concluida_em: new Date().toISOString(), atualizada_em: new Date().toISOString(),
        }).eq('id', t.id).eq('status', 'aberta')
      }
    }
  }

  // Desligado: só encerra (nunca deixa quem comprou na fila) e, no Simular, conta.
  if (!motorLigado && !seco) return out

  // 2) Candidatos. Regra nova não volta ao passado: só eventos depois de ligar.
  const piso = Math.max(agora - p.janela_dias * 86400_000, p.ligado_desde ? new Date(p.ligado_desde).getTime() : 0)
  const desde = new Date(seco && !motorLigado ? agora - p.janela_dias * 86400_000 : piso).toISOString()
  const candidatos: Candidato[] = []

  const { data: evs } = await (sb.from('checkout_events') as any)
    .select('email, event_type, amount_cents, created_at')
    .in('event_type', ['pix_generated', 'card_submitted', 'payment_failed', 'checkout_initiated', 'payment_confirmed'])
    .gte('created_at', desde).not('email', 'is', null).order('created_at', { ascending: true }).limit(10000)
  const porEmail = new Map<string, any[]>()
  for (const e of (evs ?? []) as any[]) {
    const k = String(e.email).toLowerCase().trim()
    if (!porEmail.has(k)) porEmail.set(k, [])
    porEmail.get(k)!.push(e)
  }
  for (const [email, lista] of porEmail) {
    if (lista.some((e) => e.event_type === 'payment_confirmed')) continue
    const ultimo = (tipo: string[]) => [...lista].reverse().find((e) => tipo.includes(e.event_type))
    const pix = ultimo(['pix_generated'])
    const cartao = ultimo(['payment_failed', 'card_submitted'])
    const checkout = ultimo(['checkout_initiated'])
    if (pix && agora - new Date(pix.created_at).getTime() >= p.espera_pix_min * 60_000) {
      candidatos.push({ email, motivo: 'pix_nao_pago', quando: pix.created_at, valor: pix.amount_cents })
    } else if (!pix && cartao && agora - new Date(cartao.created_at).getTime() >= p.espera_cartao_min * 60_000) {
      candidatos.push({ email, motivo: 'cartao_recusado', quando: cartao.created_at, valor: cartao.amount_cents })
    } else if (!pix && !cartao && checkout && agora - new Date(checkout.created_at).getTime() >= p.espera_checkout_min * 60_000) {
      candidatos.push({ email, motivo: 'checkout_abandonado', quando: checkout.created_at, valor: checkout.amount_cents })
    }
  }

  // Quiz sem checkout: leads que nunca abriram o pagamento.
  const { data: leads } = await (sb.from('wg_quiz_leads') as any)
    .select('email, created_at')
    .eq('quiz_slug', 'plano-capilar') // o quiz dos grupos (fashion-gold) é outro funil: não liga
    .gte('created_at', desde)
    .lte('created_at', new Date(agora - p.espera_quiz_min * 60_000).toISOString())
    .not('phone', 'is', null).not('email', 'is', null)
    .order('created_at', { ascending: false }).limit(3000)
  const jaNoCheckout = new Set(porEmail.keys())
  const vistos = new Set(candidatos.map((c) => c.email))
  for (const l of (leads ?? []) as any[]) {
    const e = String(l.email).toLowerCase().trim()
    if (vistos.has(e) || jaNoCheckout.has(e)) continue
    vistos.add(e)
    candidatos.push({ email: e, motivo: 'quiz_sem_checkout', quando: l.created_at })
  }
  if (!candidatos.length) return out

  // Travas: já tem tarefa (aberta ou recente), comprou antes, cortesia, opt-out, teste.
  const emails = candidatos.map((c) => c.email)
  const [comTarefa, pagos, perfis, optout, contatos] = await Promise.all([
    emailsComTarefaRecente(sb, emails, p.janela_dias + 3),
    emailsQuePagaram(sb, emails, new Date(agora - 40 * 86400_000).toISOString()),
    perfisPorEmail(sb, emails),
    telefonesOptout(sb),
    contatosPorEmail(sb, emails),
  ])

  // Teto diário do quiz (o grupo mais numeroso e o menos quente).
  const hojeBR = new Date(agora - BR_MS); hojeBR.setUTCHours(0, 0, 0, 0)
  const { count: quizHoje } = await (sb.from('discador_tarefas') as any)
    .select('id', { count: 'exact', head: true }).eq('motivo', 'quiz_sem_checkout')
    .gte('criada_em', new Date(hojeBR.getTime() + BR_MS).toISOString())
  let vagasQuiz = Math.max(0, p.limite_quiz_dia - (quizHoje ?? 0))

  // Pelo telefone também: cortesia/compra feita com OUTRO e-mail não entra na fila.
  const acessoTel = await telefonesComAcesso(sb, candidatos.map((c) => {
    const ct = contatos.get(c.email); return chaveTelefone(ct?.telefone ?? perfis.get(c.email)?.phone)
  }))

  const ordem = [...candidatos].sort((a, b) => MOTIVOS[a.motivo].prioridade - MOTIVOS[b.motivo].prioridade)
  for (const c of ordem) {
    if (comTarefa.has(c.email) || pagos.has(c.email)) continue
    const perfil = perfis.get(c.email)
    if (perfil && perfil.subscription_type && perfil.subscription_type !== 'none') continue // pago ou cortesia
    const ct = contatos.get(c.email)
    if (ehTesteOuEquipe(c.email, ct?.nome)) continue
    const tel = telefoneNacional(ct?.telefone ?? perfil?.phone)
    if (!tel) { out.semTelefone++; continue }
    if (optout.has(tel.slice(-8))) continue
    if (acessoTel.has(chaveTelefone(tel))) continue // já teve acesso (pago ou cortesia) com outro e-mail
    if (c.motivo === 'quiz_sem_checkout') { if (vagasQuiz <= 0) continue; vagasQuiz-- }

    out.novas[c.motivo]++
    if (seco) continue
    const { error } = await (sb.from('discador_tarefas') as any).insert({
      email: c.email, nome: ct?.nome ?? perfil?.full_name ?? null, telefone: tel,
      motivo: c.motivo, prioridade: MOTIVOS[c.motivo].prioridade,
      contexto: { quando: c.quando, valor_cents: c.valor ?? null, lead_id: ct?.lead_id ?? null, session_id: ct?.session_id ?? null },
      proxima_em: proximaAbertura(p.horario).toISOString(),
    })
    if (error && !/duplicate|unique/i.test(error.message)) console.error('[discador] criar tarefa', error.message)
  }
  return out
}

// ── Consultas auxiliares ─────────────────────────────────────────────────────
/** DDD + 8 últimos dígitos (ignora 55 e o nono dígito) — igual a apps/web/lib/acesso-lead.ts. */
export function chaveTelefone(bruto?: string | null): string {
  let d = String(bruto ?? '').replace(/\D/g, '')
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2)
  return d.length >= 10 ? d.slice(0, 2) + d.slice(-8) : ''
}

/** Telefones que já tiveram acesso (pago ou cortesia, ativo ou vencido). Erro = ninguém liga (fail-closed). */
async function telefonesComAcesso(sb: any, chaves: string[]): Promise<Map<string, 'pago' | 'cortesia'>> {
  const m = new Map<string, 'pago' | 'cortesia'>()
  const lista = [...new Set(chaves.filter(Boolean))]
  for (let i = 0; i < lista.length; i += 500) {
    const { data, error } = await (sb.rpc as any)('discador_telefones_com_acesso', { p_chaves: lista.slice(i, i + 500) })
    if (error) throw new Error(`discador_telefones_com_acesso: ${error.message}`)
    for (const r of (data ?? []) as any[]) if (m.get(r.chave) !== 'cortesia') m.set(r.chave, r.tipo)
  }
  return m
}

async function emailsQuePagaram(sb: any, emails: string[], desde: string): Promise<Set<string>> {
  const s = new Set<string>()
  for (let i = 0; i < emails.length; i += 200) {
    const { data } = await (sb.from('checkout_events') as any).select('email')
      .eq('event_type', 'payment_confirmed').in('email', emails.slice(i, i + 200)).gte('created_at', desde)
    for (const r of (data ?? []) as any[]) s.add(String(r.email).toLowerCase().trim())
  }
  return s
}

async function perfisPorEmail(sb: any, emails: string[]): Promise<Map<string, any>> {
  const m = new Map<string, any>()
  for (let i = 0; i < emails.length; i += 200) {
    const { data } = await (sb.from('profiles') as any)
      .select('email, full_name, phone, subscription_type, subscription_status').in('email', emails.slice(i, i + 200))
    for (const r of (data ?? []) as any[]) m.set(String(r.email).toLowerCase().trim(), r)
  }
  return m
}

async function contatosPorEmail(sb: any, emails: string[]): Promise<Map<string, { nome: string | null; telefone: string | null; lead_id: string | null; session_id: string | null }>> {
  const m = new Map<string, any>()
  for (let i = 0; i < emails.length; i += 200) {
    const { data } = await (sb.from('wg_quiz_leads') as any)
      .select('id, email, name, phone, session_id, created_at').in('email', emails.slice(i, i + 200))
      .order('created_at', { ascending: false })
    for (const r of (data ?? []) as any[]) {
      const k = String(r.email).toLowerCase().trim()
      if (!m.has(k)) m.set(k, { nome: r.name, telefone: r.phone, lead_id: r.id, session_id: r.session_id })
    }
  }
  return m
}

async function emailsComTarefaRecente(sb: any, emails: string[], dias: number): Promise<Set<string>> {
  const s = new Set<string>()
  const desde = new Date(Date.now() - dias * 86400_000).toISOString()
  for (let i = 0; i < emails.length; i += 200) {
    const { data } = await (sb.from('discador_tarefas') as any).select('email, status, criada_em')
      .in('email', emails.slice(i, i + 200))
    for (const r of (data ?? []) as any[]) {
      if (r.status === 'aberta' || r.criada_em >= desde) s.add(String(r.email).toLowerCase().trim())
    }
  }
  return s
}

/** Quem pediu para não receber mensagens (opt-out do WhatsApp) também não recebe ligação. */
async function telefonesOptout(sb: any): Promise<Set<string>> {
  const s = new Set<string>()
  const { data } = await (sb.from('wa_optout') as any).select('final8, telefone').limit(20000)
  for (const r of (data ?? []) as any[]) {
    const f = String(r.final8 ?? '').replace(/\D/g, '') || String(r.telefone ?? '').replace(/\D/g, '').slice(-8)
    if (f.length >= 8) s.add(f.slice(-8))
  }
  return s
}
