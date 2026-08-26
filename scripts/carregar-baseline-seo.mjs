#!/usr/bin/env node
/**
 * Carrega o BASELINE de SEO: o retrato do site no WordPress antes de migrar,
 * cruzado com 16 meses de Search Console.
 *
 * É a régua do cutover. Nenhuma URL vira o DNS sem que title, description,
 * canonical e schema do site novo batam com o que já estava no ar — e as 50
 * páginas que concentram 90% dos cliques ficam marcadas para conferência manual.
 *
 * Também popula site_redirects a partir de três origens:
 *   1. as 9 regras do plugin Redirection do WordPress
 *   2. slugs antigos que ainda recebem impressão mas não existem mais
 *   3. URLs malformadas que o Google achou (terminadas em `)` ou `"`)
 *
 * Os dados de entrada ficam versionados em scripts/dados-migracao/. Para
 * atualizar o Search Console, baixe um export novo e rode antes:
 *   python3 scripts/dados-migracao/converter-gsc.py ~/Downloads/....xlsx
 *
 *   node scripts/carregar-baseline-seo.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DADOS = path.join(RAIZ, 'scripts/dados-migracao');
const WP = 'https://julianecost.com';

function carregarEnv() {
  for (const f of ['apps/web/.env.local', '.env.local']) {
    const p = path.join(RAIZ, f);
    if (!fs.existsSync(p)) continue;
    for (const linha of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}
carregarEnv();
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function supa(caminho, opcoes = {}) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${caminho}`, {
    ...opcoes,
    headers: {
      apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json', ...(opcoes.headers || {}),
    },
  });
  if (!r.ok) throw new Error(`Supabase ${caminho}: ${r.status} ${(await r.text()).slice(0, 300)}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

async function gravar(tabela, linhas, conflito) {
  const chaves = conflito.split(',');
  const unicas = [...new Map(linhas.map((l) => [chaves.map((k) => l[k]).join(' '), l])).values()];
  if (!unicas.length) return 0;
  const LOTE = 50;
  for (let i = 0; i < unicas.length; i += LOTE) {
    await supa(`${tabela}?on_conflict=${conflito}`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(unicas.slice(i, i + LOTE)),
    });
  }
  return unicas.length;
}

const paraPath = (u) => {
  try { const x = new URL(u); return x.pathname.endsWith('/') ? x.pathname : `${x.pathname}/`; }
  catch { return null; }
};

const ler = (arquivo) => JSON.parse(fs.readFileSync(path.join(DADOS, arquivo), 'utf8'));

(async () => {
  console.log('\nCarregando baseline de SEO\n');

  // 1) metadados raspados do WordPress antes de migrar
  const porPath = new Map();
  for (const m of ler('baseline-wp-seo.json')) {
    const p = paraPath(m.url);
    if (p) porPath.set(p, m);
  }
  console.log(`  metadados do WP: ${porPath.size} URLs`);

  // 2) Search Console (16 meses)
  const gsc = new Map();
  const bruto = ler('gsc-search-console.json');
  for (const linha of bruto.paginas) {
    const u = linha.chave;
    if (typeof u !== 'string' || !u.startsWith(WP)) continue;
    if (u.includes('#') || u.includes('?') || u.includes('/wp-content/')) continue;
    const p = paraPath(u);
    if (p) gsc.set(p, linha);
  }
  console.log(`  Search Console (${bruto.gerado_em}): ${gsc.size} páginas`);

  // top 50 por cliques = lista de proteção do cutover (concentra ~90%)
  const top50 = new Set(
    [...gsc.entries()].sort((a, b) => b[1].cliques - a[1].cliques).slice(0, 50).map(([p]) => p),
  );

  const linhas = [];
  for (const [p, m] of porPath) {
    const g = gsc.get(p);
    linhas.push({
      path: p, title: m.title || null, description: m.desc || null,
      canonical: m.canon || null, h1: m.h1 || null, og_image: m.ogimg || null,
      robots: m.robots || null, schema_types: m.schema || null, http_status: 200,
      gsc_clicks: g ? g.cliques : 0,
      gsc_impressions: g ? g.impressoes : 0,
      gsc_ctr: g ? g.ctr : null,
      gsc_position: g ? g.posicao : null,
      is_top50: top50.has(p),
    });
  }
  await gravar('site_seo_baseline', linhas, 'path');
  const protegidas = linhas.filter((l) => l.is_top50).length;
  const cliquesProtegidos = linhas.filter((l) => l.is_top50).reduce((a, l) => a + l.gsc_clicks, 0);
  const cliquesTotais = linhas.reduce((a, l) => a + l.gsc_clicks, 0);
  console.log(`  baseline: ${linhas.length} URLs | ${protegidas} marcadas top50 ` +
    `(${((cliquesProtegidos / cliquesTotais) * 100).toFixed(1)}% dos cliques)`);

  // 3) redirects — as 9 regras do plugin Redirection
  const reds = [];
  for (const r of ler('redirects-wp.json')) {
    const de = String(r.url || '');
    const ad = r.action_data;
    const para = typeof ad === 'string' ? ad : ad?.url;
    if (!de || !para) continue;
    reds.push({
      from_path: de.endsWith('/') ? de : `${de}/`,
      to_url: para, status_code: Number(r.action_code) || 301,
      origem: 'plugin_redirection', note: 'importado do WordPress',
    });
  }

  // 4) URLs que o Google conhece mas que não existem mais (slug antigo ou link
  //    com typo). Hoje elas caem no redirect genérico do Custom 404 Pro — que
  //    é justamente o que estamos desligando —, então cada uma precisa de
  //    destino próprio.
  const noSite = new Set(porPath.keys());
  for (const [p, g] of gsc) {
    if (noSite.has(p)) continue;
    const limpo = p.replace(/(?:%22|%27|[)"'])+\/$/, '/');
    const malformada = limpo !== p;
    reds.push({
      from_path: p,
      to_url: noSite.has(limpo) ? limpo : `${WP}/`,
      status_code: 301,
      origem: malformada ? 'url_malformada' : 'slug_removido',
      note: `${g.cliques} cliques e ${g.impressoes} impressões em 16 meses`,
    });
  }

  const total = await gravar('site_redirects', reds, 'from_path');
  const porOrigem = {};
  for (const r of reds) porOrigem[r.origem] = (porOrigem[r.origem] || 0) + 1;
  console.log(`  redirects: ${total}`, porOrigem);
  console.log('');
})().catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
