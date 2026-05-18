import { createAdminClient } from '@/lib/supabase'
import PlanoCapilarClient from './PlanoCapilarClient'

export const dynamic = 'force-dynamic'

// Mapeamento de question_id → label legível (IDs do novo quiz)
const QUESTION_LABELS: Record<string, string> = {
  tipo:                 'Tipo de cabelo',
  cor:                  'Cor do cabelo',
  idade:                'Faixa etária',
  incomoda:             'O que mais incomoda',
  quimica:              'Químicas nos últimos 6 meses',
  corte_quimico:        'Já teve corte químico?',
  espessura:            'Espessura do fio',
  oleosidade:           'Condição do cabelo (seco/oleoso/normal)',
  porosidade:           'Porosidade',
  caspa:                'Caspa ou coceira?',
  elasticidade:         'Elasticidade dos fios',
  lavagem:              'Frequência de lavagem',
  calor:                'Uso de fontes de calor',
  cronograma:           'Faz cronograma capilar?',
  crescimento_desigual: 'Crescimento desigual ou falhas?',
  sol_piscina:          'Sol, piscina ou mar?',
  agua:                 'Litros de água por dia',
  protetor:             'Usa protetor térmico/solar?',
  como_plano:           'Como quer o plano?',
  produtos_casa:        'Produtos que tem em casa',
  cortes:               'Frequência de cortes',
  areas:                'Áreas que mais preocupam',
}

const OPTION_LABELS: Record<string, Record<string, string>> = {
  tipo:                 { crespo: 'Crespo', cacheado: 'Cacheado', ondulado: 'Ondulado', liso: 'Liso' },
  cor:                  { preto: 'Preto', castanho_claro: 'Castanho claro', castanho_esc: 'Castanho Escuro', ruivo: 'Ruivo', loiro: 'Loiro' },
  idade:                { '13_18': '13–18 anos', '19_30': '19–30 anos', '31_50': '31–50 anos', '51': '+51 anos' },
  incomoda:             { pontas: 'Pontas Ralas', frizz: 'Frizz', cresc: 'Falta de crescimento', queda: 'Queda de cabelo', volume: 'Muito Volume', quebra: 'Quebradiços' },
  quimica:              { progressiva: 'Progressiva com formol', descolor: 'Descolorante', tintura: 'Tintura', relax: 'Relaxamento', botox: 'Botox/Selagem', decap: 'Decapagem', mechas: 'Mechas/Luzes', nenhuma: 'Nenhuma' },
  corte_quimico:        { sim: 'Sim', nao: 'Não' },
  espessura:            { fino: 'Fino', medio: 'Médio', grosso: 'Grosso' },
  oleosidade:           { seco: 'Seco', normal: 'Normal', oleoso: 'Oleoso' },
  porosidade:           { sim_absorve: 'Absorve rápido', nao_demora: 'Demora p/ absorver', nao_sei: 'Não sei' },
  caspa:                { sim_freq: 'Sim, frequente', as_vezes: 'Às vezes', nao: 'Não' },
  elasticidade:         { quebradicos: 'Quebradiços', elasticos: 'Elásticos', normais: 'Normais' },
  lavagem:              { todo_dia: 'Todo dia', '2_3_sem': '2–3x/semana', menos_2: 'Menos de 2x' },
  calor:                { secador: 'Secador', chapinha: 'Chapinha', babyliss: 'Babyliss', nenhum: 'Não usa' },
  cronograma:           { sim: 'Sim', nao: 'Não', nao_sei: 'Não sei o que é' },
  crescimento_desigual: { sim: 'Sim', nao: 'Não' },
  sol_piscina:          { sim: 'Sim', nao: 'Não' },
  agua:                 { '1': '1 litro', '2': '2 litros', '3': '3 litros', '4+': '4+ litros' },
  protetor:             { sim: 'Sim', nao: 'Não' },
  como_plano:           { sem_dinheiro: 'Sem dinheiro p/ comprar', aproveitar: 'Aproveitar o que tem', trocar_todos: 'Trocar tudo' },
  cortes:               { '1_2': 'A cada 1–2 meses', '3_6': 'A cada 3–6 meses', menos_1_ano: 'Menos de 1x/ano' },
  areas:                { couro: 'Couro cabeludo', comprimento: 'Comprimento', pontas: 'Pontas' },
}

