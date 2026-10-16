/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * "O que essa pessoa recebeu?" — junta, em ordem, tudo o que o sistema fez com
 * UMA cliente (por e-mail ou telefone): quiz, checkout, WhatsApp, SMS, e-mails,
 * ligações do discador. Usado pelo admin /funil (busca no topo).
 *
 * Alguns envios não deixam registro próprio (e-mail e SMS do PIX saem junto com
 * o PIX; o 2º/3º SMS só guardam a contagem) — esses aparecem marcados como
 * "deduzido".
 */
import { createAdminClient } from '@/lib/supabase'
import { buildPersonalizationVars, fillRichTemplate } from '@/lib/email-personalization'
import { injectUnsubscribe } from '@/lib/email-tracking'
import type { Canal } from './mapa'
import type { PreviaPronta } from './dados'

export type Evento = {
  quando: string
  canal: Canal
  titulo: string
  detalhe?: string
  /** Chave de uma prévia do mapa (texto genérico, com a "Maria" de exemplo). */
  previa?: string
  /** Prévia já montada para ESTA pessoa (texto real que ela recebeu). */
  previaPropria?: PreviaPronta
  deduzido?: boolean
  /** Algo que ela fez (não que recebeu). */
  dela?: boolean
}
export type Pessoa = { nome: string | null; emails: string[]; telefones: string[]; selos: string[] }

