import type { SupabaseClient } from '@supabase/supabase-js';

// Tipo do produto que vai entrar no prompt
interface CatalogProduct {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  hair_types: string[] | null;
  is_priority?: boolean | null;   // ⭐ mais vendido / alto impacto (preferir)
  is_ybera?: boolean | null;      // marca da casa (principal é sempre Ybera)
}

interface GeneratedPlan {
  diagnostico: string;
  tipo_cabelo: string;
  // Análise objetiva da FOTO (escala 1–5, casando com a constraint de photo_analyses).
  analise_foto?: {
    frizz_score?: number;        // 1 = pouco frizz … 5 = muito frizz
    brilho_score?: number;       // 1 = opaco … 5 = muito brilho
    hidratacao_score?: number;   // 1 = ressecado … 5 = bem hidratado
    pontas_score?: number;       // 1 = pontas ruins … 5 = pontas saudáveis
    porosidade_aparente?: string;
    observacoes?: string;        // o que dá pra VER na foto (tom da Ju falando com a cliente)
  };
  // Incômodo principal que guiou a escolha do produto-âncora (rastreabilidade).
  incomodo_principal?: string;
  produto_ancora?: string;
  semanas: Array<{
    semana: number;
    foco: string;
    tarefas: Array<{ dia: number; titulo: string; descricao?: string }>;
    produtos: string[];      // nomes (compat com schema atual hair_plans.products text[])
    produto_ids?: string[];  // IDs reais do catálogo (novo)
    dica: string;
  }>;
  produtos_essenciais: string[];
  diarios?: string[];
  produtos_indicados?: Array<{ produto_id: string; motivo: string; alternativa_id?: string | null }>;
  carta_ju?: string;
  mensagem_juliane: string;
}

