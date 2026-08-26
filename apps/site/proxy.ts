import { NextResponse, type NextRequest } from 'next/server';

/**
 * Conserta URLs malformadas que o Google indexou.
 *
 * O Search Console mostra 18 URLs terminadas em `)`, `"` ou aspa simples —
 * vieram de links com typo dentro dos posts, onde a pontuação da frase grudou
 * no href. No WordPress elas funcionavam por acaso: o Custom 404 Pro mandava
 * qualquer coisa desconhecida para uma página de promoção.
 *
 * Isto resolve por REGRA e não por lista: qualquer pontuação colada no fim do
 * caminho é removida e a URL limpa recebe um 301. Cobre as 18 de hoje e as que
 * aparecerem depois. Elas não cabem no `redirects()` do next.config porque
 * esses caracteres são sintaxe de padrão de rota e quebrariam o build.
 */
const LIXO_NO_FIM = /(?:%22|%27|%29|["')\]]|%E2%80%9D)+\/?$/i;

export default function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const limpo = pathname.replace(LIXO_NO_FIM, '');
  if (limpo && limpo !== pathname) {
    const url = req.nextUrl.clone();
    url.pathname = limpo.endsWith('/') ? limpo : `${limpo}/`;
    url.search = search;
    return NextResponse.redirect(url, 301);
  }

  return NextResponse.next();
}

export const config = {
  // Fora arquivo estático e rota interna: o middleware só precisa ver navegação.
  matcher: ['/((?!_next/|favicon\\.ico|sitemap\\.xml|robots\\.txt).*)'],
};
