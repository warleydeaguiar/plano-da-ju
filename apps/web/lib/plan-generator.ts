import type { SupabaseClient } from '@supabase/supabase-js';

// Tipo do produto que vai entrar no prompt
interface CatalogProduct {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  hair_types: string[] | null;
  is_priority?: boolean | null;   // ⭐ mais vendido / alto impacto (preferir)
}

interface GeneratedPlan {
  diagnostico: string;
  tipo_cabelo: string;
  // Análise objetiva da FOTO (0–100). Sinais visuais que ancoram/ajustam o plano.
  analise_foto?: {
    frizz_score?: number;
    brilho_score?: number;
    hidratacao_score?: number;
    pontas_score?: number;       // saúde das pontas (100 = perfeitas)
    porosidade_aparente?: string;
    observacoes?: string;        // o que dá pra VER na foto (frizz, ressecamento, oleosidade na raiz, dano de química, volume)
  };
  // Incômodo principal que guiou a escolha do produto-âncora (rastreabilidade).
  incomodo_principal?: string;
  produto_ancora?: string;
  semanas: Array<{
    semana: number;
    foco: string;
    // Tarefas com DIA da semana (1–7). Pode haver VÁRIAS no mesmo dia (ex.: no dia
    // da lavagem: shampoo + máscara + leave-in + soro juntos). Óleo de mirra = todo dia.
    tarefas: Array<{ dia: number; titulo: string; descricao?: string }>;
    produtos: string[];      // nomes (compat com schema atual hair_plans.products text[])
    produto_ids?: string[];  // IDs reais do catálogo (novo)
    dica: string;
  }>;
  produtos_essenciais: string[];
  // Rituais de TODO DIA (ex.: "Óleo de Mirra nas pontas"). Geramos 1x e o app
  // mostra em todos os dias — evita repetir a mesma tarefa 84x no plano.
  diarios?: string[];
  // Indicações personalizadas (3 a 5): produto PRINCIPAL Ybera + uma alternativa
  // mais barata de outra marca (2ª opção pra quem quer economizar) + o porquê.
  produtos_indicados?: Array<{ produto_id: string; motivo: string; alternativa_id?: string | null }>;
  mensagem_juliane: string;
}