// ════════════════════════════════════════════════════════════════════════════
// CONSTRAINED GENERATION: a IA (Sonnet) DECIDE o tratamento e devolve um JSON
// PEQUENO (códigos de cronograma + produtos + carta + análise da foto). As 12
// semanas são montadas por TEMPLATE em código (assembleSemanas) — a IA NÃO
// reescreve o texto operacional repetido. Corta ~80% dos tokens de saída (o caro)
// SEM perder personalização: cronograma, produtos, carta e análise seguem 100%
// baseados no quiz + foto da cliente.
// ════════════════════════════════════════════════════════════════════════════
const CONSTRAINED_PROMPT = `Você é a Juliane Cost, especialista capilar com 10+ anos de experiência e mais de 3.500 mulheres atendidas.

OBJETIVO
Analisar a FOTO e o QUIZ da cliente e DECIDIR o tratamento de 12 semanas (90 dias) — PERSONALIZADO, começando pelo que MAIS INCOMODA ela. Você NÃO escreve as 12 semanas: devolve só as DECISÕES (códigos) e os TEXTOS ÚNICOS (carta, diagnóstico, análise da foto). O sistema monta o cronograma dia a dia a partir dos seus códigos.

═══ PASSO 1 — LEIA A FOTO DE VERDADE (isso ancora tudo) ═══
Olhe a foto e descreva o que VÊ (não o que imagina): frizz, ressecamento/porosidade, pontas (duplas/ralas/saudáveis), volume, oleosidade na raiz, brilho, sinais de dano por química (loiro/descoloração/progressiva), e sinais bons (fios novos nascendo na raiz, comprimento preservado). Seja PRECISA e GENTIL — não exagere o dano nem confunda fios novos nascendo com fios brancos. Dê notas 1–5 (frizz_score: 5 = muito frizz; brilho/hidratacao/pontas_score: 5 = ótimo). Esses sinais CONFIRMAM ou AJUSTAM o quiz.

═══ PASSO 2 — O INCÔMODO PRINCIPAL ESCOLHE O PRODUTO-ÂNCORA ═══
Pegue o PRIMEIRO/maior incômodo do quiz ("incomoda") e escolha o PRODUTO-ÂNCORA YBERA campeão. Mapa:
- QUEDA ou CRESCIMENTO → âncora ANTIQUEDA "100Timetros 90 Cápsulas Softgel".
- FRIZZ, VOLUME ou QUEBRA → âncora RECONSTRUÇÃO (kit cronograma / progressiva Ybera do catálogo).
- PONTAS / RESSECAMENTO → âncora NUTRIÇÃO/SELAGEM "Óleo de Mirra Reparador 60ml" + "Kit Cuidados Profundos".
Coloque o nome dele em "produto_ancora" e o incômodo nº1 em "incomodo_principal".

═══ PASSO 3 — COURO define lavagem (NÃO invente) ═══
Classifique o couro (foto + quiz) em "couro": oleoso | normal | seco. Isso define "lavagens_semana":
- oleoso → 4 (lava quase todo dia).  • normal → 3.  • seco → 2 (lava menos vezes; TODA lavagem tem shampoo).
Só fale de caspa/oleosidade/limpeza profunda se ESTIVER no quiz ou VISÍVEL na foto.

═══ PASSO 4 — CRONOGRAMA (12 CÓDIGOS) ═══
Devolva "cronograma" = array de 12 letras (uma por semana), H=Hidratação, N=Nutrição, R=Reconstrução:
- pontas/ressecamento/porosidade alta → foco H+N, pouca R. Ex.: ["H","N","H","N","H","R","H","N","H","N","H","R"]
- quebra/química/dano (loiro, progressiva) → foco R. Ex.: ["R","H","N","R","H","N","R","H","N","R","H","R"]
- frizz/volume → equilíbrio. Ex.: ["H","N","R","H","N","R","H","N","R","H","N","R"]
- saudável/manutenção → ["H","N","H","R","H","N","H","R","H","N","H","R"]
Regra: reconstrução (R) NUNCA em excesso (proteína demais endurece); a semana 12 SEMPRE termina em "R" (reconstrução final + selagem).

═══ REGRAS DE PRODUTO (produtos_indicados = a LISTA DE COMPRA) ═══
- Use SOMENTE produtos do "CATÁLOGO DISPONÍVEL". Nome/ID EXATOS. Prefira os ⭐ (mais vendidos).
- QUANTIDADE: de 5 a 6 produtos no TOTAL (nunca menos que 5, nunca mais que 6). O 1º é o ÂNCORA (Ybera, do incômodo principal).
- NÚCLEO OBRIGATÓRIO (sempre inclua, além do âncora): (a) o KIT do cronograma / máscara de tratamento; (b) um SHAMPOO de limpeza; (c) o ÓLEO de finalização (Óleo de Mirra); (d) um LEAVE-IN de finalização — "Leave-in Universal" no geral, "Leave-In Loiro Perfeito" se a cor for loira, "Leave-in Cacho Perfeito" se cacheada/crespa; (e) o TÔNICO VELLO ("Soro Vello Alfa-Lactobaby") pro couro cabeludo e fortalecimento da raiz — vale pra todas, e é essencial quando o incômodo é queda/crescimento.
- REGRA DA MARCA: todo "produto_id" (principal) é OBRIGATORIAMENTE Ybera (is_ybera=true). Marca de fora só em "alternativa_id" (2ª opção mais barata), ou null.
- SHAMPOO: no máximo 1 na lista; nunca é o âncora.
- RELEVÂNCIA POR COR: produto de loiro/matizador só pra loira/descolorida (veja "cor"). Crespo/cacheado → "Cacho Perfeito"; liso → "Liso Perfeito".
- "motivo": 1 frase em 2ª pessoa ligando ao caso dela.

═══ ITENS DE TODO DIA ═══
"diarios" = lista curta dos rituais diários. Sempre inclua: Óleo de Mirra (2–3 gotas nas pontas úmidas) e o Tônico Vello (Soro Vello no couro, massageando, sem enxaguar — estimula a raiz). Se o incômodo tem queda/crescimento, inclua também o 100Tímetros (1 cápsula/dia). Não repita nas semanas — o sistema já espalha.

═══ "carta_ju" — MENSAGEM DA JU (a copy mais importante, vai no topo) ═══
Carta pessoal, calorosa, 1ª pessoa (a Juliane falando com a cliente pelo primeiro nome). NUNCA diga que é IA — é a Juliane. Estrutura:
1) "Oi {primeiro nome}, tudo bem?"
2) "Analisei bem o seu caso, vi suas fotos e li suas respostas."
3) O PORQUÊ (personalizado, sem culpar) — causa real ligada ao que ela marcou/mostrou.
4) TIRA A CULPA + ESPERANÇA (o problema não é ela; faltava o método certo). 1 frase de identificação (a Ju também passou por isso).
5) URGÊNCIA GENTIL (quanto antes começar, mais rápido recupera; sem gastar rios em salão).
6) Fecho convidando a ver os produtos. Termine com "Beijos da Ju 💛".
5–8 frases, parágrafos curtos separados por \\n\\n.

FORMATO DA RESPOSTA — SOMENTE JSON válido, sem markdown, SEM o campo "semanas":
{
  "tipo_cabelo": "Liso|Ondulado|Cacheado|Crespo",
  "couro": "seco|normal|oleoso",
  "lavagens_semana": 2,
  "incomodo_principal": "queda|crescimento|frizz|quebra|pontas|volume|ressecamento",
  "produto_ancora": "Nome exato do produto-âncora Ybera",
  "cronograma": ["H","N","H","R","H","N","H","R","N","H","N","R"],
  "diagnostico": "2–3 frases ligando o que VÊ na foto ao que ela marcou, e qual é o foco nº1",
  "analise_foto": { "frizz_score": 1-5, "brilho_score": 1-5, "hidratacao_score": 1-5, "pontas_score": 1-5, "porosidade_aparente": "baixa|média|alta", "observacoes": "o que dá pra ver na foto (2–4 frases, tom da Ju falando com a cliente)" },
  "diarios": ["Óleo de Mirra: 2–3 gotas nas pontas com o cabelo úmido"],
  "produtos_indicados": [ { "produto_id": "<uuid Ybera ÂNCORA>", "motivo": "Por que serve pro caso dela", "alternativa_id": "<uuid outra marca, ou null>" } ],
  "mensagem_juliane": "Mensagem pessoal citando algo da foto/quiz + a observação fixa no fim"
}`;

