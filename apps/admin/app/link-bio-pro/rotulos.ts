/**
 * Rótulos do quiz do Link na Bio PRO pro admin.
 *
 * Espelha apps/web/lib/quiz-link-bio-questions.ts e quiz-link-bio-profissoes.ts
 * (apps diferentes, sem pacote compartilhado). Pergunta nova no quiz sem
 * entrada aqui continua aparecendo — só com a chave crua em vez do texto.
 */

export const PERGUNTAS: Record<string, string> = {
  profissao: 'Área',
  nome_negocio: 'Nome do negócio',
  segmento_negocio: 'O que o negócio oferece',
  oab: 'OAB',
  areas_juridicas: 'Áreas do direito',
  crm: 'CRM',
  especialidade_medica: 'Especialidade',
  cro: 'CRO',
  especialidade_odonto: 'Especialidade',
  crfa: 'CRFa',
  publico_atendido: 'Público atendido',
  servicos_beleza: 'Serviços',
  nicho_conteudo: 'Nicho de conteúdo',
  area_outra: 'O que faz',
  estilo: 'Estilo escolhido',
  objetivo: 'O que não pode faltar',
  links_redes: 'Links pra incluir',
}

const PROFISSOES: Record<string, string> = {
  empresario: 'Empresário(a)',
  advogado: 'Advogado(a)',
  medico: 'Médico(a)',
  dentista: 'Dentista',
  fonoaudiologo: 'Fonoaudiólogo(a)',
  esteticista: 'Esteticista / Beleza',
  influenciador: 'Influenciador(a) / Criador(a)',
  outro: 'Outra área',
}

export const rotuloProfissao = (id: string | null | undefined) => (id ? PROFISSOES[id] ?? id : '—')

const ETAPAS_TELA: Record<string, string> = {
  intro: 'Abertura', profissao: 'Área', contato: 'Contato', foto: 'Foto', pagamento: 'Pagamento',
}

/** Nome curto da etapa onde a pessoa parou. */
export const rotuloEtapa = (id: string | null | undefined) =>
  !id ? '—' : ETAPAS_TELA[id] ?? (PERGUNTAS[id] ? `Pergunta: ${PERGUNTAS[id]}` : id)

export const rotuloPergunta = (chave: string) =>
  PERGUNTAS[chave] ?? chave.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

/**
 * Etapas do funil na ordem do quiz. O rótulo descreve o que a pessoa já FEZ ao
 * chegar na etapa (chegou no estilo = deixou o contato). As perguntas da
 * profissão contam como uma etapa só.
 */
export const ETAPAS = [
  { id: 'intro', rotulo: 'Abriu a página' },
  { id: 'profissao', rotulo: 'Começou o quiz' },
  { id: 'extras', rotulo: 'Escolheu a área' },
  { id: 'contato', rotulo: 'Chegou no contato' },
  { id: 'estilo', rotulo: 'Deixou contato' },
  { id: 'objetivo', rotulo: 'Escolheu o estilo' },
  { id: 'links_redes', rotulo: 'Disse o que quer' },
  { id: 'foto', rotulo: 'Mandou os links' },
  { id: 'pagamento', rotulo: 'Chegou no pagamento' },
] as const

const ORDEM = ['intro', 'profissao', 'extras', 'contato', 'estilo', 'objetivo', 'links_redes', 'foto', 'pagamento']

/** Índice (em ETAPAS) da etapa mais longe que a visita alcançou. */
export function etapaDoFunil(etapaId: string | null | undefined): number {
  if (!etapaId) return 0
  const i = ORDEM.indexOf(etapaId)
  if (i >= 0) return i
  return PERGUNTAS[etapaId] ? 2 : 0 // pergunta de profissão (oab, crm…)
}
