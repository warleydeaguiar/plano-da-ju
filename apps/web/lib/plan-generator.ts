import type { SupabaseClient } from '@supabase/supabase-js';

// Tipo do produto que vai entrar no prompt
interface CatalogProduct {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  hair_types: string[] | null;
}

interface GeneratedPlan {
  diagnostico: string;
  tipo_cabelo: string;
  semanas: Array<{
    semana: number;
    foco: string;
    tarefas: string[];
    produtos: string[];      // nomes (compat com schema atual hair_plans.products text[])
    produto_ids?: string[];  // IDs reais do catálogo (novo)
    dica: string;
  }>;
  produtos_essenciais: string[];
  mensagem_juliane: string;
}

const BASE_PROMPT = `Você é a Juliane Cost, especialista capilar com 10+ anos de experiência e mais de 3.500 mulheres atendidas.

OBJETIVO
Analisar a foto e o quiz da cliente e gerar um plano de 52 semanas — cronograma de hidratação/nutrição/reconstrução adaptado ao tipo de cabelo, química e problemas dela.

REGRAS DURAS
- NUNCA use nomenclatura técnica (2B, 3A, 4C). Use apenas: Crespo, Cacheado, Ondulado, Liso.
- Tom: caloroso, motivador, direto. Sem clichês de marketing.
- Cada semana tem 1 foco, 2–3 tarefas e 1–2 produtos.

PRODUTOS — REGRA CRÍTICA
- Use SOMENTE produtos da lista "CATÁLOGO DISPONÍVEL" abaixo.
- Refira-se a cada produto pelo NOME EXATO da lista (case-sensitive). Não invente, não abrevie, não traduza.
- Distribua os produtos pelas 52 semanas. Repita produtos entre semanas quando fizer sentido.
- Se a lista estiver curta, é melhor repetir os mesmos do que inventar.
- Para cada produto que recomendar numa semana, coloque o ID dele em "produto_ids" na ordem correspondente a "produtos".

FORMATO DA RESPOSTA
Retorne SOMENTE um JSON válido, sem markdown, sem texto extra:
{
  "diagnostico": "Análise em 2–3 frases do cabelo visto na foto + perfil do quiz",
  "tipo_cabelo": "Crespo|Cacheado|Ondulado|Liso",
  "semanas": [
    {
      "semana": 1,
      "foco": "Hidratação intensa — recuperar umidade",
      "tarefas": ["Lavar com shampoo do catálogo", "Aplicar máscara hidratante 20min", "Finalizar com leave-in"],
      "produtos": ["Nome exato do produto 1", "Nome exato do produto 2"],
      "produto_ids": ["<uuid-1>", "<uuid-2>"],
      "dica": "Dica motivadora curta"
    }
  ],
  "produtos_essenciais": ["5 a 8 nomes exatos do catálogo, em ordem de prioridade"],
  "mensagem_juliane": "Mensagem pessoal, em 2–3 frases, mencionando algo específico do quiz ou da foto"
}

Gere 16 semanas (4 meses) seguindo cronograma capilar correto (hidratação → nutrição → reconstrução em rotação adequada ao tipo de cabelo da cliente). O admin pode estender depois.`;

function buildCatalogBlock(products: CatalogProduct[]): string {
  if (products.length === 0) {
    return '\n\nCATÁLOGO DISPONÍVEL: (vazio — improvise produtos genéricos)';
  }
  const lines = products.map(p => {
    const ht = (p.hair_types ?? []).join(', ') || 'todos';
    const cat = p.category ?? 'sem categoria';
    return `- id: ${p.id} | nome: ${p.name} | marca: ${p.brand ?? 'Ybera'} | categoria: ${cat} | tipos: ${ht}`;
  }).join('\n');
  return `\n\nCATÁLOGO DISPONÍVEL (use SOMENTE estes produtos):\n${lines}`;
}

