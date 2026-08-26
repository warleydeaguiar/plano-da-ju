import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const WEBHOOK = process.env.DISCORD_CONTENT_IDEAS_WEBHOOK ?? ''

/**
 * GET /api/cron/weekly-content-ideas
 *
 * Roda toda segunda às 10:30 BR (13:30 UTC).
 * Estratégia:
 *  1. Agrega dados do quiz dos últimos 30 dias → quais são as dores,
 *     tipos, químicas, faixas etárias dominantes no público que CHEGOU
 *     no nosso funil (não público genérico de hair-care).
 *  2. Pega Juliane notes recentes (texto livre dela em planos aprovados)
 *     pra capturar a "voz" e padrões que ela mesma vê.
 *  3. Pega check_ins recentes (o que as clientes estão dizendo HOJE).
 *  4. Pega photo_analyses (problemas visíveis nos cabelos).
 *  5. Manda tudo pro Claude com prompt estruturado pedindo 5 ideias de
 *     Reels/posts Instagram baseadas EM DADOS REAIS, não generalidade.
 *  6. Posta como embed no Discord (canal separado do daily report).
 */

interface ContentIdea {
  title: string
  hook: string
  description: string
  target_audience: string
  data_signal: string
}

interface AggregatedData {
  windowDays: number
  totalQuizSessions: number
  topIncomoda:    Array<{ value: string; count: number }>
  topQuimica:     Array<{ value: string; count: number }>
  topTipo:        Array<{ value: string; count: number }>
  topIdade:       Array<{ value: string; count: number }>
  topAreas:       Array<{ value: string; count: number }>
  topCalor:       Array<{ value: string; count: number }>
  topComoPlano:   Array<{ value: string; count: number }>
  cronogramaNao:  { count: number; total: number }   // quantas NÃO fazem cronograma
  julianeNotes:   string[]
  recentCheckins: Array<{ hair_feel: string; scalp_feel: string; breakage: boolean }>
  photoIssues:    Array<{ frizz: number | null; pontas: number | null; hidratacao: number | null }>
}

// Labels human-readable pros valores brutos do quiz
const VALUE_LABELS: Record<string, Record<string, string>> = {
  incomoda: {
    frizz: 'Frizz', volume: 'Volume excessivo', queda: 'Queda',
    quebra: 'Quebra', cresc: 'Crescimento lento', pontas: 'Pontas duplas/ralas',
    ressecamento: 'Ressecamento', oleosidade_p: 'Oleosidade', caspa: 'Caspa',
  },
  quimica: {
    tintura: 'Tintura', mechas: 'Mechas/Luzes', descolor: 'Descoloração',
    progressiva: 'Progressiva', botox: 'Botox capilar', relax: 'Relaxamento',
    decap: 'Decapagem', nenhuma: 'Sem química',
  },
  tipo: { liso: 'Liso', ondulado: 'Ondulado', cacheado: 'Cacheado', crespo: 'Crespo' },
  idade: { '13_18': '13–18', '19_30': '19–30', '31_50': '31–50', '51': '51+' },
  areas: { raiz: 'Raiz', comprimento: 'Comprimento', pontas: 'Pontas', couro: 'Couro cabeludo' },
  calor: {
    secador: 'Secador', chapinha: 'Chapinha', babyliss: 'Babyliss', nenhum: 'Não usa calor',
  },
  como_plano: {
    aproveitar: 'Aproveitar produtos que tem',
    trocar_todos: 'Pode trocar todos produtos',
    sem_dinheiro: 'Sem dinheiro pra investir',
  },
}

