import type { MetadataRoute } from 'next';
import { tudoParaSitemap } from '@/lib/conteudo';
import { SITE } from '@/lib/seo';

// Gerado do banco a cada hora. O sitemap do WordPress tinha lastmod congelado
// em março, o que diz ao Google "aqui não muda nada" — este acompanha a
// publicação sozinho.
export const revalidate = 3600;

const PESO: Record<string, number> = { post: 0.8, product: 0.6, page: 0.5, category: 0.4, product_cat: 0.4 };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const itens = await tudoParaSitemap();

  const fixas: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE}/blog/`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE}/loja/`, changeFrequency: 'weekly', priority: 0.7 },
  ];

  const doBanco: MetadataRoute.Sitemap = itens
    // as fixas acima já entraram; /carrinho/ e afins são noindex e nem vêm
    .filter((i) => !['/', '/blog/', '/loja/'].includes(i.path))
    .map((i) => ({
      url: `${SITE}${i.path}`,
      lastModified: i.modified_at ? new Date(i.modified_at) : undefined,
      changeFrequency: i.kind === 'post' ? ('weekly' as const) : ('monthly' as const),
      priority: PESO[i.kind] ?? 0.5,
    }));

  return [...fixas, ...doBanco];
}
