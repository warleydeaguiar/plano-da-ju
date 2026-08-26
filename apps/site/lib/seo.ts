import type { Metadata } from 'next';
import type { Conteudo, Categoria } from './conteudo';

/**
 * Domínio canônico. Enquanto o site novo roda em novo.julianecost.com, o
 * canônico continua apontando para julianecost.com — o conteúdo é o mesmo e
 * duas cópias indexadas competiriam entre si.
 */
export const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://julianecost.com').replace(/\/$/, '');

/**
 * Enquanto o WordPress ainda é o site oficial, esta cópia precisa sair do
 * índice inteira. Desligar SÓ no cutover, junto com a virada de DNS.
 */
export const BLOQUEAR_INDEXACAO = process.env.SITE_PERMITIR_INDEXACAO !== 'sim';

export const NOME_SITE = 'Juliane Cost';

const abs = (path: string) => `${SITE}${path}`;

/** Metadata do Next a partir do que o Yoast já publicava, para paridade 1:1. */
export function metaDoConteudo(c: Conteudo): Metadata {
  const titulo = c.seo_title || c.title;
  const descricao = c.seo_description || undefined;
  const imagem = c.og_image || c.featured_image_url || undefined;

  return {
    title: titulo,
    description: descricao,
    alternates: { canonical: abs(c.path) },
    robots: BLOQUEAR_INDEXACAO || c.noindex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      title: titulo,
      description: descricao,
      url: abs(c.path),
      siteName: NOME_SITE,
      locale: 'pt_BR',
      type: c.kind === 'post' ? 'article' : 'website',
      images: imagem ? [imagem] : undefined,
      ...(c.kind === 'post' && c.published_at
        ? { publishedTime: c.published_at, modifiedTime: c.modified_at || c.published_at }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: titulo,
      description: descricao,
      images: imagem ? [imagem] : undefined,
    },
  };
}

export function metaDaCategoria(cat: Categoria): Metadata {
  const titulo = cat.seo_title || `${cat.name} — ${NOME_SITE}`;
  return {
    title: titulo,
    description: cat.seo_description || cat.description || undefined,
    alternates: { canonical: abs(cat.path) },
    robots: BLOQUEAR_INDEXACAO ? { index: false, follow: false } : { index: true, follow: true },
  };
}

// ------------------------------------------------------------------- JSON-LD

export const ID_AUTORA = `${SITE}/#juliane`;
export const ID_ORG = `${SITE}/#organizacao`;

/**
 * A autora como entidade única do site.
 *
 * Repetida por referência (@id) em todo post, ela diz ao Google que existe uma
 * pessoa real e identificável por trás de 185 artigos sobre química capilar —
 * que é o sinal de E-E-A-T que o site nunca teve.
 */
function autora() {
  return {
    '@type': 'Person',
    '@id': ID_AUTORA,
    name: 'Juliane Cost',
    url: `${SITE}/`,
    jobTitle: 'Tricologista',
    image: 'https://db.planodaju.julianecost.com/storage/v1/object/public/site-conteudo/autora/juliane-cost.webp',
    description:
      'Tricologista formada e especializada em tratamentos capilares. Testa os produtos ' +
      'antes de recomendar e atende mulheres diariamente montando plano capilar personalizado.',
    // sameAs liga a pessoa aos perfis verificáveis dela. É como o Google
    // confirma que a autora existe fora do site e não é um nome inventado.
    sameAs: [
      'https://www.instagram.com/julianecost',
      'https://www.tiktok.com/@julianecost',
      'https://www.youtube.com/@julianecost',
    ],
    knowsAbout: [
      'Cuidados capilares', 'Progressiva', 'Cronograma capilar',
      'Tratamento capilar', 'Coloração de cabelo',
    ],
  };
}

function organizacao() {
  return {
    '@type': 'Organization',
    '@id': ID_ORG,
    name: NOME_SITE,
    url: `${SITE}/`,
    founder: { '@id': ID_AUTORA },
  };
}

function trilha(itens: { nome: string; path: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: itens.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.nome,
      item: abs(it.path),
    })),
  };
}