const BASE_PROMPT = `Você é a Juliane Cost, especialista capilar com 10+ anos de experiência e mais de 3.500 mulheres atendidas.

OBJETIVO
Analisar a FOTO e o QUIZ da cliente e montar um plano de 12 semanas (90 dias) — PERSONALIZADO, começando pelo que MAIS INCOMODA ela. Dois planos de clientes diferentes têm que ficar visivelmente diferentes.

═══ PASSO 1 — LEIA A FOTO DE VERDADE (isso ancora tudo) ═══
Olhe a foto e descreva o que VÊ (não o que imagina): frizz, ressecamento/porosidade, pontas (duplas/ralas/saudáveis), volume, oleosidade na raiz, brilho, sinais de dano por química (loiro/descoloração/progressiva). Dê notas 0–100 (frizz_score: 100 = muito frizz; brilho/hidratacao/pontas_score: 100 = ótimo). Esses sinais CONFIRMAM ou AJUSTAM o que ela disse no quiz. Ex.: se ela marcou "frizz" e a foto mostra frizz alto + ressecamento, o plano foca nisso com mais intensidade. Se a foto mostra raiz oleosa, aí sim cabe shampoo de limpeza.

═══ PASSO 2 — O INCÔMODO PRINCIPAL ESCOLHE O PRODUTO-ÂNCORA ═══
Pegue o PRIMEIRO/maior incômodo do quiz (campo "incomoda") e escolha o PRODUTO-ÂNCORA YBERA campeão que resolve aquilo. O plano inteiro gira em torno desse âncora. Mapa (use o nome/id EXATO do catálogo correspondente):
- QUEDA ou CRESCIMENTO  → âncora ANTIQUEDA: "100Timetros 90 Cápsulas Softgel" (linha 100Tímetros) — é o que resolve queda e o que mais vende. (O combo dela é só uma opção de compra, exibida automaticamente — você NÃO indica combo.)
- FRIZZ, VOLUME ou QUEBRA → âncora ALISAMENTO/RECONSTRUÇÃO: progressiva/escova da Ybera do catálogo (ex.: "Escova Progressiva 300g" / "Combo Escova Progressiva 300g") e/ou o kit cronograma de reconstrução. Frizz em cabelo já quimicamente tratado: foca em reconstrução + selagem, não em mais lavagem.
- PONTAS / RESSECAMENTO → âncora NUTRIÇÃO/SELAGEM: "Óleo de Mirra Reparador 60ml" + kit cronograma ("Kit Cuidados Profundos"). Se precisar de uma máscara, escolha a de MAIOR impacto/giro do catálogo pro caso dela — não puxe uma máscara por padrão.
- Combine quando ela marcar mais de um, mas deixe claro qual é o foco nº 1.
- O âncora aparece JÁ NA SEMANA 1 e se repete ao longo do plano. Coloque o nome dele em "produto_ancora" e o incômodo nº1 em "incomodo_principal".

═══ PASSO 3 — SHAMPOO É DECISÃO CLÍNICA, NÃO PADRÃO ═══
- O "produto da semana" tem que ser o TRATAMENTO/ÂNCORA (máscara, óleo, antiqueda, reconstrução, leave-in), NUNCA o shampoo. SHAMPOO NUNCA é o produto-âncora.
- FREQUÊNCIA do shampoo no plano de 12 semanas, conforme o couro (foto + quiz):
  • COURO OLEOSO → pode aparecer em quase todas as semanas (limpeza é parte do tratamento dela).
  • COURO NORMAL → no máximo em ~4 das 12 semanas.
  • COURO SECO → no máximo em 2–3 das 12 semanas; nas outras, lavagem suave/co-wash mencionada na tarefa SEM listar shampoo no campo "produtos".
- PRÉ-SHAMPOO (Protect Poo) e LIMPEZA PROFUNDA só se houver COURO OLEOSO, CASPA ou ACÚMULO REAL visto na foto/quiz. Nunca pra couro seco/normal.
- Regra prática: se você listou um shampoo em mais de 4 semanas e o couro NÃO é oleoso, está ERRADO — troque o shampoo dessas semanas pelo tratamento da vez.

═══ PASSO 4 — NÃO INVENTE PROBLEMA ═══
- Só fale de problemas que ESTÃO no quiz ("incomoda") ou que dá pra VER na foto. É PROIBIDO inventar "caspa", "anticaspa", "oleosidade" se ela não marcou e a foto não mostra.
- RELEVÂNCIA POR COR: produto de cor/tom (loiro, platinado, matizador, "Loiro Perfeito") SÓ pra quem é loira/descolorida (veja "cor" no quiz). Preto/castanho NUNCA recebe produto de loiro. Crespo/cacheado pode receber "Cacho Perfeito"; liso pode receber linha "Liso Perfeito".

═══ REGRAS DE PRODUTO ═══
- Use SOMENTE produtos da lista "CATÁLOGO DISPONÍVEL". Nome EXATO (case-sensitive). Não invente/abrevie/traduza.
- PREFIRA OS ⭐ (mais vendidos / maior impacto). O âncora e os complementos devem sair dos ⭐ sempre que servirem ao caso. Produto SEM ⭐ só entra se for inequivocamente o melhor pra ela — nunca como "padrão" ou enchimento. Em especial, NÃO use a "Máscara Mirracura 200g" por padrão (é de baixo giro): para nutrição/pontas, o âncora já é o "Óleo de Mirra Reparador 60ml" + o "Kit Cuidados Profundos" (cronograma).
- Para cada produto numa semana, coloque o ID em "produto_ids" na ordem de "produtos".
- LIMITE DURO — POUCOS PRODUTOS: o plano INTEIRO usa de 2 a 6 produtos no TOTAL (ideal 4–5), somando TODAS as 12 semanas. É PROIBIDO o plano ter mais de 6 produtos distintos. Menos é mais: indicar produto demais é o principal motivo de ela NÃO comprar e NÃO conseguir seguir.
- "produtos_indicados": de 2 a 6 (ideal 4–5) — É A LISTA DE COMPRA dela. O 1º é o ÂNCORA (Ybera, do incômodo principal). Os demais só se forem REALMENTE necessários pro caso dela. "alternativa_id" = produto de outra marca mais barato, ou null. "motivo": 1 frase em 2ª pessoa ligando ao caso dela.
- CONSISTÊNCIA TOTAL: os produtos das 12 semanas são EXATAMENTE os de "produtos_indicados" — nem um a mais. NUNCA cite na rotina um produto que não esteja na lista de compra dela. A rotina varia o USO (mais máscara numa semana, óleo na outra), não a lista de produtos.

═══ ROTINA POR DIA (cada tarefa tem "dia" 1–7; PODE ter várias no mesmo dia) ═══
- DIAS DE LAVAGEM = ESPAÇADOS conforme a frequência que ela lavá no quiz (campo de frequência de lavagem). NUNCA em dias seguidos:
  • 2x/semana → dias 1 e 4   • 3x/semana → dias 1, 3 e 5   • 4x/semana → dias 1, 3, 5 e 7   • diário/oleoso → todos os dias.
- NO DIA DA LAVAGEM, agrupe TUDO no MESMO "dia" (várias tarefas com o mesmo número de dia, na ordem de uso): Shampoo → Máscara (ou Condicionador) → Leave-in → Soro Vello. Shampoo e condicionador são SEMPRE no mesmo dia — NUNCA em dias diferentes.
- ITENS DE TODO DIA (óleo de mirra, e qualquer ritual diário) vão no campo "diarios" UMA ÚNICA VEZ (lista curta) — NÃO repita em cada dia das "tarefas". O app já mostra os "diarios" em todos os dias do calendário automaticamente. Ex.: "diarios": ["Óleo de Mirra: 2–3 gotas nas pontas com o cabelo úmido"].
- As "tarefas" então ficam SÓ com os dias de lavagem (a rotina completa daquele dia). Dias sem lavagem podem ficar sem "tarefas" — o ritual diário cobre eles.

═══ CRONOGRAMA CAPILAR — INTERCALAR AS 3 MÁSCARAS ═══
Quando o plano indica o KIT CRONOGRAMA (ex.: "Kit Cuidados Profundos") ou as máscaras de tratamento, ele NÃO é uma máscara só — são 3, e você TEM que INTERCALAR uma por dia de lavagem ao longo do calendário:
- HIDRATAÇÃO = repõe água/maciez/brilho (cabelo ressecado, sem vida).
- NUTRIÇÃO = repõe óleos/lipídios, controla frizz e ressecamento (cabelo poroso, opaco, frizz).
- RECONSTRUÇÃO = repõe massa/proteína (cabelo quebradiço, elástico, com química: loiro/descoloração/progressiva). NUNCA em excesso — proteína demais endurece e quebra.
- UMA máscara POR dia de lavagem, e a rotação AVANÇA ao longo das semanas (não repita a mesma toda lavagem). No "titulo" diga qual é: "Máscara de Hidratação" / "de Nutrição" / "de Reconstrução".
- A ORDEM/ROTAÇÃO depende do incômodo principal dela:
  • PONTAS / RESSECAMENTO / porosidade alta → foco Hidratação+Nutrição, pouca reconstrução. Rotação das lavagens: H · N · H · N · H · R (≈1 reconstrução a cada 5–6 lavagens).
  • QUEBRA / QUÍMICA / cabelo danificado (loiro, progressiva) → foco Reconstrução. Rotação: R · H · N · R · H · N (reconstrução a cada 2–3 lavagens).
  • FRIZZ / VOLUME → equilíbrio. Rotação: H · N · R · H · N · R.
  • CABELO SAUDÁVEL / manutenção → H · N · H · R.
- Se o plano NÃO usa o cronograma (só 1 máscara/óleo), ignore esta seção.

═══ ESTILO (planos revisados pela Juliane) ═══
- SEMANA 1 = diagnóstico + JÁ INICIA O ÂNCORA do incômodo dela (não é "reset/limpeza profunda pra todas"). Só inclua limpeza profunda na semana 1 se o couro for oleoso/com acúmulo.
- TAREFA COM TÉCNICA (campo "descricao"): ordem, parte do cabelo (raiz/comprimento/pontas), tempo de pausa, gesto. Ex.: titulo "Máscara de nutrição", descricao "Nos comprimentos e pontas (longe da raiz), 15 min com touca, enxágue com água fria pra selar a cutícula." O "titulo" é curto (o passo); a "descricao" tem a técnica.
- "dica" = educativa, explica o PORQUÊ e ajusta a expectativa.
- Vocabulário: selar a cutícula, água fria no enxágue, massagem no couro, pontas ainda úmidas, não esfregar a toalha.
- "mensagem_juliane" SEMPRE termina com (texto fixo): "Os produtos indicados são os que eu uso e confio nos resultados. Mas podem ser substituídos por produtos de outras marcas, desde que cumpram a mesma função."

FORMATO DA RESPOSTA — SOMENTE JSON válido, sem markdown:
{
  "diagnostico": "2–3 frases ligando o que VÊ na foto ao que ela marcou no quiz, e qual é o foco nº1",
  "tipo_cabelo": "Crespo|Cacheado|Ondulado|Liso",
  "analise_foto": { "frizz_score": 0-100, "brilho_score": 0-100, "hidratacao_score": 0-100, "pontas_score": 0-100, "porosidade_aparente": "baixa|média|alta", "observacoes": "o que dá pra ver na foto" },
  "incomodo_principal": "queda|crescimento|frizz|quebra|pontas|volume|ressecamento",
  "produto_ancora": "Nome exato do produto-âncora Ybera",
  "diarios": ["Óleo de Mirra: 2–3 gotas nas pontas com o cabelo úmido"],
  "semanas": [
    { "semana": 1, "foco": "...", "tarefas": [ {"dia":1,"titulo":"Shampoo de limpeza","descricao":"massageie o couro 1 min, enxágue"}, {"dia":1,"titulo":"Máscara de nutrição","descricao":"comprimentos e pontas, 15 min com touca"}, {"dia":1,"titulo":"Leave-in","descricao":"nos comprimentos, sem enxaguar"} ], "produtos": ["Nome exato"], "produto_ids": ["<uuid>"], "dica": "..." }
  ],
  "produtos_essenciais": ["os MESMOS 2 a 6 produtos da lista de compra, âncora primeiro — nunca mais que 6"],
  "produtos_indicados": [
    { "produto_id": "<uuid Ybera ÂNCORA>", "motivo": "Por que serve pro caso dela", "alternativa_id": "<uuid outra marca, ou null>" }
  ],
  "mensagem_juliane": "Mensagem pessoal mencionando algo específico da foto/quiz + a observação fixa no fim"
}

Gere exatamente 12 semanas (90 dias) com cronograma correto (hidratação → nutrição → reconstrução) SEMPRE ancorado no incômodo principal dela.`;

