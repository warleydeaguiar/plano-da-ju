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
  // Indicações personalizadas (3 a 5): produto PRINCIPAL Ybera + uma alternativa
  // mais barata de outra marca (2ª opção pra quem quer economizar) + o porquê.
  produtos_indicados?: Array<{ produto_id: string; motivo: string; alternativa_id?: string | null }>;
  mensagem_juliane: string;
}

const BASE_PROMPT = `Você é a Juliane Cost, especialista capilar com 10+ anos de experiência e mais de 3.500 mulheres atendidas.

OBJETIVO
Analisar a foto e o quiz da cliente e gerar um plano de 12 semanas (90 dias) — cronograma de hidratação/nutrição/reconstrução adaptado ao tipo de cabelo, química e problemas dela.

REGRAS DURAS
- NUNCA use nomenclatura técnica (2B, 3A, 4C). Use apenas: Crespo, Cacheado, Ondulado, Liso.
- Tom: caloroso, motivador, direto. Sem clichês de marketing.
- Cada semana tem 1 foco, 2–3 tarefas e 1–2 produtos.

PRODUTOS — REGRA CRÍTICA
- Use SOMENTE produtos da lista "CATÁLOGO DISPONÍVEL" abaixo.
- Refira-se a cada produto pelo NOME EXATO da lista (case-sensitive). Não invente, não abrevie, não traduza.
- Distribua os produtos pelas 12 semanas. Repita produtos entre semanas quando fizer sentido.
- Se a lista estiver curta, é melhor repetir os mesmos do que inventar.
- Para cada produto que recomendar numa semana, coloque o ID dele em "produto_ids" na ordem correspondente a "produtos".

INDICAÇÕES PERSONALIZADAS ("produtos_indicados") — REGRAS DE OURO
- Liste de 3 a 5 indicações (NÃO mais — são só 12 semanas, não pode pesar no bolso da cliente).
- Em CADA indicação, o produto PRINCIPAL ("produto_id") é SEMPRE um produto YBERA do catálogo (is_ybera).
- Em "alternativa_id", coloque o ID de um produto de OUTRA marca (NÃO Ybera) do catálogo que sirva como versão mais barata pro mesmo objetivo — a 2ª opção pra quem quer economizar. Se não houver alternativa adequada no catálogo, use null. NUNCA deixe a cliente achar que só indicamos Ybera.
- "motivo": 1 frase curta, em 2ª pessoa ("seu cabelo…"), dizendo POR QUE serve pro caso ESPECÍFICO dela (tipo, química, problema). Sem jargão.
- CARROS-CHEFE da Ybera (priorize quando fizer sentido pro caso dela — a maioria precisa): Cronograma capilar (kit), Progressiva Fashion Gold, Antiqueda, Óleo de Mirra. Use os nomes/ids exatos do catálogo.
- RELEVÂNCIA POR COR: NUNCA indique produtos específicos de cor/tom (ex.: "loiro", "platinado", "ruivo", "matizador", "blond") se NÃO corresponder à cor do cabelo dela (veja a cor no quiz). Cabelo preto/castanho/crespo NÃO usa produto de loiro.
- CONSISTÊNCIA: os produtos citados nas SEMANAS (rotina) devem sair das suas "produtos_indicados" (principal ou alternativa). NÃO cite na rotina nenhum produto que não esteja nas suas indicações — a cliente precisa entender que o que ela compra é o que usa.

PADRÕES DOS PLANOS REVISADOS PELA JULIANE (siga à risca — foi assim que os melhores planos ficaram)
- SEMANA 1 É SEMPRE DIAGNÓSTICO + LIMPEZA PROFUNDA / RESET DO COURO. Nada agressivo: zerar o acúmulo de resíduos e "só observar" como o fio responde. Ex. de foco: "Reset do couro cabeludo — limpeza profunda e equilíbrio". Só a partir da semana 2 entra o cronograma de hidratação/nutrição/reconstrução.
- TAREFAS COM TÉCNICA, NÃO GENÉRICAS. Cada tarefa diz COMO fazer, não só "use o produto X". Inclua: ordem (ex.: PRÉ-SHAMPOO antes do shampoo), parte do cabelo (raiz/comprimento/pontas), tempo de pausa, frequência na semana ("lave 2x") e o gesto ("massageando o couro", "nas pontas ainda úmidas", "finalize com água fria pra selar a cutícula", "1 gota de óleo nas pontas").
  RUIM: "Aplicar máscara hidratante 20min."
  BOM: "Aplique a Máscara Mirracura 200g nos comprimentos e pontas (longe da raiz), deixe 15 min com touca e enxágue com água fria pra selar a cutícula."
- DICA ("dica") = educativa e gentil, explicando o PORQUÊ e ajustando a expectativa. Ex.: "O pré-shampoo é o segredo pra não agredir o couro oleoso." / "Nesta 1ª semana o objetivo é só observar — não espere transformação ainda." / "Não esfregue a toalha: pressione suavemente pra não abrir a cutícula."
- VOCABULÁRIO DA ESPECIALISTA (use quando couber): pré-shampoo, selar a cutícula, água fria no enxágue final, massagem no couro, pontas ainda úmidas, pente de dentes largos, não esfregar a toalha.
- A "mensagem_juliane" deve SEMPRE terminar com esta observação padrão (texto fixo, não altere): "Os produtos indicados são os que eu uso e confio nos resultados. Mas podem ser substituídos por produtos de outras marcas, desde que cumpram a mesma função."

FORMATO DA RESPOSTA
Retorne SOMENTE um JSON válido, sem markdown, sem texto extra:
{
  "diagnostico": "Análise em 2–3 frases do cabelo visto na foto + perfil do quiz",
  "tipo_cabelo": "Crespo|Cacheado|Ondulado|Liso",
  "semanas": [
    {
      "semana": 1,
      "foco": "Reset do couro cabeludo — limpeza profunda pra zerar o acúmulo",
      "tarefas": ["Aplique o <pré-shampoo do catálogo> nos fios secos antes de lavar, massageando o couro por 2 min", "Lave com o <shampoo do catálogo> focando a espuma na raiz e enxágue bem", "Finalize com água fria nos fios pra selar a cutícula — sem máscara nesta semana"],
      "produtos": ["Nome exato do produto 1", "Nome exato do produto 2"],
      "produto_ids": ["<uuid-1>", "<uuid-2>"],
      "dica": "Nesta 1ª semana o objetivo é só observar como o fio responde — não espere transformação ainda."
    }
  ],
  "produtos_essenciais": ["5 a 8 nomes exatos do catálogo, em ordem de prioridade"],
  "produtos_indicados": [
    { "produto_id": "<uuid Ybera principal>", "motivo": "Por que serve pro caso dela, 1 linha", "alternativa_id": "<uuid de outra marca mais barata, ou null>" }
  ],
  "mensagem_juliane": "Mensagem pessoal, em 2–3 frases, mencionando algo específico do quiz ou da foto"
}

Gere exatamente 12 semanas (90 dias) seguindo cronograma capilar correto (hidratação → nutrição → reconstrução em rotação adequada ao tipo de cabelo da cliente).`;

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
 * Retorna até 30 produtos (suficiente pra diversificar nas 12 semanas).
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

  // As 12 semanas geram um JSON grande (~14k+ chars). max_tokens precisa de
  // FOLGA: com 6000 a resposta truncava (~13,8k chars em PT) no meio do array
  // → "Expected ',' or ']'" — causa nº1 dos planos travados. 16000 cobre as 12
  // semanas com sobra e cabe nos 300s de maxDuration. Tentamos até 2x: se a IA
  // devolver JSON quebrado/truncado, regeramos uma vez antes de desistir.
  const MAX_TOKENS = 16000;

  async function requestPlan(): Promise<GeneratedPlan> {
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
          max_tokens: MAX_TOKENS,
          messages: [{ role: 'user', content }],
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errBody = await response.text();
      // Mensagem amigável quando a chave do OpenRouter ficou sem crédito —
      // o problema é da conta (limite diário / créditos), não do código.
      if (response.status === 402) {
        let detail = '';
        try { detail = (JSON.parse(errBody)?.error?.message ?? '').slice(0, 280); } catch { /* ignore */ }
        throw new Error(
          `Sem créditos suficientes na chave do OpenRouter (HTTP 402). `
          + `Adicione créditos ou aumente o limite diário em `
          + `https://openrouter.ai/settings/credits e tente "Gerar com IA" de novo. `
          + (detail ? `Detalhe: ${detail}` : '')
        );
      }
      throw new Error(`OpenRouter ${response.status}: ${errBody.slice(0, 400)}`);
    }

    const aiResult = await response.json();
    const finishReason = aiResult.choices?.[0]?.finish_reason;
    const text = aiResult.choices?.[0]?.message?.content || '';
    // Se a resposta foi cortada por tamanho, o JSON está incompleto — não
    // adianta tentar fazer parse, melhor sinalizar pra repetir.
    if (finishReason === 'length') throw new Error('Resposta da IA truncada (finish_reason=length)');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON do plano não encontrado na resposta da IA');

    const plan = JSON.parse(jsonMatch[0]) as GeneratedPlan;
    if (!Array.isArray(plan.semanas) || plan.semanas.length === 0) {
      throw new Error('Plano sem semanas válidas');
    }
    return plan;
  }

  let lastErr: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await requestPlan();
    } catch (e) {
      lastErr = e;
      // Erro de crédito (402) não se resolve repetindo — propaga na hora.
      if (e instanceof Error && e.message.includes('HTTP 402')) throw e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Falha ao gerar plano');
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

  // Nota padrão da Juliane (mesma dos planos revisados manualmente) — já vem
  // preenchida na semana 1 pra não precisar adicionar à mão na aprovação.
  const NOTA_PADRAO = 'Os produtos indicados são os que eu uso e confio nos resultados. Mas podem ser substituídos por produtos de outras marcas, desde que cumpram a mesma função.';
  const rows = plan.semanas.map(s => ({
    user_id: userId,
    week_number: s.semana,
    focus: s.foco,
    tasks: s.tarefas ?? [],
    products: s.produtos ?? [],
    tips: s.dica ? [s.dica] : [],
    juliane_notes: s.semana === 1 ? NOTA_PADRAO : null,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb.from('hair_plans') as any).insert(rows);
}
