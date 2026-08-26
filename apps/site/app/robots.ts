import type { MetadataRoute } from 'next';
import { SITE, BLOQUEAR_INDEXACAO } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  // Enquanto o WordPress é o site oficial, esta cópia fica fora do índice
  // inteira — duas versões do mesmo conteúdo competindo seria pior do que a
  // situação atual. Liberar só no cutover (SITE_PERMITIR_INDEXACAO=sim).
  if (BLOQUEAR_INDEXACAO) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/carrinho/', '/finalizar-compra/', '/minha-conta/'] }],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
