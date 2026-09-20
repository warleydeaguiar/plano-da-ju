import type { NextConfig } from 'next';

/**
 * Redirects lidos do banco no momento do build.
 *
 * Ficam no next.config em vez de num middleware de propósito: assim são
 * resolvidos na borda, sem consultar o banco a cada visita. São poucas dezenas
 * de regras e mudam raramente — quando mudarem, um novo deploy publica.
 *
 * Origens: as 9 regras que existiam no plugin Redirection, os slugs antigos que
 * ainda recebem impressão no Google e as URLs malformadas que o Google achou
 * (terminadas em `)` ou `"`, de links com typo dentro do conteúdo).
 */
async function redirectsDoBanco() {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!base || !chave) {
    console.warn('[next.config] sem credenciais do Supabase — build sem redirects');
    return [];
  }
  try {
    const r = await fetch(
      `${base}/rest/v1/site_redirects?enabled=is.true&status_code=neq.410&select=from_path,to_url,status_code&limit=2000`,
      { headers: { apikey: chave, Authorization: `Bearer ${chave}` } },
    );
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const linhas: { from_path: string; to_url: string | null; status_code: number }[] = await r.json();

    const vistos = new Set<string>();
    const regras = [];
    for (const l of linhas) {
      if (!l.to_url || !l.from_path) continue;
      // `source` não aceita caractere de padrão solto: URL malformada
      // (com `)`, `"`, `%22`) quebraria o build inteiro se passasse crua.
      if (/[(){}[\]:*+?\\]/.test(l.from_path)) continue;
      if (vistos.has(l.from_path)) continue;
      vistos.add(l.from_path);
      regras.push({
        source: l.from_path.replace(/\/$/, ''),
        destination: l.to_url,
        permanent: l.status_code === 301 || l.status_code === 308,
      });
    }
    console.log(`[next.config] ${regras.length} redirects carregados do banco`);
    return regras;
  } catch (e) {
    // Build sem redirect é ruim, mas build que não acontece é pior.
    console.warn('[next.config] falha ao carregar redirects:', (e as Error).message);
    return [];
  }
}

const nextConfig: NextConfig = {
  // O WordPress serve tudo com barra final e essas URLs estão indexadas há
  // anos. Sem isto o Next redirecionaria /post/ para /post, trocando 283 URLs
  // conhecidas do Google por 283 redirects — exatamente o que a migração
  // existe para evitar.
  trailingSlash: true,
  poweredByHeader: false,
  images: { formats: ['image/avif', 'image/webp'] },
  async redirects() {
    return [
      // Subdomínio de um funil antigo. O DNS ainda aponta pra Vercel e o
      // Google continua rastreando — sem dono, dava erro de conexão. Vai pro
      // artigo do Fashion Gold, que é o assunto que o nome promete e a página
      // de maior tráfego do site.
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'progressivafashiongold.julianecost.com' }],
        destination: 'https://julianecost.com/progressiva-fashion-gold-e-boa-atualizado/',
        permanent: true,
      },
      // ── Lixo de URL herdado do WordPress ──────────────────────────────
      // O Google ainda rastreia esses padrões e desde 26/08 eles viraram uma
      // enxurrada de 404 (45 páginas no Search Console, ~30 por dia). Todos
      // têm destino óbvio; 301 devolve a força do link para a página certa.
      //
      // Paginação de comentários: /artigo/2/ → /artigo/
      { source: '/:slug/:pagina(\\d{1,3})', destination: '/:slug/', permanent: true },
      // Feed RSS de post e de produto: /artigo/feed/ → /artigo/
      { source: '/:slug/feed', destination: '/:slug/', permanent: true },
      { source: '/produto/:slug/feed', destination: '/produto/:slug/', permanent: true },
      { source: '/feed', destination: '/blog/', permanent: true },
      { source: '/comments/feed', destination: '/blog/', permanent: true },
      // Paginação da home do WordPress: /page/2/ → /blog/pagina/2/
      { source: '/page/1', destination: '/blog/', permanent: true },
      { source: '/page/:pagina(\\d{1,3})', destination: '/blog/pagina/:pagina/', permanent: true },
      // Paginação da loja antiga: /?product-page=3 → /loja/
      {
        source: '/',
        has: [{ type: 'query', key: 'product-page' }],
        destination: '/loja/',
        permanent: true,
      },

      ...(await redirectsDoBanco()),
    ];
  },
};

export default nextConfig;