// mensagem_juliane SEMPRE termina com esta observação fixa (garantido em código):
const NOTA_FIXA = 'Os produtos indicados são os que eu uso e confio nos resultados. Mas podem ser substituídos por produtos de outras marcas, desde que cumpram a mesma função.';

// ── TEMPLATE: monta as 12 semanas a partir dos códigos da IA ─────────────────
const MASKNAME: Record<string, string> = { H: 'Máscara de Hidratação', N: 'Máscara de Nutrição', R: 'Máscara de Reconstrução' };
const FOCO_BASE: Record<string, string> = {
  H: 'HIDRATAÇÃO — repor água, maciez e brilho nos comprimentos e pontas.',
  N: 'NUTRIÇÃO — repor os lipídios (óleos naturais) que a química e o calor tiraram, controlando o frizz.',
  R: 'RECONSTRUÇÃO — repor proteína e devolver força ao fio (combate a quebra). Só 1x no bloco.',
};

function washDaysFor(couro: string, lavagens?: number): number[] {
  if (couro === 'oleoso') {
    const n = Math.max(3, Math.min(4, lavagens || 4));
    return [1, 3, 5, 7].slice(0, n);
  }
  if (couro === 'seco') return [1, 5];
  return [1, 3, 5];
}

// Descobre nome de shampoo e de finalizador/óleo entre os produtos escolhidos,
// pra listar produtos coerentes em cada semana. Fallback pra rótulos genéricos.
function resolveNames(
  catalog: CatalogProduct[],
  indicados: NonNullable<GeneratedPlan['produtos_indicados']>,
): { shampoo: string; oleo: string } {
  const byId = new Map(catalog.map(p => [p.id, p]));
  const SHAMPOO_CATS = new Set(['limpeza', 'pre_shampoo']);
  let shampoo = '';
  let oleo = '';
  for (const item of indicados) {
    const p = byId.get(item.produto_id);
    if (!p) continue;
    if (!shampoo && SHAMPOO_CATS.has(p.category ?? '')) shampoo = p.name;
    if (!oleo && /óleo|oleo|leave|s[ée]rum|finaliz|mirra/i.test(p.name)) oleo = p.name;
  }
  return { shampoo: shampoo || 'Shampoo de limpeza', oleo: oleo || 'Óleo de Mirra nas pontas' };
}