// Labels curtos para exibição no funil
const STEP_LABELS: Record<string, string> = {
  tipo:                 'Tipo de cabelo',
  cor:                  'Cor do cabelo',
  idade:                'Faixa etária',
  incomoda:             'O que incomoda',
  quimica:              'Químicas recentes',
  info_juliane:         'Info: Juliane',
  info_3500:            'Info: 3500 mulheres',
  corte_quimico:        'Corte químico?',
  espessura:            'Espessura do fio',
  oleosidade:           'Seco/oleoso/normal',
  porosidade:           'Porosidade',
  caspa:                'Caspa/coceira',
  elasticidade:         'Elasticidade',
  lavagem:              'Frequência lavagem',
  calor:                'Uso de calor',
  cronograma:           'Faz cronograma?',
  crescimento_desigual: 'Crescimento desigual',
  sol_piscina:          'Sol/piscina/mar',
  agua:                 'Litros de água/dia',
  protetor:             'Usa protetor?',
  como_plano:           'Como quer o plano',
  produtos_casa:        'Produtos em casa',
  cortes:               'Freq. de cortes',
  areas:                'Áreas preocupantes',
  info_bio:             'Info: Bio Juliane',
  info_depoimentos:     'Depoimentos',
  loading:              'Carregando plano',
  phone:                'Telefone',
  name_email:           'Nome e e-mail',
  level:                'Nível do plano',
  plan_ready:           'Plano pronto!',
  mini_testi:           'Mini depoimento',
}