/**
 * Schema do post. Os posts respondem por 95% do tráfego de busca do site, então
 * é aqui que o markup precisa estar correto — Article com autor, datas e
 * imagem, mais a trilha de navegação.
 */
export function schemaDoPost(c: Conteudo) {
  const imagem = c.og_image || c.featured_image_url;
  const idPagina = `${abs(c.path)}#webpage`;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${abs(c.path)}#article`,
        headline: (c.seo_title || c.title).slice(0, 110),
        description: c.seo_description || undefined,
        datePublished: c.published_at || undefined,
        dateModified: c.modified_at || c.published_at || undefined,
        // Referência por @id em vez de objeto repetido: o Google resolve o
        // grafo e assim autora e publicadora são a mesma entidade em todas as
        // páginas, o que é o ponto de um sinal de autoridade.
        author: { '@id': ID_AUTORA },
        publisher: { '@id': ID_ORG },
        isPartOf: { '@id': idPagina },
        mainEntityOfPage: { '@id': idPagina },
        image: imagem ? { '@id': `${abs(c.path)}#imagem` } : undefined,
        inLanguage: 'pt-BR',
        wordCount: c.word_count || undefined,
      },
      {
        '@type': 'WebPage',
        '@id': idPagina,
        url: abs(c.path),
        name: c.seo_title || c.title,
        description: c.seo_description || undefined,
        datePublished: c.published_at || undefined,
        dateModified: c.modified_at || c.published_at || undefined,
        isPartOf: { '@id': `${SITE}/#website` },
        inLanguage: 'pt-BR',
        breadcrumb: { '@id': `${abs(c.path)}#trilha` },
        ...(imagem ? { primaryImageOfPage: { '@id': `${abs(c.path)}#imagem` } } : {}),
      },
      ...(imagem
        ? [{ '@type': 'ImageObject', '@id': `${abs(c.path)}#imagem`, url: imagem, contentUrl: imagem }]
        : []),
      { ...trilha([{ nome: 'Início', path: '/' }, { nome: 'Blog', path: '/blog/' }, { nome: c.title, path: c.path }]),
        '@id': `${abs(c.path)}#trilha` },
      // autora() e organizacao() NÃO entram aqui: o layout já as emite em toda
      // página pelo schemaDoSite, e os @id acima apontam para elas. Repetir só
      // engordaria o HTML de 185 posts sem dizer nada novo ao Google.
    ],
  };
}

/**
 * Schema do produto.
 *
 * `offers` só entra quando a página realmente publica preço — o que acontece em
 * 7 dos 47 produtos. Nos outros quem cobra é o parceiro, atrás do link de
 * afiliado, e declarar preço que não existe é motivo de penalidade de rich
 * result. Mesma regra para `aggregateRating`: sem avaliação real, sem estrela.
 */
export function schemaDoProduto(c: Conteudo) {
  const imagem = c.og_image || c.featured_image_url;
  const temPreco = typeof c.price_cents === 'number' && c.price_cents > 0;
  const temNota = typeof c.rating_value === 'number' && (c.rating_count || 0) > 0;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        '@id': `${abs(c.path)}#product`,
        name: c.title,
        description: c.seo_description || undefined,
        image: imagem ? [imagem] : undefined,
        ...(c.brand ? { brand: { '@type': 'Brand', name: c.brand } } : {}),
        ...(temPreco
          ? {
              offers: {
                '@type': 'Offer',
                price: (c.price_cents! / 100).toFixed(2),
                priceCurrency: c.currency || 'BRL',
                availability: 'https://schema.org/InStock',
                url: c.affiliate_url || abs(c.path),
              },
            }
          : {}),
        ...(temNota
          ? {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: c.rating_value,
                reviewCount: c.rating_count,
              },
            }
          : {}),
      },
      trilha([
        { nome: 'Início', path: '/' },
        { nome: 'Loja', path: '/loja/' },
        { nome: c.title, path: c.path },
      ]),
    ],
  };
}

export function schemaDoSite() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE}/#website`,
        url: `${SITE}/`,
        name: NOME_SITE,
        inLanguage: 'pt-BR',
        publisher: { '@id': ID_ORG },
      },
      autora(),
      organizacao(),
    ],
  };
}
