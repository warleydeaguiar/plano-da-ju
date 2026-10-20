/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Dados AO VIVO do mapa do funil: o texto real de cada mensagem (pré-visualização),
 * se está ligada hoje e quantas saíram nos últimos 7 dias. Ver lib/funil/mapa.ts.
 */
import { createAdminClient } from '@/lib/supabase'
import { fillRichTemplate } from '@/lib/email-personalization'
import { injectUnsubscribe } from '@/lib/email-tracking'
import { PLANO_LIBERADO_ASSUNTO, planoLiberadoHtml } from '@/lib/email-plano-liberado'
import { DISCADOR_PADRAO, lerConfig } from '@/lib/discador'
import { varsBlackFriday } from '@/lib/black-friday'
import { CADEIA_LEAD, FUNIS, type Status } from './mapa'

export type BotaoWa = { tipo: string; texto: string; url?: string }
export type PreviaPronta = {
  canal: 'email' | 'whatsapp' | 'sms' | 'ligacao'
  /** De onde vem o texto (para quem quiser mudar saber onde mexer). */
  fonte: string
  assunto?: string
  html?: string
  texto?: string
  wa?: { cabecalho?: string; corpo: string; rodape?: string; botoes: BotaoWa[]; categoria?: string; status?: string; template: boolean }
  ficha?: { nome: string; motivo: string; detalhe: string; tentativa: string; valor: string; pagamento: string; quando: string; link: string; resultados: string[] }
  aviso?: string
}
export type Vivo = { status?: Status; nota?: string; enviados7d?: number | null; aprox?: boolean }

const WEB = 'https://planodaju.julianecost.com'
const WABA = process.env.WHATSAPP_WABA_ID || '616707188181921'

/** A cliente de exemplo das pré-visualizações (mesma "Maria" do site). */
const EXEMPLO: Record<string, string> = {
  nome: 'Maria', email: 'maria@exemplo.com',
  tipo_cabelo: 'ondulado', cor_cabelo: 'castanho escuro', idade: '31 a 50 anos', espessura: 'fino',
  oleosidade: 'oleoso na raiz', porosidade: 'poroso', problema_principal: 'queda',
  incomoda: 'queda, pontas duplas e frizz', quimica: 'tintura', calor: 'secador',
  areas_preocupantes: 'comprimento e pontas', como_plano: '', diagnostico_curto: 'cabelo ondulado fino e oleoso na raiz',
  ...varsBlackFriday(),
}
const CUPOM_EXEMPLO = 'J50A1B2C3D'

// ── WhatsApp: os templates como estão aprovados na Meta ─────────────────────
type TemplateMeta = { name: string; status: string; category: string; components: any[] }

