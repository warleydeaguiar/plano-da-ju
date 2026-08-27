#!/usr/bin/env node
/**
 * Auditoria técnica de SEO: o Google consegue ler tudo?
 *
 * Diferente do QA de paridade (que compara com o WordPress), aqui a pergunta é
 * se a página está tecnicamente correta em si — schema que parseia, um H1 só,
 * imagem com alt, dimensão declarada, canônico coerente, sitemap batendo com o
 * que existe.
 *
 * Tudo é verificado no HTML SERVIDO, sem executar JavaScript — é assim que o
 * Google faz a primeira leitura, e é o que decide se a página entra no índice.
 *
 *   node scripts/auditar-seo-site.mjs --base=https://novo.julianecost.com
 *   node scripts/auditar-seo-site.mjs --amostra=40
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DADOS = path.join(RAIZ, 'scripts/dados-migracao');
const BASE = (process.argv.find((a) => a.startsWith('--base=')) || '--base=https://novo.julianecost.com').slice(7).replace(/\/$/, '');
const AMOSTRA = Number((process.argv.find((a) => a.startsWith('--amostra=')) || '').slice(10)) || 0;
const PARALELO = 6;

const problemas = [];
const anota = (nivel, url, texto) => problemas.push({ nivel, url, texto });

async function pegar(caminho) {
  const r = await fetch(BASE + caminho, { redirect: 'manual' });
  return { status: r.status, html: r.ok ? await r.text() : '', destino: r.headers.get('location') };
}

// -------------------------------------------------------------- verificações
function auditarPagina(caminho, html) {
  const achados = [];
  const add = (nivel, texto) => achados.push({ nivel, texto });

  // --- JSON-LD: precisa parsear. Schema quebrado é ignorado inteiro pelo Google.
  const blocos = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  if (!blocos.length) add('grave', 'sem JSON-LD');
  const tipos = new Set();
  for (const b of blocos) {
    try {
      const d = JSON.parse(b[1].replace(/\\u003c/g, '<'));
      for (const no of d['@graph'] || [d]) if (no['@type']) tipos.add(no['@type']);
    } catch (e) {
      add('grave', `JSON-LD não parseia: ${e.message.slice(0, 60)}`);
    }
  }

  // --- estrutura de títulos
  const h1 = html.match(/<h1[\s>]/g)?.length ?? 0;
  if (h1 === 0) add('grave', 'sem H1');
  if (h1 > 1) add('grave', `${h1} H1 na mesma página`);

  // --- título e descrição
  const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? '';
  if (!title) add('grave', 'sem <title>');
  else if (title.length > 70) add('aviso', `title com ${title.length} caracteres (o Google corta ~60)`);
  const desc = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
  if (!desc) add('aviso', 'sem meta description');
  else if (desc.length > 165) add('aviso', `description com ${desc.length} caracteres (o Google corta ~155)`);

  // --- canônico
  const canon = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1] ?? '';
  if (!canon) add('grave', 'sem canonical');
  else if (!canon.startsWith('https://julianecost.com')) add('grave', `canonical fora do domínio: ${canon.slice(0, 60)}`);
  else if (canon.replace('https://julianecost.com', '') !== caminho) {
    add('grave', `canonical aponta para outra página: ${canon.replace('https://julianecost.com', '')}`);
  }

  // --- imagens
  const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  const semAlt = imgs.filter((t) => !/\balt=/.test(t)).length;
  // alt="" é legítimo (imagem decorativa); alt ausente não é.
  if (semAlt) add('aviso', `${semAlt} de ${imgs.length} imagens sem atributo alt`);
  // Sem width/height o navegador não reserva espaço e a página "pula" ao
  // carregar — é o que o Google mede como CLS.
  const semDimensao = imgs.filter((t) => !/\bwidth=/.test(t) || !/\bheight=/.test(t)).length;
  if (semDimensao > 2) add('aviso', `${semDimensao} imagens sem width/height (risco de CLS)`);

  // --- o conteúdo existe sem JavaScript?
  const corpo = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (corpo.length < 600) add('grave', `só ${corpo.length} caracteres de texto no HTML — conteúdo pode depender de JS`);

  // --- dependência do WordPress
  if (html.includes('julianecost.com/wp-content')) add('grave', 'ainda carrega arquivo do WordPress');

  // --- noindex (esperado antes do cutover, grave depois)
  const robots = html.match(/<meta name="robots" content="([^"]*)"/)?.[1] ?? '';

  return { achados, tipos: [...tipos], robots, h1, imgs: imgs.length };
}

// ------------------------------------------------------------------ execução
(async () => {
  const baseline = JSON.parse(fs.readFileSync(path.join(DADOS, 'baseline-wp-seo.json'), 'utf8'));
  let caminhos = baseline
    .map((b) => { const p = new URL(b.url).pathname; return p.endsWith('/') ? p : `${p}/`; })
    .filter((p) => !['/carrinho/', '/finalizar-compra/', '/minha-conta/'].includes(p));
  caminhos = [...new Set(caminhos)];
  if (AMOSTRA) caminhos = caminhos.slice(0, AMOSTRA);

  console.log(`\nAuditoria técnica de SEO — ${caminhos.length} páginas em ${BASE}\n`);

  const tiposVistos = new Map();
  const robotsVistos = new Map();
  let ok = 0;
  const fila = [...caminhos];

  await Promise.all(Array.from({ length: PARALELO }, async () => {
    while (fila.length) {
      const c = fila.shift();
      try {
        const { status, html } = await pegar(c);
        if (status !== 200) { anota('grave', c, `HTTP ${status}`); continue; }
        const r = auditarPagina(c, html);
        for (const t of r.tipos) tiposVistos.set(t, (tiposVistos.get(t) || 0) + 1);
        robotsVistos.set(r.robots, (robotsVistos.get(r.robots) || 0) + 1);
        if (!r.achados.length) ok++;
        for (const a of r.achados) anota(a.nivel, c, a.texto);
      } catch (e) {
        anota('grave', c, `falhou: ${e.message.slice(0, 60)}`);
      }
    }
  }));

  // --- sitemap x realidade
  console.log('  conferindo sitemap e robots…');
  const sm = await fetch(`${BASE}/sitemap.xml`).then((r) => r.text());
  const noSitemap = new Set([...sm.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => new URL(m[1]).pathname));
  const faltando = caminhos.filter((c) => !noSitemap.has(c));
  const sobrando = [...noSitemap].filter((p) => !caminhos.includes(p) && !['/', '/blog/', '/loja/'].includes(p));

  // --- 404 e redirect
  const r404 = await pegar('/pagina-que-nao-existe-auditoria/');
  if (r404.status !== 404) anota('grave', '/pagina-que-nao-existe/', `404 devolve ${r404.status} em vez de 404`);

  // ------------------------------------------------------------- relatório
  const graves = problemas.filter((p) => p.nivel === 'grave');
  const avisos = problemas.filter((p) => p.nivel === 'aviso');

  console.log(`\n  páginas sem nenhum apontamento: ${ok}/${caminhos.length}`);
  console.log(`  GRAVES: ${graves.length}   avisos: ${avisos.length}\n`);

  const agrupa = (lista) => {
    const m = new Map();
    for (const p of lista) {
      const chave = p.texto.replace(/\d+/g, 'N');
      if (!m.has(chave)) m.set(chave, []);
      m.get(chave).push(p.url);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  };

  if (graves.length) {
    console.log('  === GRAVE ===');
    for (const [texto, urls] of agrupa(graves)) {
      console.log(`   ${String(urls.length).padStart(4)}x  ${texto}`);
      for (const u of urls.slice(0, 3)) console.log(`          ${u}`);
      if (urls.length > 3) console.log(`          … e mais ${urls.length - 3}`);
    }
  }
  if (avisos.length) {
    console.log('\n  === aviso ===');
    for (const [texto, urls] of agrupa(avisos)) {
      console.log(`   ${String(urls.length).padStart(4)}x  ${texto}`);
      for (const u of urls.slice(0, 2)) console.log(`          ${u}`);
    }
  }

  console.log('\n  === schema encontrado ===');
  for (const [t, n] of [...tiposVistos].sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(4)}x  ${t}`);

  console.log('\n  === meta robots ===');
  for (const [r, n] of robotsVistos) console.log(`   ${String(n).padStart(4)}x  ${r || '(ausente)'}`);

  console.log('\n  === sitemap ===');
  console.log(`   URLs no sitemap: ${noSitemap.size}`);
  console.log(`   páginas fora do sitemap: ${faltando.length}`);
  for (const f of faltando.slice(0, 8)) console.log(`      ${f}`);
  console.log(`   no sitemap mas não auditadas: ${sobrando.length}`);
  console.log('');

  process.exit(graves.length ? 1 : 0);
})();