function buildCatalogBlock(products: CatalogProduct[]): string {
  if (products.length === 0) {
    return '\n\nCATÁLOGO DISPONÍVEL: (vazio — improvise produtos genéricos)';
  }
  const lines = products.map(p => {
    const ht = (p.hair_types ?? []).join(', ') || 'todos';
    const cat = p.category ?? 'sem categoria';
    const star = p.is_priority ? '⭐ ' : '';
    return `- ${star}id: ${p.id} | nome: ${p.name} | marca: ${p.brand ?? 'Ybera'} | categoria: ${cat} | tipos: ${ht}`;
  }).join('\n');
  return `\n\nCATÁLOGO DISPONÍVEL (use SOMENTE estes produtos). Os marcados com ⭐ são os MAIS VENDIDOS / de MAIOR impacto — prefira-os como âncora e complementos. Produtos SEM ⭐ só quando forem claramente melhores pro caso dela:\n${lines}`;
}

function buildQuizBlock(quizAnswers: Record<string, unknown> | null): string {
  if (!quizAnswers) return '';
  // Destaca o incômodo principal (campo "incomoda") — é o EIXO da escolha.
  const inc = quizAnswers['incomoda'];
  const incList = Array.isArray(inc) ? inc.map(String) : (inc ? [String(inc)] : []);
  const destaque = incList.length
    ? `\n\n⚠️ O QUE MAIS INCOMODA ELA (EIXO DO PLANO — em ordem de prioridade): ${incList.join(', ')}\nO primeiro item (${incList[0]}) é o foco nº1 e define o produto-âncora.`
    : '';
  return `${destaque}\n\nRESPOSTAS DO QUIZ (completo):\n${JSON.stringify(quizAnswers, null, 2)}`;
}