function labelize(field: string, value: string): string {
  return VALUE_LABELS[field]?.[value] ?? value
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function aggregate(sb: any): Promise<AggregatedData> {
  const fields = ['incomoda', 'quimica', 'tipo', 'idade', 'areas', 'calor', 'como_plano', 'cronograma']
  const since = new Date(Date.now() - 30 * 86400_000).toISOString()

  // Pega TODAS as respostas relevantes de uma vez
  const { data: rows } = await sb
    .from('wg_quiz_answers')
    .select('question_id, answer, session_id')
    .eq('quiz_slug', 'plano-capilar')
    .in('question_id', fields)
    .gte('created_at', since)
    .limit(5000)

  // Tally por field
  const counters: Record<string, Map<string, number>> = {}
  const sessionsByField: Record<string, Set<string>> = {}
  for (const f of fields) {
    counters[f] = new Map<string, number>()
    sessionsByField[f] = new Set<string>()
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (rows ?? []) as any[]) {
    const f = row.question_id as string
    if (!counters[f]) continue
    sessionsByField[f].add(row.session_id)
    const ans = row.answer
    const values = Array.isArray(ans) ? ans : [ans]
    for (const v of values) {
      const k = String(v)
      counters[f].set(k, (counters[f].get(k) ?? 0) + 1)
    }
  }

  function topOf(field: string, n: number) {
    return Array.from(counters[field].entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([value, count]) => ({ value: labelize(field, value), count }))
  }

  // Cronograma — quantas NÃO fazem
  const totalCron = sessionsByField['cronograma'].size
  const cronogramaNao = counters['cronograma']?.get('nao') ?? 0

  // Sessions únicas distintas no quiz inteiro
  const allSessions = new Set<string>()
  for (const f of fields) for (const s of sessionsByField[f]) allSessions.add(s)

  // Juliane notes — pra captar o tom dela e padrões qualitativos
  const { data: planRows } = await sb
    .from('hair_plans')
    .select('juliane_notes')
    .not('juliane_notes', 'is', null)
    .order('approved_at', { ascending: false, nullsFirst: false })
    .limit(20)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const julianeNotes: string[] = (planRows ?? [])
    .map((r: { juliane_notes: string | null }) => r.juliane_notes)
    .filter((n: string | null): n is string => !!n && n.trim().length > 10)
    .slice(0, 10)

  // Check-ins recentes (o que as clientes dizem hoje sobre o cabelo)
  const { data: checkinRows } = await sb
    .from('check_ins')
    .select('hair_feel, scalp_feel, breakage_observed')
    .gte('checked_at', new Date(Date.now() - 14 * 86400_000).toISOString())
    .order('checked_at', { ascending: false })
    .limit(30)
  const recentCheckins = (checkinRows ?? []).map((c: { hair_feel: string; scalp_feel: string; breakage_observed: boolean }) => ({
    hair_feel: c.hair_feel,
    scalp_feel: c.scalp_feel,
    breakage: c.breakage_observed,
  }))

  // Photo analyses — issues visíveis
  const { data: photoRows } = await sb
    .from('photo_analyses')
    .select('frizz_score, pontas_score, hidratacao_score')
    .gte('analyzed_at', new Date(Date.now() - 30 * 86400_000).toISOString())
    .limit(30)
  const photoIssues = (photoRows ?? []).map((p: { frizz_score: number; pontas_score: number; hidratacao_score: number }) => ({
    frizz: p.frizz_score,
    pontas: p.pontas_score,
    hidratacao: p.hidratacao_score,
  }))

  return {
    windowDays: 30,
    totalQuizSessions: allSessions.size,
    topIncomoda:    topOf('incomoda', 6),
    topQuimica:     topOf('quimica', 6),
    topTipo:        topOf('tipo', 4),
    topIdade:       topOf('idade', 4),
    topAreas:       topOf('areas', 4),
    topCalor:       topOf('calor', 4),
    topComoPlano:   topOf('como_plano', 4),
    cronogramaNao:  { count: cronogramaNao, total: totalCron },
    julianeNotes,
    recentCheckins,
    photoIssues,
  }
}

function buildPrompt(data: AggregatedData): string {
  const fmt = (arr: Array<{ value: string; count: number }>) =>
    arr.map(x => `${x.value} (${x.count})`).join(' · ')

  const photoSummary = data.photoIssues.length > 0
    ? `${data.photoIssues.length} fotos analisadas. Frizz médio ${(data.photoIssues.reduce((s, p) => s + (p.frizz ?? 0), 0) / data.photoIssues.length).toFixed(1)}/5, pontas ${(data.photoIssues.reduce((s, p) => s + (p.pontas ?? 0), 0) / data.photoIssues.length).toFixed(1)}/5, hidratação ${(data.photoIssues.reduce((s, p) => s + (p.hidratacao ?? 0), 0) / data.photoIssues.length).toFixed(1)}/5.`
    : 'Ainda poucas fotos analisadas.'

  return `Você é a estrategista de conteúdo da Juliane Cost, especialista capilar com mais de 3500 mulheres atendidas. Ela vai gravar 5 vídeos curtos pro Instagram (Reels/Carrossel) esta semana.

DADOS REAIS DO PÚBLICO QUE ENTROU NO QUIZ (últimos ${data.windowDays} dias, ${data.totalQuizSessions} sessões únicas)
─────────────────────────────────────────────────────────────
Principais dores: ${fmt(data.topIncomoda)}
Histórico químico: ${fmt(data.topQuimica)}
Tipo de cabelo: ${fmt(data.topTipo)}
Faixa etária: ${fmt(data.topIdade)}
Áreas mais problemáticas: ${fmt(data.topAreas)}
Uso de calor: ${fmt(data.topCalor)}
Mentalidade financeira: ${fmt(data.topComoPlano)}
Não fazem cronograma capilar: ${data.cronogramaNao.count} de ${data.cronogramaNao.total} (${data.cronogramaNao.total > 0 ? Math.round(100 * data.cronogramaNao.count / data.cronogramaNao.total) : 0}%)

ANÁLISE DAS FOTOS RECENTES
${photoSummary}

ANOTAÇÕES PESSOAIS DA JULIANE (em planos aprovados, mostra o que ela vem observando)
${data.julianeNotes.length > 0 ? data.julianeNotes.map(n => `- "${n.slice(0, 200)}"`).join('\n') : '(ainda sem anotações)'}

CONTEXTO DO NEGÓCIO
- Plano capilar vendido a R$34,90 (PIX) ou em até 4× no cartão
- Público dominante: mulheres 31-50 com cabelo danificado por química
- Tom da Juliane: caloroso, direto, sem clichês de "amiga", sem "linda" excessivo
- Cada vídeo precisa ter: gancho (hook) forte nos primeiros 3s, conteúdo de valor, CTA sutil pro quiz/plano

REGRAS PRA GERAR AS IDEIAS
1. As 5 IDEIAS DEVEM ATACAR AS DORES REAIS acima — não invente assunto genérico
2. Pelo menos 1 ideia DEVE explorar o "${data.cronogramaNao.count} mulheres não fazem cronograma" (educação que vende plano)
3. Pelo menos 1 DEVE falar da química mais comum (${data.topQuimica[0]?.value ?? 'química'}) + a dor mais comum (${data.topIncomoda[0]?.value ?? 'dor'})
4. Pelo menos 1 DEVE ser MITO vs VERDADE — formato de altíssima retenção em Reels
5. NÃO usar nomenclatura técnica (2B, 3A, 4C) — usar Crespo/Cacheado/Ondulado/Liso
6. Títulos curtos, com gancho. Descrição prática (o QUE ela fala + POR QUE esse público específico precisa ouvir agora)

RETORNE SOMENTE JSON VÁLIDO (sem markdown):
{
  "ideas": [
    {
      "title": "Título curto e direto, máx 60 chars",
      "hook": "Frase de impacto pros primeiros 3 segundos do vídeo (gancho)",
      "description": "2-3 frases sobre o que abordar no vídeo, prática e específica",
      "target_audience": "Pra quem é esse vídeo (descreve o subgrupo das clientes)",
      "data_signal": "Por que esse tema agora — referencie os números acima"
    }
  ]
}`
}

interface ContentIdeasResult {
  ideas: ContentIdea[]
}

async function generateIdeas(data: AggregatedData): Promise<{ ok: true; ideas: ContentIdea[] } | { ok: false; error: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { ok: false, error: 'OPENROUTER_API_KEY não configurado' }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 50_000)

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://admin.julianecost.com',
        'X-Title': 'Plano da Ju Content Ideas',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-6',
        max_tokens: 3000,
        messages: [{ role: 'user', content: buildPrompt(data) }],
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      return { ok: false, error: `OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}` }
    }

    const j = await res.json()
    const content = j.choices?.[0]?.message?.content ?? ''
    const m = content.match(/\{[\s\S]*\}/)
    if (!m) return { ok: false, error: 'JSON não encontrado na resposta' }

    const parsed = JSON.parse(m[0]) as ContentIdeasResult
    if (!Array.isArray(parsed.ideas) || parsed.ideas.length === 0) {
      return { ok: false, error: 'ideas array vazio ou inválido' }
    }
    return { ok: true, ideas: parsed.ideas }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'desconhecido' }
  } finally {
    clearTimeout(timeoutId)
  }
}