function assembleSemanas(
  couro: string,
  lavagens: number | undefined,
  cronograma: string[],
  names: { shampoo: string; oleo: string },
  temQueda: boolean = false,
): GeneratedPlan['semanas'] {
  const codes = (Array.isArray(cronograma) && cronograma.length === 12)
    ? cronograma.map(c => (['H', 'N', 'R'].includes(c) ? c : 'H'))
    : ['H', 'N', 'H', 'R', 'H', 'N', 'H', 'R', 'N', 'H', 'N', 'R'];
  const washDays = washDaysFor(couro, lavagens);
  return codes.map((code, i) => {
    const w = i + 1;
    const mask = MASKNAME[code] || MASKNAME.H;
    let foco = FOCO_BASE[code] || FOCO_BASE.H;
    if (w === 1) foco = 'Diagnóstico + ' + foco;
    if (w === 12) foco += ' Resultado consolidado — compare com o dia 1!';
    const tarefas: Array<{ dia: number; titulo: string; descricao?: string }> = [];
    washDays.forEach((dia, idx) => {
      const trata = idx % 2 === 0;                       // dia de máscara alternado
      // TODA lavagem leva SHAMPOO (regra da Juliane: "lavagem precisa ter shampoo
      // sempre"). Couro seco ganha instrução mais suave, mas nunca co-wash sem shampoo.
      tarefas.push({ dia, titulo: 'Shampoo de limpeza', descricao:
        couro === 'oleoso' ? 'Aplique na raiz, massageie 1–2 min com a polpa dos dedos e enxágue. Pode repetir se o couro estiver muito oleoso.'
        : couro === 'seco' ? 'Aplique só na raiz e massageie de leve, sem esfregar os comprimentos, e enxágue bem. Toda lavagem leva shampoo — ele limpa o couro; a maciez volta com a máscara logo em seguida.'
        : 'Aplique na raiz, massageie 1 min e enxágue bem. Não esfregue os comprimentos.' });
      // Kit antiqueda 1x na semana — só pra quem queixa queda/crescimento (sugestão da Juliane).
      if (temQueda && idx === 0) tarefas.push({ dia, titulo: 'Kit antiqueda (1x na semana)', descricao: 'No dia da lavagem, use o kit antiqueda no couro cabeludo massageando bem por 1–2 min. Pelo menos 1x na semana pra estimular a raiz e reduzir a queda.' });
      if (trata) tarefas.push({ dia, titulo: mask, descricao: `Aplique do comprimento médio até as pontas, longe da raiz. Deixe agir 15 min com touca. Enxágue com água fria pra selar a cutícula.${code === 'R' ? ' Use no máximo 1x na semana pra não endurecer o fio.' : ''}` });
      // Leave-in + Óleo de finalização + Tônico Vello — em TODA lavagem, em todos os
      // planos (regra da Juliane: "ta faltando indicar o leavin e o tônico").
      tarefas.push({ dia, titulo: 'Leave-in de finalização', descricao: 'Nos comprimentos e pontas ainda úmidos, antes de finalizar. Não enxágue — dá deslize, controla o frizz e protege o fio ao longo do dia.' });
      tarefas.push({ dia, titulo: 'Óleo de Mirra nas pontas', descricao: '2–3 gotas nas pontas úmidas, depois do leave-in. Não enxágue — sela a umidade e dá brilho.' });
      tarefas.push({ dia, titulo: 'Tônico Vello no couro', descricao: 'Aplique o Soro Vello direto no couro limpo e massageie 1 min com a polpa dos dedos. Não enxágue — fortalece a raiz e estimula o crescimento.' });
    });
    const dica = code === 'R' ? 'A reconstrução repõe proteína, mas em excesso endurece — por isso entra 1x a cada bloco, nunca toda semana.'
      : code === 'N' ? 'A nutrição repõe os óleos naturais do fio — combina bem com a toalha quente sobre a touca pra penetrar mais fundo.'
      : 'Água fria no fim do enxágue fecha a cutícula e deixa o brilho maior. Vale o esforço!';
    return {
      semana: w, foco,
      tarefas: tarefas.sort((a, b) => a.dia - b.dia),
      produtos: [names.shampoo, mask, names.oleo],
      dica,
    };
  });
}

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
  return `\n\nCATÁLOGO DISPONÍVEL (use SOMENTE estes produtos). Os marcados com ⭐ são os MAIS VENDIDOS / de MAIOR impacto — prefira-os como âncora e complementos:\n${lines}`;
}