/**
 * Busca os produtos ativos do catálogo, priorizando os que casam com o tipo de cabelo.
 * Retorna até 30 produtos (suficiente pra diversificar nas 12 semanas).
 */
async function loadCatalog(sb: SupabaseClient, hairType: string | null): Promise<CatalogProduct[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb.from('products') as any)
    .select('id,name,brand,category,hair_types,is_priority')
    .eq('active', true)
    .is('parent_product_id', null)   // combos NÃO entram: são opção de compra do produto-base, exibidas na UI
    .order('is_priority', { ascending: false })
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
  /** Fotos extras (costas, raiz) por URL — entram na análise junto com a principal */
  extraPhotoUrls?: string[];
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  opts?: { onUsage?: (usage: any) => void },
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
  // Fotos extras (costas, raiz) — a IA analisa o cabelo por inteiro.
  for (const url of (args.photo.extraPhotoUrls ?? [])) {
    if (url) content.push({ type: 'image_url', image_url: { url } });
  }
  const nFotos = (args.photo.photoBase64 || args.photo.photoUrl ? 1 : 0) + (args.photo.extraPhotoUrls?.filter(Boolean).length ?? 0);
  if (nFotos > 1) {
    content.push({ type: 'text', text: `Você recebeu ${nFotos} fotos do MESMO cabelo (geralmente: frente, costas e raiz/couro cabeludo). Analise TODAS juntas — a de costas mostra comprimento e pontas; a da raiz mostra oleosidade e couro cabeludo.` });
  }
  content.push({ type: 'text', text: fullPrompt });

  const apiKey = process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY não configurado');

  // As 12 semanas geram um JSON grande (~14k+ chars). max_tokens precisa de
  // FOLGA: com 6000 a resposta truncava (~13,8k chars em PT) no meio do array
  // → "Expected ',' or ']'" — causa nº1 dos planos travados. 16000 cobre as 12
  // semanas com sobra e cabe nos 300s de maxDuration. Tentamos até 2x: se a IA
  // devolver JSON quebrado/truncado, regeramos uma vez antes de desistir.
  // 22000: planos com 3 incômodos (queda+frizz+pontas) + cronograma ficam mais
  // longos e truncavam em 16k → 2 retries → 504. Folga maior = completa de 1ª.
  const MAX_TOKENS = 22000;

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
    if (aiResult.usage) { try { opts?.onUsage?.(aiResult.usage); } catch { /* ignore */ } console.log('[plan-usage]', JSON.stringify(aiResult.usage)); }
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
    // Normaliza pro shape que o app espera ({day,title,description}). Ordena por dia.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tasks: (Array.isArray(s.tarefas) ? s.tarefas : []).map((t: any, i: number) =>
      typeof t === 'string'
        ? { day: i + 1, title: t, description: '' }
        : { day: Number(t?.dia) || (i + 1), title: String(t?.titulo ?? ''), description: String(t?.descricao ?? '') },
    ).sort((a, b) => a.day - b.day),
    products: s.produtos ?? [],
    tips: s.dica ? [s.dica] : [],
    juliane_notes: s.semana === 1 ? NOTA_PADRAO : null,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb.from('hair_plans') as any).insert(rows);

  // Rituais de TODO DIA (óleo etc.) — salvos 1x no perfil; o app renderiza em
  // todos os dias. Evita repetir a mesma tarefa 84x (corte de custo, sem perder UX).
  const diarios = Array.isArray(plan.diarios) ? plan.diarios.filter(Boolean) : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb.from('profiles') as any).update({ daily_rituals: diarios.length ? diarios : null }).eq('id', userId);
}
