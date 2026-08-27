/**
 * Acesso ao conteúdo migrado do WordPress.
 *
 * Fala direto com o PostgREST usando a chave anônima: a RLS já limita a
 * leitura ao que está publicado, e `fetch` puro deixa o cache do Next fazer o
 * trabalho. As páginas são estáticas com revalidação — o Google recebe HTML
 * pronto, não uma consulta ao banco por visita.
 */

const BASE = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const CHAVE = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/** Quanto tempo o HTML gerado vale antes de ser refeito em segundo plano. */
export const REVALIDA = 3600;

export type Tipo = 'post' | 'page' | 'product';

/**
 * Data que o site publica como "atualizado em".
 *
 * A revisão manual vem primeiro: quando a Juliane relê um artigo e confirma
 * que continua valendo, isso é informação melhor do que o carimbo que o
 * WordPress deixou. `modified_at` fica de reserva, e `published_at` por
 * último — nunca devolve vazio numa página que existe.
 */
export function dataDeAtualizacao(c: {
  revisado_em?: string | null;
  modified_at?: string | null;
  published_at?: string | null;
}): string | null {
  return c.revisado_em || c.modified_at || c.published_at || null;
}

export interface Conteudo {
  id: number;
  kind: Tipo;
  slug: string;
  path: string;
  title: string;
  excerpt_html: string | null;
  content_clean: string | null;
  featured_image_url: string | null;
  published_at: string | null;
  modified_at: string | null;
  /** Revisão manual da Juliane. Tem precedência sobre `modified_at`. */
  revisado_em: string | null;
  author_name: string | null;
  word_count: number | null;
  seo_title: string | null;
  seo_description: string | null;
  canonical: string | null;
  og_image: string | null;
  noindex: boolean;
  affiliate_url: string | null;
  price_cents: number | null;
  price_original_cents: number | null;
  currency: string;
  rating_value: number | null;
  rating_count: number | null;
  brand: string | null;
}

export interface Categoria {
  id: number;
  kind: string;
  slug: string;
  path: string;
  name: string;
  description: string | null;
  seo_title: string | null;
  seo_description: string | null;
  post_count: number;
}