function buildQuizBlock(quizAnswers: Record<string, unknown> | null): string {
  if (!quizAnswers) return '';
  const inc = quizAnswers['incomoda'];
  const incList = Array.isArray(inc) ? inc.map(String) : (inc ? [String(inc)] : []);
  const destaque = incList.length
    ? `\n\n⚠️ O QUE MAIS INCOMODA ELA (EIXO DO PLANO — em ordem de prioridade): ${incList.join(', ')}\nO primeiro item (${incList[0]}) é o foco nº1 e define o produto-âncora e o cronograma.`
    : '';
  return `${destaque}\n\nRESPOSTAS DO QUIZ (completo):\n${JSON.stringify(quizAnswers, null, 2)}`;
}

/**
 * Busca os produtos ativos do catálogo, priorizando os que casam com o tipo de cabelo.
 */
async function loadCatalog(sb: SupabaseClient, hairType: string | null): Promise<CatalogProduct[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb.from('products') as any)
    .select('id,name,brand,category,hair_types,is_priority,is_ybera')
    .eq('active', true)
    .is('parent_product_id', null)
    .order('is_priority', { ascending: false })
    .limit(50);
  const all: CatalogProduct[] = (data ?? []) as CatalogProduct[];
  if (!hairType || all.length === 0) return all;

  const h = hairType.toLowerCase();
  const matching = all.filter(p => (p.hair_types ?? []).some(t => t.toLowerCase() === h));
  const others = all.filter(p => !matching.includes(p));
  return [...matching, ...others].slice(0, 30);
}

interface GenerateOptions {
  photoBase64?: string;
  photoMimeType?: string;
  photoUrl?: string;
  extraPhotoUrls?: string[];
}

// Trava (não confia só no prompt) as regras de indicação de produto.
function enforceProductRules(plan: GeneratedPlan, catalog: CatalogProduct[]): void {
  const list = Array.isArray(plan.produtos_indicados) ? plan.produtos_indicados : [];
  if (!list.length) return;
  const byId = new Map(catalog.map(p => [p.id, p]));
  const isYbera = (id?: string | null) => {
    if (!id) return false;
    const p = byId.get(id);
    return p ? (p.is_ybera === true || /ybera|fashion\s*gold/i.test(p.brand ?? '')) : false;
  };
  const SHAMPOO_CATS = new Set(['limpeza', 'pre_shampoo']);
  const isShampoo = (id?: string | null) => (id ? SHAMPOO_CATS.has(byId.get(id)?.category ?? '') : false);

  let shampooSeen = false;
  const out: NonNullable<GeneratedPlan['produtos_indicados']> = [];
  for (const item of list) {
    let principal = item?.produto_id;
    let alt: string | null | undefined = item?.alternativa_id ?? null;
    if (!principal) continue;
    if (!isYbera(principal) && isYbera(alt)) { const t = principal; principal = alt as string; alt = t; }
    if (isYbera(alt)) alt = null;
    if (isShampoo(principal)) {
      if (shampooSeen) continue;
      shampooSeen = true;
      if (isShampoo(alt)) alt = null;
    }
    out.push({ produto_id: principal, motivo: item?.motivo ?? '', alternativa_id: alt ?? null });
  }
  plan.produtos_indicados = out;
}

