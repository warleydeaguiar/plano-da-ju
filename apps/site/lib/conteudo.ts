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
  'modified_at,author_name,word_count,seo_title,seo_description,canonical,og_image,noindex,' +
  'affiliate_url,price_cents,price_original_cents,currency,rating_value,rating_count,brand';

const LISTA =
  'id,kind,slug,path,title,excerpt_html,featured_image_url,published_at,modified_at,' +
  'word_count,seo_description,og_image,price_cents,rating_value';

export async function porPath(path: string): Promise<Conteudo | null> {
  const [item] = await consulta<Conteudo>(
    `site_content?path=eq.${encodeURIComponent(path)}&select=${CAMPOS}&limit=1`,
  );
  return item ?? null;
}

export async function listar(
  kind: Tipo,
  { limite = 24, offset = 0 }: { limite?: number; offset?: number } = {},
): Promise<Conteudo[]> {
  return consulta<Conteudo>(
    `site_content?kind=eq.${kind}&select=${LISTA}` +
      `&order=published_at.desc.nullslast&limit=${limite}&offset=${offset}`,
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
export async function relacionados(pathAtual: string, limite = 6): Promise<Conteudo[]> {
  const itens = await consulta<Conteudo>(
    `site_content?kind=eq.post&select=${LISTA}&order=word_count.desc&limit=${limite + 1}`,
  );
  return itens.filter((i) => i.path !== pathAtual).slice(0, limite);
}

export async function tudoParaSitemap(): Promise<
  { path: string; modified_at: string | null; kind: string }[]
> {
  const [conteudo, cats] = await Promise.all([
    consulta<{ path: string; modified_at: string | null; kind: string }>(
      'site_content?noindex=is.false&select=path,modified_at,kind&limit=2000',
    ),
    consulta<{ path: string; kind: string }>('site_categories?select=path,kind&limit=200'),
  ]);
  return [...conteudo, ...cats.map((c) => ({ ...c, modified_at: null }))];
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
 * FAQ do artigo.
 *
 * Enquanto o site está fora do índice (staging), mostra tudo — é o ambiente
 * onde a Juliane lê e aprova. Em produção, só o que ela já revisou vai ao ar:
 * a resposta é redigida a partir do próprio artigo, mas trata de química
 * capilar, e quem assina isso é a tricologista.
 */
export async function faqDoPost(contentId: number): Promise<Pergunta[]> {
  const exigeRevisao = process.env.SITE_PERMITIR_INDEXACAO === 'sim';
  const filtro = exigeRevisao ? '&revisado=is.true' : '';
  return consulta<Pergunta>(
    `site_faq?content_id=eq.${contentId}${filtro}&select=pergunta,resposta&order=ordem`,
  );
}
