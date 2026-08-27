import type { MetadataRoute } from 'next';
import { tudoParaSitemap, contar, dataDeAtualizacao } from '@/lib/conteudo';
import { POR_PAGINA, caminhoDaPagina } from './blog/ListaBlog';
import { SITE } from '@/lib/seo';

// Gerado do banco a cada hora. O sitemap do WordPress tinha lastmod congelado
// em março, o que diz ao Google "aqui não muda nada" — este acompanha a
// publicação sozinho.
export const revalidate = 3600;

const PESO: Record<string, number> = { post: 0.8, product: 0.6, page: 0.5, category: 0.4, product_cat: 0.4 };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [itens, totalPosts] = await Promise.all([tudoParaSitemap(), contar('post')]);

  const fixas: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE}/blog/`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE}/loja/`, changeFrequency: 'weekly', priority: 0.7 },
  ];

  // As páginas 2..N do blog. Sem elas o rastreador só encontraria a lista
  // seguindo link de página em página; no sitemap ele chega direto em cada uma.
  const ultima = Math.max(1, Math.ceil(totalPosts / POR_PAGINA));
  for (let n = 2; n <= ultima; n++) {
    fixas.push({ url: `${SITE}${caminhoDaPagina(n)}`, changeFrequency: 'weekly', priority: 0.5 });
  }

  const doBanco: MetadataRoute.Sitemap = itens
    // as fixas acima já entraram; /carrinho/ e afins são noindex e nem vêm
    .filter((i) => !['/', '/blog/', '/loja/'].includes(i.path))
    .map((i) => ({
      url: `${SITE}${i.path}`,
      // A revisão manual manda no lastmod: é o sinal que diz ao Google que
      // vale a pena reler a página.
      lastModified: (() => { const d = dataDeAtualizacao(i); return d ? new Date(d) : undefined; })(),
      changeFrequency: i.kind === 'post' ? ('weekly' as const) : ('monthly' as const),
      priority: PESO[i.kind] ?? 0.5,
    }));

  return [...fixas, ...doBanco];
}
