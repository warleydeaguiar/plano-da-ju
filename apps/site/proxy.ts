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

const ARMAZENAMENTO =
  'https://db.planodaju.julianecost.com/storage/v1/object/public/site-conteudo';

/**
 * Repõe as imagens antigas do WordPress no lugar novo.
 *
 * O Google Imagens é a MAIOR fonte de visita do site: 720 mil impressões e
 * 1.390 cliques em 90 dias, contra 773 cliques da busca web. Todas essas
 * imagens estão indexadas em `/wp-content/uploads/...`, endereço que deixou de
 * existir no cutover — sem isto, cada recrawl derruba mais um pedaço da
 * principal fonte de tráfego.
 *
 * O caminho novo é derivado da URL antiga, não consultado numa tabela: a
 * migração nomeou cada arquivo com `sha1(url original).slice(0, 10)` mais o
 * nome normalizado. Reproduzir a mesma conta aqui evita carregar um mapa de
 * 1.415 linhas no middleware (conferido: as 1.415 batem).
 *
 * Vai para WebP e não para AVIF de propósito — o Google Imagens indexa WebP e
 * não indexa AVIF, e a migração subiu os dois formatos.
 */
const UPLOADS = '/wp-content/uploads/';
const ORIGINAIS_MANTIDOS = new Set(['svg', 'gif']); // vetor e animação não foram convertidos

async function destinoDaImagem(pathname: string): Promise<string | null> {
  const nomeCompleto = decodeURIComponent(pathname.split('/').pop() || '');
  if (!nomeCompleto.includes('.')) return null;

  const ext = nomeCompleto.split('.').pop()!.toLowerCase();
  const base =
    nomeCompleto
      .replace(/\.[^.]+$/, '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'imagem';

  // O hash é da URL absoluta exatamente como estava no HTML do WordPress.
  const original = `https://julianecost.com${pathname}`;
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(original));
  const hash = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 10);

  const extFinal = ORIGINAIS_MANTIDOS.has(ext) ? ext : 'webp';
  return `${ARMAZENAMENTO}/${hash}/${base}.${extFinal}`;
}

export default async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (pathname.startsWith(UPLOADS)) {
    const destino = await destinoDaImagem(pathname);
    if (destino) return NextResponse.redirect(destino, 301);
  }

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