/**
 * Chama a IA (constrained) com a foto + quiz + catálogo real e retorna o plano
 * estruturado — a IA decide os códigos e escreve os textos únicos; as 12 semanas
 * são montadas por template aqui. Não persiste nada.
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

  const fullPrompt = CONSTRAINED_PROMPT + buildCatalogBlock(catalog) + buildQuizBlock(args.quizAnswers);

  const hadPhoto = !!(args.photo.photoBase64 || args.photo.photoUrl || (args.photo.extraPhotoUrls?.some(Boolean)));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function buildContent(dropPhoto: boolean): any[] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any[] = [];
    if (!dropPhoto) {
      if (args.photo.photoBase64) {
        content.push({ type: 'image_url', image_url: { url: `data:${args.photo.photoMimeType || 'image/jpeg'};base64,${args.photo.photoBase64}` } });
      } else if (args.photo.photoUrl) {
        content.push({ type: 'image_url', image_url: { url: args.photo.photoUrl } });
      }
      for (const url of (args.photo.extraPhotoUrls ?? [])) {
        if (url) content.push({ type: 'image_url', image_url: { url } });
      }
    }
    const nFotos = content.filter(c => c.type === 'image_url').length;
    if (nFotos > 1) {
      content.push({ type: 'text', text: `Você recebeu ${nFotos} fotos do MESMO cabelo (geralmente: frente, costas e raiz/couro cabeludo). Analise TODAS juntas — a de costas mostra comprimento e pontas; a da raiz mostra oleosidade e couro cabeludo.` });
    }
    if (nFotos === 0) {
      content.push({ type: 'text', text: 'SEM FOTO: a cliente NÃO enviou foto. Baseie TODO o plano no questionário. Em "analise_foto" preencha os scores com uma estimativa conservadora a partir das respostas e coloque em "observacoes": "Plano montado com base no seu questionário — a foto não foi enviada." A "mensagem_juliane" deve COMEÇAR dizendo com carinho que, como a foto não chegou, a Ju montou o plano pelas respostas, e convidar a enviar a foto depois pra ela ajustar.' });
    }
    content.push({ type: 'text', text: fullPrompt });
    return content;
  }

  const apiKey = process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY não configurado');

  // Saída agora é PEQUENA (só decisões + carta): ~600–1000 tokens. Folga de 4000
  // cobre até cartas longas com sobra e nunca trunca (as 12 semanas não saem daqui).
  const MAX_TOKENS = 4000;

  async function requestPlan(dropPhoto: boolean): Promise<GeneratedPlan> {
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
          messages: [{ role: 'user', content: buildContent(dropPhoto) }],
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errBody = await response.text();
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
    if (finishReason === 'length') throw new Error('Resposta da IA truncada (finish_reason=length)');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON do plano não encontrado na resposta da IA');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = JSON.parse(jsonMatch[0]) as any;

    // Normaliza produtos_indicados e aplica as travas de marca/shampoo ANTES de
    // montar as semanas (os nomes das semanas saem daqui).
    const planShell: GeneratedPlan = {
      diagnostico: String(raw.diagnostico ?? ''),
      tipo_cabelo: String(raw.tipo_cabelo ?? args.hairType ?? 'Liso'),
      analise_foto: raw.analise_foto ?? undefined,
      incomodo_principal: raw.incomodo_principal ?? undefined,
      produto_ancora: raw.produto_ancora ?? undefined,
      semanas: [],
      produtos_essenciais: [],
      diarios: Array.isArray(raw.diarios) ? raw.diarios.filter(Boolean) : [],
      produtos_indicados: Array.isArray(raw.produtos_indicados) ? raw.produtos_indicados : [],
      carta_ju: typeof raw.carta_ju === 'string' ? raw.carta_ju : undefined,
      mensagem_juliane: String(raw.mensagem_juliane ?? ''),
    };
    enforceProductRules(planShell, catalog);

    // Monta as 12 semanas por TEMPLATE a partir dos códigos da IA.
    const couro = ['seco', 'normal', 'oleoso'].includes(raw.couro)
      ? raw.couro
      : (args.quizAnswers?.['oleosidade'] === 'oleoso' ? 'oleoso' : args.quizAnswers?.['oleosidade'] === 'seco' ? 'seco' : 'normal');
    const names = resolveNames(catalog, planShell.produtos_indicados ?? []);
    // Queixa de queda/crescimento? (incômodo principal OU marcado no quiz) → ativa o
    // kit antiqueda 1x/semana no cronograma (sugestão da Juliane).
    const incomodaArr = Array.isArray(args.quizAnswers?.['incomoda'])
      ? (args.quizAnswers!['incomoda'] as unknown[]).map(String) : [];
    const temQueda = /queda|cresc/i.test(String(planShell.incomodo_principal ?? ''))
      || incomodaArr.some(x => /queda|cresc/i.test(x));
    planShell.semanas = assembleSemanas(couro, Number(raw.lavagens_semana) || undefined, raw.cronograma, names, temQueda);
    planShell.produtos_essenciais = (planShell.produtos_indicados ?? [])
      .map(pi => catalog.find(c => c.id === pi.produto_id)?.name)
      .filter((n): n is string => !!n);

    // Garante a observação fixa no fim da mensagem_juliane.
    if (!planShell.mensagem_juliane.includes('podem ser substituídos')) {
      planShell.mensagem_juliane = (planShell.mensagem_juliane ? planShell.mensagem_juliane + '\n\n' : '') + NOTA_FIXA;
    }

    if (!Array.isArray(planShell.semanas) || planShell.semanas.length !== 12) {
      throw new Error('Falha ao montar as 12 semanas do cronograma');
    }
    return planShell;
  }

  let lastErr: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const dropPhoto = attempt === 2 && hadPhoto;
    try {
      return await requestPlan(dropPhoto);
    } catch (e) {
      lastErr = e;
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
  opts?: { extraNote?: string },
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb.from('hair_plans') as any).delete().eq('user_id', userId);

  const NOTA_PADRAO = 'Os produtos indicados são os que eu uso e confio nos resultados. Mas podem ser substituídos por produtos de outras marcas, desde que cumpram a mesma função.';
  const NOTA_SEMANA1 = opts?.extraNote ? `${opts.extraNote}\n\n${NOTA_PADRAO}` : NOTA_PADRAO;
  const rows = plan.semanas.map(s => ({
    user_id: userId,
    week_number: s.semana,
    focus: s.foco,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tasks: (Array.isArray(s.tarefas) ? s.tarefas : []).map((t: any, i: number) =>
      typeof t === 'string'
        ? { day: i + 1, title: t, description: '' }
        : { day: Number(t?.dia) || (i + 1), title: String(t?.titulo ?? ''), description: String(t?.descricao ?? '') },
    ).sort((a, b) => a.day - b.day),
    products: s.produtos ?? [],
    tips: s.dica ? [s.dica] : [],
    juliane_notes: s.semana === 1 ? NOTA_SEMANA1 : null,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb.from('hair_plans') as any).insert(rows);

  const diarios = Array.isArray(plan.diarios) ? plan.diarios.filter(Boolean) : [];
  const cartaJu = typeof plan.carta_ju === 'string' && plan.carta_ju.trim() ? plan.carta_ju.trim() : null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb.from('profiles') as any).update({ daily_rituals: diarios.length ? diarios : null, carta_ju: cartaJu }).eq('id', userId);
}
