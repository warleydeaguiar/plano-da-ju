import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

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

    if (!profile.photo_url) {
      return NextResponse.json({
        error: 'Usuária não tem foto cadastrada. Pra regerar o plano ela precisa subir uma foto primeiro.'
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

Gere TODAS as 52 semanas (cronograma capilar: hidratação/nutrição/reconstrução em rotação).`

    // 3) Chama Claude com foto via URL
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'OPENROUTER_API_KEY não configurado' }, { status: 500 })

    const aiResp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://planodaju.julianecost.com',
        'X-Title': 'Plano da Ju Admin',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-6',
        max_tokens: 12000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: profile.photo_url } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    })

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
