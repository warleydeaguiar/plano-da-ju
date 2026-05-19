/**
 * Personalização rica de emails baseada nas respostas do quiz.
 *
 * Pega `wg_quiz_answers` por session_id (preferido) ou email (fallback) e
 * gera um Record<string,string> com vars como {tipo_cabelo}, {problema_principal},
 * {quimica}, etc. — todas em português natural e prontas pra usar no template.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ── Maps de labels (mesma fonte usada no admin de analytics) ────────────────
const TIPO: Record<string, string> = {
  crespo: 'crespo', cacheado: 'cacheado', ondulado: 'ondulado', liso: 'liso',
}
const COR: Record<string, string> = {
  preto: 'preto', castanho_claro: 'castanho claro', castanho_esc: 'castanho escuro',
  ruivo: 'ruivo', loiro: 'loiro',
}
const IDADE: Record<string, string> = {
  '13_18': '13 a 18 anos', '19_30': '19 a 30 anos', '31_50': '31 a 50 anos', '51': 'mais de 51 anos',
}
const INCOMODA: Record<string, string> = {
  pontas: 'pontas ralas', frizz: 'frizz', cresc: 'falta de crescimento',
  queda: 'queda de cabelo', volume: 'muito volume', quebra: 'fios quebradiços',
}
const QUIMICA: Record<string, string> = {
  progressiva: 'progressiva com formol', descolor: 'descoloração',
  tintura: 'tintura', relax: 'relaxamento', botox: 'botox/selagem',
  decap: 'decapagem', mechas: 'mechas/luzes', nenhuma: 'nenhuma química',
}
const ESPESSURA: Record<string, string> = {
  fino: 'fino', medio: 'médio', grosso: 'grosso',
}
const OLEOSIDADE: Record<string, string> = {
  seco: 'seco', normal: 'normal', oleoso: 'oleoso',
}
const POROSIDADE: Record<string, string> = {
  sim_absorve: 'alta porosidade (absorve produto rápido)',
  nao_demora: 'baixa porosidade (demora pra absorver)',
  nao_sei: 'porosidade que você ainda não identificou',
}
const CALOR: Record<string, string> = {
  secador: 'secador', chapinha: 'chapinha', babyliss: 'babyliss', nenhum: 'sem fontes de calor',
}
const COMO_PLANO: Record<string, string> = {
  sem_dinheiro: 'sem condição de comprar produto novo',
  aproveitar: 'aproveitando o que já tem em casa',
  trocar_todos: 'pronta pra trocar todos os produtos',
}
const AREAS: Record<string, string> = {
  couro: 'couro cabeludo', comprimento: 'comprimento', pontas: 'pontas',
}

function arrayLabel(value: unknown, map: Record<string, string>): string {
  const arr = Array.isArray(value) ? value : (value != null ? [value] : [])
  const labels = arr.map(v => map[String(v)] ?? String(v)).filter(Boolean)
  if (labels.length === 0) return ''
  if (labels.length === 1) return labels[0]
  if (labels.length === 2) return `${labels[0]} e ${labels[1]}`
  return labels.slice(0, -1).join(', ') + ' e ' + labels[labels.length - 1]
}

function singleLabel(value: unknown, map: Record<string, string>): string {
  if (Array.isArray(value)) return map[String(value[0])] ?? ''
  if (value == null) return ''
  return map[String(value)] ?? ''
}

// ── Carrega respostas do quiz por session_id (com fallback por email) ────────
async function loadAnswers(
  sb: SupabaseClient,
  session_id: string | null,
  email: string | null,
): Promise<Record<string, any>> {
  if (!session_id && !email) return {}

  // Tenta por session_id primeiro
  if (session_id) {
    const { data } = await (sb as any)
      .from('wg_quiz_answers')
      .select('question_id, answer')
      .eq('session_id', session_id)
    if (data && data.length > 0) {
      const map: Record<string, any> = {}
      for (const row of data) map[row.question_id] = row.answer
      return map
    }
  }

  // Fallback: encontra session_id via wg_quiz_leads usando email
  if (email) {
    const { data: lead } = await (sb as any)
      .from('wg_quiz_leads')
      .select('session_id')
      .ilike('email', email)
      .not('session_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (lead?.session_id) {
      const { data } = await (sb as any)
        .from('wg_quiz_answers')
        .select('question_id, answer')
        .eq('session_id', lead.session_id)
      if (data && data.length > 0) {
        const map: Record<string, any> = {}
        for (const row of data) map[row.question_id] = row.answer
        return map
      }
    }
  }

  return {}
}

/**
 * Constrói o dicionário completo de variáveis para um lead.
 * Use no fillTemplate antes do envio.
 */
export async function buildPersonalizationVars(
  sb: SupabaseClient,
  lead: { name?: string | null; email: string; session_id?: string | null },
): Promise<Record<string, string>> {
  const firstName = ((lead.name ?? '').trim().split(/\s+/)[0]) || 'amiga'
  const answers = await loadAnswers(sb, lead.session_id ?? null, lead.email)

  const tipo = singleLabel(answers.tipo, TIPO)
  const cor = singleLabel(answers.cor, COR)
  const idade = singleLabel(answers.idade, IDADE)
  const incomoda = arrayLabel(answers.incomoda, INCOMODA)
  const quimica = arrayLabel(answers.quimica, QUIMICA)
  const espessura = singleLabel(answers.espessura, ESPESSURA)
  const oleosidade = singleLabel(answers.oleosidade, OLEOSIDADE)
  const porosidade = singleLabel(answers.porosidade, POROSIDADE)
  const calor = arrayLabel(answers.calor, CALOR)
  const como_plano = singleLabel(answers.como_plano, COMO_PLANO)
  const areas = arrayLabel(answers.areas, AREAS)

  // Primeiro problema da lista de "incomoda" (para uso em headline)
  const problemaPrincipalRaw = Array.isArray(answers.incomoda) ? answers.incomoda[0] : answers.incomoda
  const problemaPrincipal = INCOMODA[String(problemaPrincipalRaw)] ?? incomoda ?? 'os problemas que você marcou'

  // Vars sempre presentes (com fallbacks elegantes para leads sem respostas)
  return {
    nome: firstName,
    email: lead.email,

    // Cabelo
    tipo_cabelo: tipo || 'seu tipo de cabelo',
    cor_cabelo: cor || '',
    idade: idade || '',
    espessura: espessura || '',
    oleosidade: oleosidade || '',
    porosidade: porosidade || '',

    // Problemas e tratamentos
    problema_principal: problemaPrincipal,
    incomoda: incomoda || 'seus incômodos capilares',
    quimica: quimica || 'sem química recente',
    calor: calor || 'fontes de calor',
    areas_preocupantes: areas || 'comprimento e pontas',
    como_plano: como_plano || '',

    // Diagnóstico curto (frase pronta para headline)
    diagnostico_curto: tipo
      ? `cabelo ${tipo}${espessura ? ` ${espessura}` : ''}${oleosidade ? ` e ${oleosidade}` : ''}`
      : 'seu diagnóstico completo',
  }
}

/** Substitui {var} e {{var}} no template */
export function fillRichTemplate(template: string, vars: Record<string, string>): string {
  if (!template) return ''
  let result = template
  for (const [key, value] of Object.entries(vars)) {
    const safe = value ?? ''
    result = result.replaceAll(`{{${key}}}`, safe)
    result = result.replaceAll(`{${key}}`, safe)
  }
  return result
}