async function templatesDaMeta(): Promise<Map<string, TemplateMeta> | null> {
  const token = process.env.WHATSAPP_TOKEN
  if (!token) return null
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${WABA}/message_templates?fields=name,status,category,language,components&limit=200`, {
      headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 300 },
    })
    const j = await r.json()
    if (!r.ok || !Array.isArray(j?.data)) return null
    const m = new Map<string, TemplateMeta>()
    for (const t of j.data as TemplateMeta[]) if (!m.has(t.name) || t.status === 'APPROVED') m.set(t.name, t)
    return m
  } catch { return null }
}

function previaDoTemplate(t: TemplateMeta): PreviaPronta {
  const comp = (tipo: string) => t.components.find((c: any) => c.type === tipo)
  const preencher = (s: string) => s.replace(/\{\{1\}\}/g, EXEMPLO.nome).replace(/\{\{(\d+)\}\}/g, '[variável $1]')
  const botoes: BotaoWa[] = (comp('BUTTONS')?.buttons ?? []).map((b: any) => ({
    tipo: b.type, texto: b.text,
    url: b.url ? String(b.url).replace('{{1}}', t.name.includes('50off') ? CUPOM_EXEMPLO : 'exemplo') : undefined,
  }))
  const cab = comp('HEADER')
  return {
    canal: 'whatsapp',
    fonte: `Template "${t.name}" aprovado na Meta (WhatsApp Manager). Para mudar o texto, crie uma versão nova do template.`,
    wa: {
      template: true,
      cabecalho: cab?.text ? preencher(cab.text) : undefined,
      corpo: preencher(comp('BODY')?.text ?? ''),
      rodape: comp('FOOTER')?.text,
      botoes, categoria: t.category, status: t.status,
    },
  }
}

const aprovado = (m: Map<string, TemplateMeta> | null, nome: string, categoria?: string) => {
  const t = m?.get(nome)
  return !!t && t.status === 'APPROVED' && (!categoria || t.category === categoria)
}

// ── Textos escritos no código do site ───────────────────────────────────────
async function previasDoSite(): Promise<Record<string, any> | null> {
  const segredo = process.env.PREVIA_MENSAGENS_SECRET
  if (!segredo) return null
  try {
    const r = await fetch(`${WEB}/api/previa-mensagens`, { headers: { Authorization: `Bearer ${segredo}` }, cache: 'no-store' })
    if (!r.ok) return null
    return (await r.json())?.mensagens ?? null
  } catch { return null }
}

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '')

// ── tudo junto ──────────────────────────────────────────────────────────────
export async function carregarFunil(): Promise<{ previas: Record<string, PreviaPronta>; vivo: Record<string, Vivo>; problemas: string[] }> {
  const sb = createAdminClient()
  const desde = new Date(Date.now() - 7 * 86400_000).toISOString()
  const problemas: string[] = []
  const cnt = async (q: any): Promise<number | null> => { const { count, error } = await q; return error ? null : count ?? 0 }
  const head = (tabela: string) => (sb.from(tabela) as any).select('*', { count: 'exact', head: true })

  const [meta, site, seqsRes, disc, atendRes, volta15Res, leadWaRes, chamadasRes] = await Promise.all([
    templatesDaMeta(),
    previasDoSite(),
    (sb.from('wg_email_sequences') as any).select('id, name, enabled, subject, html_body'),
    lerConfig(sb),
    (sb.from('discador_atendentes') as any).select('nome').eq('ativo', true).order('id').limit(1),
    (sb.from('cupons') as any).select('ativo, expira_em').eq('codigo', process.env.CUPOM_RECUPERACAO || 'VOLTA15').maybeSingle(),
    (sb.from('wg_quiz_leads') as any).select('inscricao_wa_template').gte('inscricao_wa_enviada_em', desde).is('inscricao_wa_erro', null).range(0, 9999),
    (sb.from('discador_chamadas') as any).select('tentativa, desfecho, discador_tarefas(motivo)').gte('criada_em', desde).range(0, 9999),
  ])
  if (!meta) problemas.push('Não consegui ler os templates na Meta agora — as prévias de WhatsApp com template não aparecem.')
  if (!site) problemas.push('Não consegui ler os textos do site agora — as prévias de SMS e do e-mail do PIX não aparecem.')

  // ── prévias ──
  const previas: Record<string, PreviaPronta> = {}
  const seqs = (seqsRes.data ?? []) as any[]
  for (const s of seqs) {
    previas[`email:${String(s.id).slice(0, 8)}`] = {
      canal: 'email',
      fonte: `Régua de e-mail "${s.name}" (Email Marketing → Sequências).`,
      assunto: fillRichTemplate(s.subject ?? '', EXEMPLO),
      html: injectUnsubscribe(fillRichTemplate(s.html_body ?? '', EXEMPLO), EXEMPLO.email),
      aviso: s.enabled ? undefined : 'Este e-mail está DESLIGADO — não está saindo.',
    }
  }
  if (meta) for (const t of meta.values()) previas[`wa:${t.name}`] = previaDoTemplate(t)
  if (site) {
    for (const [k, v] of Object.entries(site) as [string, any][]) {
      previas[`web:${k}`] = {
        canal: v.canal, assunto: v.assunto, html: v.html,
        texto: v.canal === 'sms' ? semAcento(v.texto) : v.texto,
        fonte: 'Texto escrito no código do site (apps/web/lib/textos-mensagens.ts). Mudar = pedir aqui no Claude.',
        wa: v.canal === 'whatsapp' ? { template: false, corpo: v.texto, botoes: [] } : undefined,
      }
    }
  }
  previas['admin:email_plano_liberado'] = {
    canal: 'email', assunto: PLANO_LIBERADO_ASSUNTO, html: planoLiberadoHtml(EXEMPLO.nome),
    fonte: 'Texto escrito no código do admin (apps/admin/lib/email-plano-liberado.ts).',
  }
  const atendente = ((atendRes.data ?? [])[0] as any)?.nome ?? 'Juliana'
  const linkCupom = `planodaju.julianecost.com/oferta?cupom=${CUPOM_EXEMPLO}`
  const trocar = (t: string) => t.replaceAll('{nome}', EXEMPLO.nome).replaceAll('{atendente}', atendente)
    .replaceAll('{vendedora}', atendente).replaceAll('{link}', linkCupom)
  previas['discador:sms'] = {
    canal: 'sms', texto: semAcento(trocar(disc.p.sms_texto || DISCADOR_PADRAO.sms_texto)),
    fonte: 'Texto do painel do discador (Discador → Textos). Sai pelo chip do celular da atendente.',
    aviso: disc.p.sms_sem_atender ? undefined : 'O SMS quando não atende está DESLIGADO no painel do discador.',
  }
  previas['discador:link'] = {
    canal: 'whatsapp', texto: trocar(disc.p.mensagem_link || DISCADOR_PADRAO.mensagem_link),
    wa: { template: false, corpo: trocar(disc.p.mensagem_link || DISCADOR_PADRAO.mensagem_link), botoes: [] },
    fonte: 'Texto do painel do discador. A atendente toca em "WhatsApp" ou "SMS" na ficha e o celular abre a mensagem pronta — ela é quem envia.',
  }
  previas['discador:ficha'] = {
    canal: 'ligacao',
    fonte: 'O que aparece no celular da atendente durante a ligação (app Discador Ju).',
    ficha: {
      nome: 'Maria Souza', motivo: 'PIX gerado e não pago', detalhe: 'Cabelo ondulado · incomoda: queda, pontas · gasta até R$ 100/mês com cabelo · recebeu o cupom de 50% no WhatsApp',
      tentativa: `Tentativa 1 de ${disc.p.tentativas_max}`, valor: 'R$ 48,50', pagamento: 'PIX não pago', quando: 'Foi há 18 min',
      link: linkCupom, resultados: ['Vai pagar', 'Ligar depois', 'Vai pensar', 'Já pagou', 'Sem interesse', 'Número errado'],
    },
  }

  // ── status e números de 7 dias ──
  const vivo: Record<string, Vivo> = {}
  const contagensSeq = await Promise.all(seqs.map((s) =>
    cnt(head('wg_email_sends').eq('sequence_id', s.id).eq('status', 'sent').gte('sent_at', desde))))
  seqs.forEach((s, i) => {
    vivo[`email:${String(s.id).slice(0, 8)}`] = { status: s.enabled ? 'ativo' : 'off', enviados7d: contagensSeq[i] }
  })

  const [leadsConsulta, leadsGrupo, pix7d, pagos7d, boasVindas, pixRec, smsPlano, emailPlano, respostas, sms2, sms3, discSms] = await Promise.all([
    cnt(head('wg_quiz_leads').eq('quiz_slug', 'plano-capilar').gte('created_at', desde)),
    cnt(head('wg_quiz_leads').eq('quiz_slug', 'fashion-gold').gte('created_at', desde)),
    cnt(head('checkout_events').eq('event_type', 'pix_generated').gte('created_at', desde)),
    cnt(head('checkout_events').eq('event_type', 'payment_confirmed').gte('created_at', desde)),
    cnt(head('profiles').gte('boas_vindas_wa_em', desde)),
    cnt(head('profiles').gte('pix_recovery_sent_at', desde)),
    cnt(head('profiles').gte('plan_sms_sent_at', desde)),
    cnt(head('profiles').gte('plan_delivered_email_sent_at', desde)),
    cnt(head('wg_quiz_leads').eq('quiz_slug', 'plano-capilar').gte('respondeu_em', desde)),
    cnt(head('profiles').gte('pix_sms_count', 2).gte('pix_sms_last_at', desde)),
    cnt(head('profiles').gte('pix_sms_count', 3).gte('pix_sms_last_at', desde)),
    cnt(head('discador_sms').eq('ok', true).gte('enviado_em', desde)),
  ])
  vivo.quiz_cria = { enviados7d: leadsConsulta }
  vivo.fg_quiz = { enviados7d: leadsGrupo }
  vivo.pix_gerado = { enviados7d: pix7d }
  vivo.ativa = { enviados7d: pagos7d }
  vivo.email_pix = { enviados7d: pix7d, aprox: true, nota: 'Não fica registro do envio: o número é de PIX gerados (sai 1 por PIX novo).' }
  vivo.sms_pix_1 = { enviados7d: pix7d, aprox: true, nota: 'Não fica registro do envio: o número é de PIX gerados (só sai para quem deixou telefone).' }
  vivo.sms_pix_2 = { enviados7d: sms2, aprox: true, nota: 'Aproximado: só guardamos quantos SMS a pessoa já recebeu, não quando foi cada um.' }
  vivo.sms_pix_3 = { enviados7d: sms3, aprox: true, nota: 'Aproximado: só guardamos quantos SMS a pessoa já recebeu, não quando foi cada um.' }
  vivo.sms_plano_pronto = { enviados7d: smsPlano }
  vivo.email_plano_liberado = { enviados7d: emailPlano }
  vivo.wa_respostas = { enviados7d: respostas, nota: 'Pessoas que responderam a régua de WhatsApp.' }

  const boasV2 = aprovado(meta, 'acesso_plano_v2', 'UTILITY')
  vivo.wa_boas_vindas = { status: meta ? (boasV2 || aprovado(meta, 'acesso_plano') ? 'ativo' : 'gap') : undefined, enviados7d: boasVindas,
    nota: meta ? (boasV2 ? 'Sai o acesso_plano_v2.' : 'O v2 não está aprovado como utilidade: sai o acesso_plano.') : undefined }
  vivo.wa_pix = { status: meta ? (aprovado(meta, 'pix_recuperacao_v2') ? 'ativo' : 'gap') : undefined, enviados7d: pixRec, aprox: true,
    nota: 'O número inclui quem foi marcado e pulado (pagou, bloqueou ou passou dos 40 min).' }

  const porTemplate = new Map<string, number>()
  for (const l of (leadWaRes.data ?? []) as any[]) porTemplate.set(l.inscricao_wa_template ?? '?', (porTemplate.get(l.inscricao_wa_template ?? '?') ?? 0) + 1)
  const daVez = meta ? CADEIA_LEAD.find((t) => aprovado(meta, t, t === 'consulta_50off_v1' ? 'MARKETING' : 'UTILITY')) : undefined
  vivo.wa_lead = {
    status: meta ? (daVez ? 'ativo' : 'gap') : undefined,
    enviados7d: [...porTemplate.values()].reduce((a, b) => a + b, 0),
    nota: [daVez ? `Hoje sai: ${daVez}.` : meta ? 'Nenhum template da cadeia aprovado!' : '',
      porTemplate.size ? `Nos 7 dias: ${[...porTemplate].map(([t, n]) => `${t} (${n})`).join(', ')}.` : ''].filter(Boolean).join(' '),
  }

  const volta = volta15Res.data as any
  const cupomOk = !!volta && volta.ativo && (!volta.expira_em || new Date(volta.expira_em).getTime() > Date.now())
  vivo.wa_desconto = { status: cupomOk ? 'ativo' : 'off', nota: cupomOk ? undefined : 'Pausado: o cupom VOLTA15 está desligado em Promoções, então essa mensagem não sai.' }

  // discador
  const discOn = disc.ligado && disc.motorLigado
  const notaDisc = discOn ? undefined : !disc.motorLigado ? 'Desligado: o robô que monta a fila está desligado no painel do discador.' : 'Desligado: o app está proibido de ligar no painel do discador.'
  const chamadas = (chamadasRes.data ?? []) as any[]
  const porMotivo = (m: string) => chamadas.filter((c) => c.discador_tarefas?.motivo === m && c.desfecho !== 'pulou').length
  vivo.disc_pix = { status: discOn ? 'ativo' : 'off', nota: notaDisc, enviados7d: porMotivo('pix_nao_pago') }
  vivo.disc_cartao = { status: discOn ? 'ativo' : 'off', nota: notaDisc, enviados7d: porMotivo('cartao_recusado') }
  vivo.disc_checkout = { status: discOn ? 'ativo' : 'off', nota: notaDisc, enviados7d: porMotivo('checkout_abandonado') }
  vivo.disc_quiz = { status: discOn ? 'ativo' : 'off', nota: notaDisc, enviados7d: porMotivo('quiz_sem_checkout') }
  vivo.disc_tentativas = { status: discOn ? 'ativo' : 'off', nota: notaDisc, enviados7d: chamadas.filter((c) => (c.tentativa ?? 1) > 1).length }
  vivo.disc_sms = { status: discOn && disc.p.sms_sem_atender ? 'ativo' : 'off', nota: discOn && !disc.p.sms_sem_atender ? 'O SMS quando não atende está desligado no painel do discador.' : notaDisc, enviados7d: discSms }

  // grupos
  vivo.fg_convite = { status: meta ? (aprovado(meta, 'entrada_grupo_pendente_v2', 'UTILITY') ? 'ativo' : 'gap') : undefined }
  vivo.fg_entrou = { status: 'ativo',
    nota: meta && !aprovado(meta, 'confirmacao_inscricao_grupo_v3', 'UTILITY') ? 'Template não aprovado como utilidade: sai o texto livre.' : undefined }

  // passos com prévia de e-mail que não acharam a sequência (apagada/renomeada)
  for (const f of FUNIS) for (const sec of f.secoes) {
    const etapas = sec.tipo === 'etapa' ? [sec.etapa] : [...sec.esquerda.etapas, ...sec.direita.etapas]
    for (const e of etapas) for (const p of e.passos) {
      if (p.id.startsWith('email:') && !previas[p.id]) vivo[p.id] = { status: 'gap', nota: 'Esta sequência não existe mais no Email Marketing.' }
    }
  }
  return { previas, vivo, problemas }
}
