import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
// Max do Vercel Pro = 300s. Antes era 120 — mas com 52 semanas de Claude
// (~12k tokens output) podia estourar 60s do Hobby ou 120 nosso.
export const maxDuration = 300

// Gerar 52 semanas de UMA vez = ~3-4min. Estouramos timeout do Vercel.
// 16 semanas (4 meses) = ~45-90s, MUITO mais seguro e ainda é
// conteúdo suficiente pra cliente começar. Admin pode pedir "extender"
// no futuro pra gerar mais semanas.
const WEEKS_TO_GENERATE = 16
const CLAUDE_TIMEOUT_MS = 240_000  // 4min — deixa buffer dentro dos 300s do Vercel

/**
 * POST /api/admin/profiles/[id]/regenerate-plan
 *
 * Regera o hair_plan da usuária usando o CATÁLOGO REAL atualizado.
 * Reusa a foto que já está salva (profiles.photo_url ou photo_url no storage).
 *
 * Body: { confirm: true }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const body = await req.json().catch(() => ({}))
    if (!body.confirm) {
      return NextResponse.json({ error: 'Confirmação necessária (confirm: true)' }, { status: 400 })
    }

    const sb = createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (sb.from('profiles') as any)
      .select('id, email, full_name, hair_type, quiz_answers, photo_url')
      .eq('id', id)
      .single()
    if (!profile) return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 })

    // Foto não é obrigatória — se não tem, gera só com base no quiz
    const hasPhoto = Boolean(profile.photo_url)
    if (!hasPhoto && !profile.quiz_answers) {
      return NextResponse.json({
        error: 'Usuária não tem nem foto nem quiz respondido. Sem dados pra gerar plano.'
      }, { status: 400 })
    }

    // 1) Catálogo (filtrado por tipo de cabelo da cliente)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: allProducts } = await (sb.from('products') as any)
      .select('id,name,brand,category,hair_types')
      .eq('active', true)
      .limit(50)

    const h = (profile.hair_type ?? '').toLowerCase()
    const all = (allProducts ?? []) as Array<{ id: string; name: string; brand: string|null; category: string|null; hair_types: string[]|null }>
    const matching = h ? all.filter(p => (p.hair_types ?? []).some(t => t.toLowerCase() === h)) : all
    const others = all.filter(p => !matching.includes(p))
    const catalog = [...matching, ...others].slice(0, 30)

    if (catalog.length === 0) {
      return NextResponse.json({ error: 'Catálogo vazio — cadastre produtos antes de regerar planos' }, { status: 400 })
    }

    // 2) Monta prompt
    const catalogBlock = catalog.map(p => {
      const ht = (p.hair_types ?? []).join(', ') || 'todos'
      const cat = p.category ?? 'sem categoria'
      return `- id: ${p.id} | nome: ${p.name} | marca: ${p.brand ?? 'Ybera'} | categoria: ${cat} | tipos: ${ht}`
    }).join('\n')

    const quizBlock = profile.quiz_answers
      ? `\n\nRESPOSTAS DO QUIZ:\n${JSON.stringify(profile.quiz_answers, null, 2)}`
      : ''

    const prompt = `Você é a Juliane Cost, especialista capilar com 10+ anos de experiência e mais de 3.500 mulheres atendidas.

OBJETIVO
Gerar plano capilar personalizado de 52 semanas pra cliente abaixo, analisando a foto e as respostas do quiz.

REGRAS DURAS
- Tom: caloroso, motivador, direto. Sem clichês.
- NUNCA use 2B/3A/4C. Use Crespo, Cacheado, Ondulado, Liso.
- Cada semana tem 1 foco, 2–3 tarefas, 1–2 produtos.

PRODUTOS — REGRA CRÍTICA
- Use SOMENTE produtos do "CATÁLOGO DISPONÍVEL" abaixo.
- Refira-se aos produtos pelo NOME EXATO da lista. Não invente, não abrevie.
- Repita produtos entre semanas quando fizer sentido (catálogo é finito).

CATÁLOGO DISPONÍVEL (use APENAS estes ${catalog.length} produtos):
${catalogBlock}${quizBlock}

Responda SOMENTE com JSON válido (sem markdown, sem texto extra):
{
  "diagnostico": "2-3 frases sobre cabelo+quiz",
  "tipo_cabelo": "Crespo|Cacheado|Ondulado|Liso",
  "semanas": [
    { "semana": 1, "foco": "...", "tarefas": [...], "produtos": ["nome exato 1", "nome exato 2"], "dica": "..." }
  ],
  "produtos_essenciais": ["5–8 nomes exatos do catálogo"],
  "mensagem_juliane": "Mensagem pessoal mencionando algo específico do quiz/foto"
}

Gere ${WEEKS_TO_GENERATE} semanas (cronograma capilar: hidratação/nutrição/reconstrução em rotação).`

    // 3) Chama Claude com foto via URL
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'OPENROUTER_API_KEY não configurado' }, { status: 500 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aiContent: any[] = []
    if (hasPhoto) {
      aiContent.push({ type: 'image_url', image_url: { url: profile.photo_url } })
    }
    aiContent.push({ type: 'text', text: prompt + (hasPhoto ? '' : '\n\nObs: a cliente ainda não enviou foto — gere o plano baseado SOMENTE nas respostas do quiz, sem mencionar análise visual no diagnóstico.') })

    // AbortController pra parar a chamada se a Claude ficar pendurada
    // antes do Vercel encerrar o function por timeout (que mata o processo)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), CLAUDE_TIMEOUT_MS)

    let aiResp: Response
    try {
      aiResp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://planodaju.julianecost.com',
          'X-Title': 'Plano da Ju Admin',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-sonnet-4-6',
          // 16 semanas × ~250 tokens cada + JSON overhead = ~5000 tokens safety net
          max_tokens: 6000,
          messages: [{ role: 'user', content: aiContent }],
        }),
        signal: controller.signal,
      })
    } catch (err) {
      clearTimeout(timeoutId)
      const isAbort = err instanceof Error && err.name === 'AbortError'
      return NextResponse.json({
        error: isAbort
          ? `Timeout: a IA demorou mais de ${CLAUDE_TIMEOUT_MS / 1000}s. Tenta de novo.`
          : `Erro de rede ao chamar IA: ${err instanceof Error ? err.message : 'desconhecido'}`,
      }, { status: 504 })
    }
    clearTimeout(timeoutId)

    if (!aiResp.ok) {
      const txt = await aiResp.text()
      return NextResponse.json({ error: `OpenRouter ${aiResp.status}: ${txt.slice(0, 400)}` }, { status: 502 })
    }

    const ai = await aiResp.json()
    const content = ai.choices?.[0]?.message?.content || ''
    const m = content.match(/\{[\s\S]*\}/)
    if (!m) return NextResponse.json({ error: 'JSON do plano não encontrado na resposta da IA' }, { status: 502 })

    const plan = JSON.parse(m[0])
    if (!Array.isArray(plan.semanas) || plan.semanas.length === 0) {
      return NextResponse.json({ error: 'Plano retornado sem semanas válidas' }, { status: 502 })
    }

    // 4) Persiste
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb.from('hair_plans') as any).delete().eq('user_id', id)

    const rows = plan.semanas.map((s: any) => ({
      user_id: id,
      week_number: s.semana,
      focus: s.foco ?? '',
      tasks: s.tarefas ?? [],
      products: s.produtos ?? [],
      tips: s.dica ? [s.dica] : [],
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb.from('hair_plans') as any).insert(rows)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb.from('profiles') as any).update({
      plan_status: 'ready',
      plan_released_at: new Date().toISOString(),
      hair_type: plan.tipo_cabelo?.toLowerCase() ?? profile.hair_type,
    }).eq('id', id)

    return NextResponse.json({
      ok: true,
      weeks_generated: plan.semanas.length,
      tipo_cabelo: plan.tipo_cabelo,
      diagnostico: plan.diagnostico,
      mensagem_juliane: plan.mensagem_juliane,
      produtos_essenciais: plan.produtos_essenciais ?? [],
      catalog_size: catalog.length,
    })
  } catch (err) {
    console.error('[admin/profiles/regenerate-plan]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro inesperado' }, { status: 500 })
  }
}