async function consulta<T>(caminho: string, revalidate = REVALIDA): Promise<T[]> {
  if (!BASE || !CHAVE) return [];
  const r = await fetch(`${BASE}/rest/v1/${caminho}`, {
    headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}` },
    next: { revalidate },
  });
  if (!r.ok) return [];
  return (await r.json()) as T[];
}

const CAMPOS =
  'id,kind,slug,path,title,excerpt_html,content_clean,featured_image_url,published_at,' +
  'modified_at,revisado_em,author_name,word_count,seo_title,seo_description,canonical,og_image,noindex,' +
  'affiliate_url,price_cents,price_original_cents,currency,rating_value,rating_count,brand';

const LISTA =
  'id,kind,slug,path,title,excerpt_html,featured_image_url,published_at,modified_at,revisado_em,' +
  'word_count,seo_description,og_image,price_cents,rating_value';

export async function porPath(path: string): Promise<Conteudo | null> {
  const [item] = await consulta<Conteudo>(
    `site_content?path=eq.${encodeURIComponent(path)}&select=${CAMPOS}&limit=1`,
  );
  return item ?? null;
}

/**
 * Lista conteúdo.
 *
 * `por: 'trafego'` ordena pelo que a leitora realmente procura, usando os
 * cliques de 16 meses do Search Console. É o padrão certo para vitrine de
 * produto: por data, a home destacava a geleia nutritiva (0 cliques) e
 * escondia o óleo de mirra (925). Para blog, `'data'` continua fazendo
 * sentido — ali a novidade é o valor.
 */
export async function listar(
  kind: Tipo,
  { limite = 24, offset = 0, por = 'data' }: { limite?: number; offset?: number; por?: 'data' | 'trafego' } = {},
): Promise<Conteudo[]> {
  const tabela = por === 'trafego' ? 'site_conteudo_trafego' : 'site_content';
  const ordem = por === 'trafego'
    ? 'gsc_clicks.desc,gsc_impressions.desc'
    : 'published_at.desc.nullslast';
  // Publicado e indexável, igual ao que `contar()` mede: se as duas consultas
  // divergirem, a última página do blog fica vazia ou some do fim da lista.
  // A view de tráfego também expõe `status` e `noindex`, então a regra é a
  // mesma nos dois caminhos.
  return consulta<Conteudo>(
    `${tabela}?kind=eq.${kind}&status=eq.publish&noindex=is.false` +
      `&select=${LISTA}&order=${ordem}&limit=${limite}&offset=${offset}`,
  );
}

export async function todosOsPaths(kind: Tipo): Promise<{ slug: string; path: string }[]> {
  return consulta<{ slug: string; path: string }>(
    `site_content?kind=eq.${kind}&select=slug,path&limit=2000`,
  );
}

export async function categoriaPorPath(path: string): Promise<Categoria | null> {
  const [c] = await consulta<Categoria>(
    `site_categories?path=eq.${encodeURIComponent(path)}&select=*&limit=1`,
  );
  return c ?? null;
}

export async function categorias(kind: string): Promise<Categoria[]> {
  return consulta<Categoria>(
    `site_categories?kind=eq.${kind}&select=*&order=post_count.desc&limit=200`,
  );
}

/** Posts de uma categoria, via tabela de ligação. */
export async function postsDaCategoria(categoriaId: number, limite = 50): Promise<Conteudo[]> {
  const vinculos = await consulta<{ content_id: number }>(
    `site_content_categories?category_id=eq.${categoriaId}&select=content_id&limit=${limite}`,
  );
  if (!vinculos.length) return [];
  const ids = vinculos.map((v) => v.content_id).join(',');
  return consulta<Conteudo>(
    `site_content?id=in.(${ids})&select=${LISTA}&order=published_at.desc.nullslast`,
  );
}

/** Sugestões no fim do post: mais lidos que não sejam o atual. */
/**
 * Palavras que aparecem em quase todo título do site e por isso não dizem nada
 * sobre o assunto: se "cabelo" pesasse, todo artigo seria parecido com todo
 * artigo. Ficam de fora do cálculo de afinidade.
 */
const VAZIAS = new Set([
  'a','o','as','os','de','da','do','das','dos','e','em','no','na','nos','nas','um','uma','uns','umas',
  'para','por','com','sem','que','qual','quais','como','onde','quando','se','ao','aos','à','às','ou',
  'top','melhores','melhor','guia','completo','veja','saiba','tudo','sobre','atualizado','vale','pena',
  'e-boa','boa','bom','dicas','passo','2024','2025','2026','cabelo','cabelos','fios',
]);

const palavrasDoTitulo = (titulo: string): string[] =>
  titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length > 2 && !VAZIAS.has(p));

/** Só os posts que podem receber visita do Google, com o título para comparar. */
async function postsParaRelacionar(): Promise<Conteudo[]> {
  return consulta<Conteudo>(
    `site_content?kind=eq.post&status=eq.publish&noindex=is.false&select=${LISTA}&limit=2000`,
  );
}

/**
 * Posts relacionados a este, por afinidade de assunto no título.
 *
 * A versão anterior ordenava por `word_count` sem nenhum filtro, então os 185
 * artigos exibiam exatamente os MESMOS 6 posts. Além de inútil para a leitora,
 * isso concentrava todo o link interno do site em 6 páginas — o Search Console
 * mostrava 71 páginas sem nenhum link interno vindo de outro conteúdo, e o
 * Google respondia com 364 URLs "rastreadas, mas não indexadas".
 *
 * O peso de cada palavra é inversamente proporcional a quantos títulos a usam
 * (ideia do IDF): "progressiva" aparece em dezenas de artigos e vale pouco;
 * "melasma" aparece em um punhado e vale muito. Assim o bloco puxa o vizinho
 * temático de verdade, e o link interno se espalha por todo o site.
 */
export async function relacionados(pathAtual: string, limite = 6): Promise<Conteudo[]> {
  const todos = await postsParaRelacionar();
  const atual = todos.find((i) => i.path === pathAtual);
  const candidatos = todos.filter((i) => i.path !== pathAtual);
  // Sem o post atual na lista (noindex, por exemplo) não há como comparar:
  // devolve os mais recentes em vez de devolver nada.
  if (!atual) return candidatos.slice(0, limite);

  const emQuantosTitulos = new Map<string, number>();
  for (const i of todos) {
    for (const p of new Set(palavrasDoTitulo(i.title))) {
      emQuantosTitulos.set(p, (emQuantosTitulos.get(p) ?? 0) + 1);
    }
  }
  const peso = (p: string) => Math.log(todos.length / (emQuantosTitulos.get(p) ?? 1));

  const minhas = new Set(palavrasDoTitulo(atual.title));
  const pontuado = candidatos.map((i) => {
    const dele = new Set(palavrasDoTitulo(i.title));
    let nota = 0;
    for (const p of dele) if (minhas.has(p)) nota += peso(p);
    return { item: i, nota };
  });

  pontuado.sort(
    (a, b) =>
      b.nota - a.nota ||
      // Empate resolvido pelo texto mais completo, e depois pelo caminho, para
      // que o resultado seja o mesmo em todo build (páginas estáticas).
      (b.item.word_count ?? 0) - (a.item.word_count ?? 0) ||
      a.item.path.localeCompare(b.item.path),
  );
  return pontuado.slice(0, limite).map((x) => x.item);
}

/** Quantos itens publicados e indexáveis existem deste tipo (para paginar). */
export async function contar(kind: Tipo): Promise<number> {
  if (!BASE || !CHAVE) return 0;
  const r = await fetch(
    `${BASE}/rest/v1/site_content?kind=eq.${kind}&status=eq.publish&noindex=is.false&select=id`,
    {
      headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, Prefer: 'count=exact', Range: '0-0' },
      next: { revalidate: REVALIDA },
    },
  );
  // O total vem no cabeçalho `content-range`, no formato "0-0/185".
  const total = Number(r.headers.get('content-range')?.split('/')[1]);
  return Number.isFinite(total) ? total : 0;
}

export async function tudoParaSitemap(): Promise<
  { path: string; modified_at: string | null; revisado_em: string | null; kind: string }[]
> {
  const [conteudo, cats] = await Promise.all([
    consulta<{ path: string; modified_at: string | null; revisado_em: string | null; kind: string }>(
      'site_content?noindex=is.false&select=path,modified_at,revisado_em,kind&limit=2000',
    ),
    consulta<{ path: string; kind: string }>('site_categories?select=path,kind&limit=200'),
  ]);
  return [...conteudo, ...cats.map((c) => ({ ...c, modified_at: null, revisado_em: null }))];
}

export interface Redirect {
  from_path: string;
  to_url: string | null;
  status_code: number;
}

export async function redirects(): Promise<Redirect[]> {
  return consulta<Redirect>(
    'site_redirects?enabled=is.true&select=from_path,to_url,status_code&limit=2000',
  );
}

export interface Pergunta {
  pergunta: string;
  resposta: string;
}

/**
 * FAQ do artigo. Só o que passou na revisão aparece, em qualquer ambiente.
 *
 * Isto já foi condicional ("staging mostra tudo") por um motivo que deixou de
 * valer: naquele momento nada tinha sido revisado ainda e a alternativa era
 * não mostrar nada. Depois da auditoria, 109 respostas estão marcadas como
 * reprovadas — a maioria por afirmar coisa que o artigo não sustenta — e a
 * regra antiga passaria justamente essas ao ar em staging.
 */
export async function faqDoPost(contentId: number): Promise<Pergunta[]> {
  return consulta<Pergunta>(
    `site_faq?content_id=eq.${contentId}&revisao_status=eq.aprovada` +
      '&select=pergunta,resposta&order=ordem',
  );
}

/**
 * Dimensão real de uma imagem já migrada.
 *
 * Usada onde a proporção varia de item para item (foto de produto, por
 * exemplo) e por isso não dá para fixar `aspect-ratio` no CSS sem distorcer.
 * Sem largura e altura o navegador não reserva espaço e a página pula quando a
 * imagem chega — que é o CLS medido pelo Google.
 */
export async function dimensaoDaImagem(
  publicUrl: string | null,
): Promise<{ width: number; height: number } | null> {
  if (!publicUrl) return null;
  const [m] = await consulta<{ width: number | null; height: number | null }>(
    `site_media?public_url=eq.${encodeURIComponent(publicUrl)}&select=width,height&limit=1`,
  );
  return m?.width && m?.height ? { width: m.width, height: m.height } : null;
}

export interface Avaliacao {
  id: number;
  autora: string;
  nota: number;
  texto: string;
  data: string;
}

export interface ResumoAvaliacoes {
  total: number;
  media: number;
}

/**
 * Avaliações do produto e o resumo delas.
 *
 * As duas coisas saem da MESMA fonte de propósito: o `aggregateRating` do
 * schema precisa corresponder exatamente ao que a visitante vê na tela. Nota
 * marcada sem avaliação visível é violação de política do Google e rende ação
 * manual — some com a estrela do site inteiro, não só da página.
 */
export async function avaliacoesDoProduto(
  contentId: number,
): Promise<{ itens: Avaliacao[]; resumo: ResumoAvaliacoes | null }> {
  const [itens, resumo] = await Promise.all([
    consulta<Avaliacao>(
      `site_avaliacoes?content_id=eq.${contentId}&publicada=is.true` +
        '&select=id,autora,nota,texto,data&order=data.desc&limit=50',
    ),
    consulta<{ total: number; media: number }>(
      `site_avaliacoes_resumo?content_id=eq.${contentId}&select=total,media&limit=1`,
    ),
  ]);
  return { itens, resumo: resumo[0] ?? null };
}