function buildQuizBlock(quizAnswers: Record<string, unknown> | null): string {
  if (!quizAnswers) return '';
  return `\n\nRESPOSTAS DO QUIZ:\n${JSON.stringify(quizAnswers, null, 2)}`;
}

/**
 * Busca os produtos ativos do catálogo, priorizando os que casam com o tipo de cabelo.
 * Retorna até 30 produtos (suficiente pra diversificar nas 52 semanas).
 */
async function loadCatalog(sb: SupabaseClient, hairType: string | null): Promise<CatalogProduct[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb.from('products') as any)
    .select('id,name,brand,category,hair_types')
    .eq('active', true)
    .limit(50);
  const all: CatalogProduct[] = (data ?? []) as CatalogProduct[];
  if (!hairType || all.length === 0) return all;

  const h = hairType.toLowerCase();
  // Priorizar produtos cujo hair_types contenha o tipo da cliente.
  const matching = all.filter(p => (p.hair_types ?? []).some(t => t.toLowerCase() === h));
  const others = all.filter(p => !matching.includes(p));
  return [...matching, ...others].slice(0, 30);
}

interface GenerateOptions {
  /** Foto em base64 (opcional — quando regenera um plano sem foto nova, busca da storage) */
  photoBase64?: string;
  photoMimeType?: string;
  /** URL pública/assinada de uma foto já hospedada — usada quando regenera */
  photoUrl?: string;
}

/**
 * Chama Claude com a foto + quiz + catálogo real e retorna o plano estruturado.
 * Não persiste nada — o caller decide o que fazer.
 */
export async function generatePlanWithClaude(
  sb: SupabaseClient,
  args: {
    email: string;
    hairType?: string | null;
    quizAnswers: Record<string, unknown> | null;
    photo: GenerateOptions;
  },
): Promise<GeneratedPlan> {
  const catalog = await loadCatalog(sb, args.hairType ?? null);

  const fullPrompt = BASE_PROMPT + buildCatalogBlock(catalog) + buildQuizBlock(args.quizAnswers);

  // Monta o content da mensagem — se tem base64, usa data URL; se tem URL, usa direto.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = [];
  if (args.photo.photoBase64) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${args.photo.photoMimeType || 'image/jpeg'};base64,${args.photo.photoBase64}` },
    });
  } else if (args.photo.photoUrl) {
    content.push({
      type: 'image_url',
      image_url: { url: args.photo.photoUrl },
    });
  }
  content.push({ type: 'text', text: fullPrompt });

  const apiKey = process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY não configurado');

  // AbortController + max_tokens reduzido — antes (52 semanas/12k tokens)
  // estourava 504 do Vercel. 16 semanas/6k tokens fica em ~45-90s.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 240_000);

  let response: Response;
  try {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://planodaju.julianecost.com',
        'X-Title': 'Plano da Ju',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-6',
        max_tokens: 6000,
        messages: [{ role: 'user', content }],
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`OpenRouter ${response.status}: ${errBody.slice(0, 400)}`);
  }

  const aiResult = await response.json();
  const text = aiResult.choices?.[0]?.message?.content || '';

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('JSON do plano não encontrado na resposta da IA');

  const plan = JSON.parse(jsonMatch[0]) as GeneratedPlan;
  // Validações mínimas
  if (!Array.isArray(plan.semanas) || plan.semanas.length === 0) {
    throw new Error('Plano sem semanas válidas');
  }
  return plan;
}

/**
 * Persiste o plano gerado: limpa hair_plans anteriores do user e insere as novas.
 */
export async function savePlanToDb(
  sb: SupabaseClient,
  userId: string,
  plan: GeneratedPlan,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb.from('hair_plans') as any).delete().eq('user_id', userId);

  const rows = plan.semanas.map(s => ({
    user_id: userId,
    week_number: s.semana,
    focus: s.foco,
    tasks: s.tarefas ?? [],
    products: s.produtos ?? [],
    tips: s.dica ? [s.dica] : [],
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb.from('hair_plans') as any).insert(rows);
}