async function getData() {
  const sb = createAdminClient()
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const since30 = new Date(Date.now() - 30 * 86400_000).toISOString()

  const [viewsAll, viewsToday, viewsMonth, profiles, answersAll, dailyViews, stepEvents, leadsCount, checkoutEvents] = await Promise.all([
    sb.from('wg_quiz_views' as any).select('id', { count: 'exact', head: true }).eq('quiz_slug', 'plano-capilar'),
    sb.from('wg_quiz_views' as any).select('id', { count: 'exact', head: true }).eq('quiz_slug', 'plano-capilar').gte('created_at', today.toISOString()),
    sb.from('wg_quiz_views' as any).select('id', { count: 'exact', head: true }).eq('quiz_slug', 'plano-capilar').gte('created_at', since30),
    sb.from('profiles').select('id', { count: 'exact', head: true }),
    sb.from('wg_quiz_answers' as any).select('question_id, answer').eq('quiz_slug', 'plano-capilar'),
    sb.from('wg_quiz_views' as any).select('created_at').eq('quiz_slug', 'plano-capilar').gte('created_at', since30).order('created_at', { ascending: true }),
    sb.from('wg_quiz_step_events' as any).select('step_index, step_id, event_type, session_id').eq('quiz_slug', 'plano-capilar').gte('created_at', since30),
    sb.from('wg_quiz_leads' as any).select('id', { count: 'exact', head: true }).eq('quiz_slug', 'plano-capilar').gte('created_at', since30),
    sb.from('checkout_events' as any).select('event_type').gte('created_at', since30),
  ])

  // Série diária de views
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * 86400_000)
    return d.toISOString().slice(0, 10)
  })
  const dayMap: Record<string, number> = {}
  days.forEach(d => { dayMap[d] = 0 })
  for (const row of (dailyViews.data ?? []) as any[]) {
    const k = (row.created_at as string).slice(0, 10)
    if (k in dayMap) dayMap[k]++
  }
  const dailySeries = days.map(d => {
    const date = new Date(d + 'T12:00:00')
    return { date: d, label: `${date.getDate()}/${date.getMonth() + 1}`, views: dayMap[d] }
  })

  // Agregar respostas por pergunta
  const questionMap: Record<string, Record<string, number>> = {}
  for (const row of (answersAll.data ?? []) as any[]) {
    const qid = row.question_id as string
    if (!QUESTION_LABELS[qid]) continue // pular perguntas sem label (ex: texto livre)
    if (!questionMap[qid]) questionMap[qid] = {}
    const values = Array.isArray(row.answer) ? row.answer : [row.answer]
    for (const v of values) {
      const s = String(v)
      questionMap[qid][s] = (questionMap[qid][s] ?? 0) + 1
    }
  }

  // Construir analytics com % e labels
  const questionAnalytics = Object.entries(questionMap).map(([questionId, counts]) => {
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    const optionLabels = OPTION_LABELS[questionId] ?? {}
    const options = Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([value, count]) => ({
        value,
        label: optionLabels[value] ?? value,
        count,
        pct: Math.round((count / Math.max(total, 1)) * 100),
      }))
    return {
      questionId,
      question: QUESTION_LABELS[questionId] ?? questionId,
      total,
      options,
    }
  }).sort((a, b) => {
    // Ordena pela ordem das perguntas
    const order = Object.keys(QUESTION_LABELS)
    return order.indexOf(a.questionId) - order.indexOf(b.questionId)
  })

  // ── Funil por passo ────────────────────────────────────────────
  const stepViewedMap:   Record<number, Set<string>> = {}
  const stepAnsweredMap: Record<number, Set<string>> = {}
  const stepIdMap:       Record<number, string>      = {}

  for (const row of (stepEvents.data ?? []) as any[]) {
    const idx: number = row.step_index
    const sid: string = row.session_id
    if (!stepViewedMap[idx])   stepViewedMap[idx]   = new Set()
    if (!stepAnsweredMap[idx]) stepAnsweredMap[idx] = new Set()
    if (!stepIdMap[idx])       stepIdMap[idx]       = row.step_id
    if (row.event_type === 'viewed')   stepViewedMap[idx].add(sid)
    if (row.event_type === 'answered') stepAnsweredMap[idx].add(sid)
  }

  const allStepIndexes = Array.from(
    new Set([...Object.keys(stepViewedMap), ...Object.keys(stepAnsweredMap)].map(Number))
  ).sort((a, b) => a - b)

  const stepFunnelRaw = allStepIndexes.map(idx => ({
    step_index: idx,
    step_id:    stepIdMap[idx] ?? '',
    viewed:     stepViewedMap[idx]?.size   ?? 0,
    answered:   stepAnsweredMap[idx]?.size ?? 0,
  }))

  const maxViewed = Math.max(...stepFunnelRaw.map(r => r.viewed), 1)
  const stepFunnel = stepFunnelRaw.map((row, i) => {
    const rate    = row.viewed > 0 ? Math.round((row.answered / row.viewed) * 100)    : null
    const pctOfTop = Math.round((row.viewed / maxViewed) * 100)
    const prevViewed = i > 0 ? stepFunnelRaw[i - 1].viewed : null
    const dropoff  = prevViewed != null && prevViewed > 0
      ? Math.round(((prevViewed - row.viewed) / prevViewed) * 100)
      : null
    return {
      ...row,
      label:           STEP_LABELS[row.step_id] ?? row.step_id,
      conversion_rate: rate,
      pct_of_top:      pctOfTop,
      dropoff_from_prev: dropoff,
    }
  })

  // ── Checkout funnel ─────────────────────────────────────────────
  const checkoutCounts: Record<string, number> = {}
  for (const row of (checkoutEvents.data ?? []) as any[]) {
    const et = row.event_type as string
    checkoutCounts[et] = (checkoutCounts[et] ?? 0) + 1
  }

  return {
    kpis: {
      views:            viewsAll.count   ?? 0,
      today:            viewsToday.count ?? 0,
      viewsMonth:       viewsMonth.count ?? 0,
      profiles:         profiles.count   ?? 0,
      periodLeads:      leadsCount.count ?? 0,
      conversion:       (viewsAll.count ?? 0) > 0 ? Math.round(((profiles.count ?? 0) / (viewsAll.count ?? 1)) * 100) : null,
      checkoutInitiated:  checkoutCounts['checkout_initiated']  ?? 0,
      pixGenerated:       checkoutCounts['pix_generated']       ?? 0,
      paymentConfirmed:   checkoutCounts['payment_confirmed']   ?? 0,
    },
    dailySeries,
    questionAnalytics,
    stepFunnel,
  }
}

export default async function PlanoCapilarPage() {
  const data = await getData()
  return <PlanoCapilarClient data={data} />
}