const MOTIVO: Record<string, string> = {
  pix_nao_pago: 'PIX não pago', cartao_recusado: 'cartão recusado',
  checkout_abandonado: 'abriu o pagamento e saiu', quiz_sem_checkout: 'fez o quiz e não abriu o pagamento',
}
const DESFECHO: Record<string, string> = {
  atendeu: 'atendeu', nao_atendeu: 'não atendeu', ocupado: 'ocupado', recusou: 'recusou a ligação',
  caixa_postal: 'caixa postal', erro: 'erro ao ligar', pulou: 'pulada pela atendente', expirou: 'ficou sem fim (expirou)',
}
const RESULTADO: Record<string, string> = {
  vai_comprar: 'vai pagar', ligar_depois: 'ligar depois', sem_decisao: 'vai pensar', comprou: 'já pagou',
  sem_interesse: 'sem interesse', contato_invalido: 'número errado',
}
const PULO_WA: Record<string, string> = {
  ja_comprou: 'já tinha comprado', ja_cortesia: 'é cortesia', bloqueou: 'tinha pedido para não receber', sem_telefone: 'sem telefone',
}
const brl = (c?: number | null) => c ? (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''
const final8 = (t: string) => t.replace(/\D/g, '').slice(-8)

export async function buscarPessoa(busca: string): Promise<{ pessoa: Pessoa; eventos: Evento[] } | { erro: string }> {
  const q = busca.trim()
  const sb = createAdminClient()
  const digitos = q.replace(/\D/g, '')
  const porEmail = q.includes('@')
  if (!porEmail && digitos.length < 8) return { erro: 'Digite um e-mail completo ou um telefone com DDD.' }

  // 1) Quem é: junta e-mails e telefones dos leads e perfis que batem.
  const [leadsA, perfisA] = await Promise.all([
    porEmail
      ? (sb.from('wg_quiz_leads') as any).select('*').ilike('email', q).order('created_at')
      : (sb.from('wg_quiz_leads') as any).select('*').like('phone', `%${final8(digitos)}`).order('created_at'),
    porEmail
      ? (sb.from('profiles') as any).select('*').ilike('email', q)
      : (sb.from('profiles') as any).select('*').like('phone', `%${final8(digitos)}`),
  ])
  const emails = new Set<string>()
  const telefones = new Set<string>()
  for (const r of [...(leadsA.data ?? []), ...(perfisA.data ?? [])] as any[]) {
    if (r.email) emails.add(String(r.email).toLowerCase().trim())
    if (r.phone) telefones.add(String(r.phone))
  }
  if (porEmail) emails.add(q.toLowerCase())
  if (!emails.size && !telefones.size) return { erro: 'Ninguém encontrado com esse e-mail ou telefone.' }
  const listaEmails = [...emails]
  const finais = [...new Set([...telefones].map(final8).filter((f) => f.length === 8))]

  // Completa com os leads/perfis dos outros e-mails da mesma pessoa.
  const [leadsB, perfisB, eventosCk, envios, tarefas, optout] = await Promise.all([
    (sb.from('wg_quiz_leads') as any).select('*').in('email', listaEmails).order('created_at'),
    (sb.from('profiles') as any).select('*').in('email', listaEmails),
    (sb.from('checkout_events') as any).select('event_type, created_at, amount_cents, payment_type, metadata').in('email', listaEmails).order('created_at').limit(500),
    (sb.from('wg_email_sends') as any).select('sequence_id, campaign_id, subject, status, sent_at, updated_at, opened_at, clicked_at, error_message').in('to_email', listaEmails).order('sent_at').limit(300),
    (sb.from('discador_tarefas') as any).select('id, motivo, status, criada_em, concluida_em, fim_motivo, resultado, nota').in('email', listaEmails),
    finais.length ? (sb.from('wa_optout') as any).select('criado_em, origem').in('final8', finais) : Promise.resolve({ data: [] }),
  ])
  const porId = <T extends { id: any }>(a: T[]) => [...new Map(a.map((x) => [x.id, x])).values()]
  const leads = porId([...(leadsA.data ?? []), ...(leadsB.data ?? [])] as any[])
  const perfis = porId([...(perfisA.data ?? []), ...(perfisB.data ?? [])] as any[])
  const idsTarefas = ((tarefas.data ?? []) as any[]).map((t) => t.id)
  const [chamadas, smsDisc] = idsTarefas.length
    ? await Promise.all([
      (sb.from('discador_chamadas') as any).select('tarefa_id, tentativa, criada_em, desfecho, duracao_s, resultado, nota').in('tarefa_id', idsTarefas).order('criada_em'),
      (sb.from('discador_sms') as any).select('texto, ok, erro, enviado_em').in('tarefa_id', idsTarefas),
    ])
    : [{ data: [] }, { data: [] }]

  const ev: Evento[] = []
  const add = (e: Evento | null | undefined) => { if (e && e.quando) ev.push(e) }

  // 2) Quiz e régua de WhatsApp
  for (const l of leads) {
    const funil = l.quiz_slug === 'fashion-gold' ? 'quiz dos grupos (Ybera)' : 'quiz da consulta'
    add({ quando: l.created_at, canal: 'pagina', titulo: `Fez o ${funil}`, dela: true })
    if (l.inscricao_wa_enviada_em) {
      if (l.inscricao_wa_erro) {
        add({ quando: l.inscricao_wa_enviada_em, canal: 'sistema', titulo: 'Régua de WhatsApp: não enviada',
          detalhe: PULO_WA[l.inscricao_wa_erro] ?? `motivo: ${l.inscricao_wa_erro}` })
      } else {
        add({ quando: l.inscricao_wa_enviada_em, canal: 'whatsapp', titulo: 'WhatsApp da régua do lead',
          detalhe: l.inscricao_wa_template ?? undefined, previa: l.inscricao_wa_template ? `wa:${l.inscricao_wa_template}` : undefined })
      }
    }
    if (l.respondeu_em) add({ quando: l.respondeu_em, canal: 'whatsapp', titulo: 'Ela respondeu no WhatsApp', detalhe: l.resposta_texto ? `"${String(l.resposta_texto).slice(0, 160)}"` : l.resposta_tipo, dela: true })
    if (l.desconto_enviado_em) {
      if (l.grupo_controle) add({ quando: l.desconto_enviado_em, canal: 'sistema', titulo: 'Ficou no grupo de controle do cupom', detalhe: 'Não recebe o WhatsApp com cupom (1 em cada 5, para medir).' })
      else if (!['cortesia', 'recusa', 'bloqueio', 'automatica'].includes(l.resposta_tipo)) {
        add({ quando: l.desconto_enviado_em, canal: 'whatsapp', titulo: 'WhatsApp com cupom', previa: 'web:wa_desconto', deduzido: true,
          detalhe: 'Saiu da fila do cupom nesse momento (enviado, ou pulado por já ter acesso).' })
      }
    }
  }

  // 3) Checkout (só o 1º de cada tipo por dia, para não poluir)
  const vistos = new Set<string>()
  for (const c of (eventosCk.data ?? []) as any[]) {
    const dia = String(c.created_at).slice(0, 10)
    const t = c.event_type
    if (t === 'offer_viewed' || t === 'checkout_initiated' || t === 'vsl_play') {
      if (vistos.has(t + dia)) continue
      vistos.add(t + dia)
      add({ quando: c.created_at, canal: 'pagina', dela: true,
        titulo: t === 'offer_viewed' ? 'Abriu a oferta' : t === 'vsl_play' ? 'Deu play no vídeo' : 'Abriu o pagamento' })
    } else if (t === 'pix_generated') {
      add({ quando: c.created_at, canal: 'sistema', titulo: `Gerou um PIX ${brl(c.amount_cents)}`.trim(), dela: true })
      add({ quando: c.created_at, canal: 'email', titulo: 'E-mail com o código do PIX', previa: 'web:email_pix', deduzido: true, detalhe: 'Sai junto com o PIX novo (não fica registro).' })
      add({ quando: c.created_at, canal: 'sms', titulo: 'SMS "seu PIX foi gerado"', previa: 'web:sms_pix_1', deduzido: true, detalhe: 'Sai junto com o PIX novo, se houver telefone (não fica registro).' })
    } else if (t === 'card_submitted') {
      add({ quando: c.created_at, canal: 'sistema', titulo: `Tentou pagar no cartão ${brl(c.amount_cents)}`.trim(), dela: true })
    } else if (t === 'payment_failed') {
      add({ quando: c.created_at, canal: 'sistema', titulo: 'Pagamento recusado', detalhe: c.metadata?.reason ?? c.metadata?.status ?? undefined })
    } else if (t === 'payment_confirmed') {
      add({ quando: c.created_at, canal: 'sistema', titulo: `Pagou ${brl(c.amount_cents)}`.trim(), detalhe: c.payment_type ?? undefined })
    }
  }

  // 4) Perfil: ativação, WhatsApp/SMS/e-mail ligados ao pagamento e ao plano
  for (const p of perfis) {
    if (p.subscription_activated_at) {
      add({ quando: p.subscription_activated_at, canal: 'sistema',
        titulo: p.subscription_type === 'parceria' ? 'Cortesia ativada' : 'Acesso ativado' })
    }
    if (p.boas_vindas_wa_em) add({ quando: p.boas_vindas_wa_em, canal: 'whatsapp', titulo: 'WhatsApp "acesso liberado"', previa: 'wa:acesso_plano_v2' })
    if (p.pix_recovery_sent_at) add({ quando: p.pix_recovery_sent_at, canal: 'whatsapp', titulo: 'WhatsApp "PIX pendente"', previa: 'wa:pix_recuperacao_v2', deduzido: true, detalhe: 'Marcado nesse momento: enviado, ou pulado (pagou, bloqueou, passou dos 40 min).' })
    if ((p.pix_sms_count ?? 0) >= 2 && p.pix_sms_last_at) {
      add({ quando: p.pix_sms_last_at, canal: 'sms', titulo: `SMS do PIX — ${p.pix_sms_count}º toque`, previa: p.pix_sms_count >= 3 ? 'web:sms_pix_3' : 'web:sms_pix_2', deduzido: true,
        detalhe: p.pix_sms_count >= 3 ? 'O 2º toque saiu ~48 h antes deste.' : undefined })
    }
    if (p.plano_liberado_em) add({ quando: p.plano_liberado_em, canal: 'sistema', titulo: 'Plano liberado', detalhe: p.plano_liberado_por ?? undefined })
    if (p.plan_delivered_email_sent_at) add({ quando: p.plan_delivered_email_sent_at, canal: 'email', titulo: 'E-mail "plano liberado"', previa: 'admin:email_plano_liberado' })
    if (p.plan_sms_sent_at) add({ quando: p.plan_sms_sent_at, canal: 'sms', titulo: 'SMS "plano pronto"', previa: 'web:sms_plano_pronto' })
  }

  // 5) E-mails da régua e campanhas — com o texto montado PARA ELA
  const seqIds = [...new Set(((envios.data ?? []) as any[]).map((e) => e.sequence_id).filter(Boolean))]
  const { data: seqs } = seqIds.length
    ? await (sb.from('wg_email_sequences') as any).select('id, name, subject, html_body').in('id', seqIds)
    : { data: [] }
  const seqPorId = new Map(((seqs ?? []) as any[]).map((s) => [s.id, s]))
  const leadBase = leads[leads.length - 1] ?? (perfis[0] ? { name: perfis[0].full_name, email: perfis[0].email } : null)
  const vars = leadBase ? await buildPersonalizationVars(sb as any, { name: leadBase.name, email: leadBase.email, session_id: leadBase.session_id }) : null
  for (const e of (envios.data ?? []) as any[]) {
    const s = e.sequence_id ? seqPorId.get(e.sequence_id) : null
    const st = e.status === 'sent'
      ? [e.opened_at ? 'abriu' : 'não abriu', e.clicked_at ? 'clicou' : null].filter(Boolean).join(' · ')
      : e.status === 'skipped' ? `não enviado (${e.error_message ?? 'pulado'})` : e.status === 'error' ? `erro: ${String(e.error_message ?? '').slice(0, 80)}` : e.status
    add({
      quando: e.sent_at ?? e.updated_at, canal: 'email',
      titulo: s ? `E-mail "${s.name}"` : e.campaign_id ? 'E-mail de campanha' : 'E-mail',
      detalhe: [e.subject, st].filter(Boolean).join(' — '),
      previaPropria: s && vars ? {
        canal: 'email', fonte: `Régua "${s.name}", montada com os dados dela (versão atual do texto).`,
        assunto: e.subject ?? fillRichTemplate(s.subject ?? '', vars),
        html: injectUnsubscribe(fillRichTemplate(s.html_body ?? '', vars), e.to_email ?? listaEmails[0]),
      } : undefined,
    })
  }

  // 6) Discador: fila, ligações e SMS pelo chip (com o texto que saiu)
  for (const t of (tarefas.data ?? []) as any[]) {
    add({ quando: t.criada_em, canal: 'sistema', titulo: 'Entrou na fila de ligações', detalhe: MOTIVO[t.motivo] ?? t.motivo })
    if (t.concluida_em) add({ quando: t.concluida_em, canal: 'sistema', titulo: 'Saiu da fila de ligações', detalhe: [t.fim_motivo, t.resultado && RESULTADO[t.resultado]].filter(Boolean).join(' · ') })
  }
  for (const c of (chamadas.data ?? []) as any[]) {
    const dur = c.duracao_s ? ` · ${Math.floor(c.duracao_s / 60)}min${String(c.duracao_s % 60).padStart(2, '0')}s` : ''
    add({ quando: c.criada_em, canal: 'ligacao', titulo: `Ligação (tentativa ${c.tentativa}) — ${DESFECHO[c.desfecho] ?? 'em andamento'}${dur}`,
      detalhe: [c.resultado && `resultado: ${RESULTADO[c.resultado] ?? c.resultado}`, c.nota && `"${c.nota}"`].filter(Boolean).join(' · ') || undefined })
  }
  for (const s of (smsDisc.data ?? []) as any[]) {
    add({ quando: s.enviado_em, canal: 'sms', titulo: s.ok ? 'SMS pelo chip (não atendeu)' : 'SMS pelo chip — falhou', detalhe: s.ok ? undefined : s.erro ?? undefined,
      previaPropria: { canal: 'sms', texto: s.texto, fonte: 'Texto exato que o celular da atendente mandou.' } })
  }
  for (const o of (optout.data ?? []) as any[]) add({ quando: o.criado_em, canal: 'whatsapp', titulo: 'Pediu para não receber mais mensagens', dela: true, detalhe: o.origem ?? undefined })

  ev.sort((a, b) => new Date(a.quando).getTime() - new Date(b.quando).getTime())

  const perfil = perfis[0]
  const selos: string[] = []
  if (perfis.some((p) => p.subscription_type === 'parceria')) selos.push('Cortesia')
  else if (perfis.some((p) => p.subscription_status === 'active')) selos.push('Cliente ativa')
  else if (ev.some((e) => e.titulo.startsWith('Pagou'))) selos.push('Pagou')
  else selos.push('Não comprou')
  if ((optout.data ?? []).length) selos.push('Bloqueou WhatsApp')
  if (((tarefas.data ?? []) as any[]).some((t) => t.status === 'aberta')) selos.push('Na fila do discador')
  return {
    pessoa: { nome: perfil?.full_name ?? leads[leads.length - 1]?.name ?? null, emails: listaEmails, telefones: [...telefones], selos },
    eventos: ev,
  }
}