async function sendToDiscord(ideas: ContentIdea[], data: AggregatedData): Promise<{ ok: boolean; error?: string }> {
  if (!WEBHOOK) return { ok: false, error: 'DISCORD_CONTENT_IDEAS_WEBHOOK not set' }

  const PINK = 0xEC4899
  const ICONS = ['🎬', '🎥', '📹', '🎞️', '🍿']

  // Discord limita 10 embeds por message — temos 5 ideias + 1 cabeçalho, OK
  const headerEmbed = {
    title: '🎬 Ideias de conteúdo da semana',
    description: `5 vídeos pro Instagram baseados em **${data.totalQuizSessions} clientes reais** do quiz (últimos ${data.windowDays} dias).\n\n**Top dores:** ${data.topIncomoda.slice(0, 3).map(d => `${d.value} (${d.count})`).join(' · ')}\n**${data.cronogramaNao.count} de ${data.cronogramaNao.total}** mulheres ainda não fazem cronograma capilar.`,
    color: PINK,
    footer: { text: 'Gerado por IA com base nos dados do funil' },
    timestamp: new Date().toISOString(),
  }

  const ideaEmbeds = ideas.slice(0, 5).map((idea, i) => ({
    title: `${ICONS[i] ?? '🎬'} ${i + 1}. ${idea.title}`,
    color: PINK,
    fields: [
      { name: '🪝 Gancho (3s iniciais)', value: idea.hook || '—', inline: false },
      { name: '📝 O que abordar',          value: idea.description || '—', inline: false },
      { name: '👥 Pra quem',                value: idea.target_audience || '—', inline: true },
      { name: '📊 Por que agora',          value: idea.data_signal || '—', inline: true },
    ],
  }))

  try {
    const res = await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Estrategista de Conteúdo · Plano da Ju',
        embeds: [headerEmbed, ...ideaEmbeds],
      }),
    })
    if (!res.ok) {
      return { ok: false, error: `Discord ${res.status}: ${(await res.text()).slice(0, 200)}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'desconhecido' }
  }
}

export async function GET(_req: NextRequest) {
  const sb = createAdminClient()

  // 1) Agrega dados
  const data = await aggregate(sb)

  // 2) Gera ideias
  const result = await generateIdeas(data)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error, data }, { status: 500 })
  }

  // 3) Envia pro Discord
  const sent = await sendToDiscord(result.ideas, data)

  return NextResponse.json({
    ok: sent.ok,
    error: sent.error,
    ideas_count: result.ideas.length,
    sent_at: new Date().toISOString(),
    summary: {
      total_quiz_sessions: data.totalQuizSessions,
      top_pain: data.topIncomoda.slice(0, 3),
      top_chemistry: data.topQuimica.slice(0, 3),
    },
    ideas: result.ideas,
  })
}
