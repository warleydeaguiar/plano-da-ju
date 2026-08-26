#!/usr/bin/env node
/**
 * QA de paridade: compara o site novo com o retrato do WordPress de antes da
 * migração.
 *
 * É o portão do cutover. Nenhuma URL vira o DNS antes deste script fechar
 * limpo nas 50 páginas que concentram 91,9% dos cliques.
 *
 *   node scripts/qa-paridade-seo.mjs                          # top 50, contra localhost:3200
 *   node scripts/qa-paridade-seo.mjs --base=https://novo.julianecost.com
 *   node scripts/qa-paridade-seo.mjs --todas                   # as 283
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DADOS = path.join(RAIZ, 'scripts/dados-migracao');
const WP = 'https://julianecost.com';

const BASE = (process.argv.find((a) => a.startsWith('--base=')) || '--base=http://localhost:3200').slice(7).replace(/\/$/, '');
const TODAS = process.argv.includes('--todas');

const ler = (f) => JSON.parse(fs.readFileSync(path.join(DADOS, f), 'utf8'));

function texto(html) {
  return html.replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, ' ').trim();
}

const pegar = (h, re) => {
  const m = h.match(re);
  return m ? texto(m[1]) : '';
};

(async () => {
  const baseline = ler('baseline-wp-seo.json');
  const porUrl = new Map(baseline.map((b) => [b.url.replace(/\/$/, ''), b]));
  const gsc = ler('gsc-search-console.json');

  let alvos = gsc.paginas
    .filter((p) => p.chave.startsWith(WP) && !p.chave.includes('#') && !p.chave.includes('?') && !p.chave.includes('/wp-content/'))
    .sort((a, b) => b.cliques - a.cliques);
  if (!TODAS) alvos = alvos.slice(0, 50);

  console.log(`\nQA de paridade — ${alvos.length} URLs contra ${BASE}\n`);

  let ok = 0;
  const problemas = [];

  for (const alvo of alvos) {
    let caminho = alvo.chave.replace(WP, '');
    if (!caminho.endsWith('/')) caminho += '/';
    const b = porUrl.get(alvo.chave.replace(/\/$/, '')) || {};

    let h;
    try {
      const r = await fetch(BASE + caminho, { redirect: 'follow' });
      if (!r.ok) { problemas.push(`${caminho}  HTTP ${r.status}`); continue; }
      h = await r.text();
    } catch (e) {
      problemas.push(`${caminho}  ${(e).message}`);
      continue;
    }

    const falhas = [];
    if (pegar(h, /<title>(.*?)<\/title>/s) !== texto(b.title || '')) falhas.push('title');
    if (pegar(h, /name="description" content="([^"]*)/i) !== texto(b.desc || '')) falhas.push('description');
    if ((h.match(/canonical" href="([^"]*)/i)?.[1] || '').replace(/\/$/, '') !== alvo.chave.replace(/\/$/, '')) falhas.push('canonical');
    if ((h.match(/<h1/g) || []).length !== 1) falhas.push('h1');
    // Entidade crua dentro do corpo é normal (o WordPress também emite). Só é
    // defeito no title e no H1, onde o React escaparia de novo e o visitante
    // leria "&#8211;" na tela.
    if (/&#\d+;/.test(h.match(/<title>(.*?)<\/title>/s)?.[1] || '')) falhas.push('entidade-no-title');
    if (/&#\d+;/.test(h.match(/<h1[^>]*>(.*?)<\/h1>/s)?.[1] || '')) falhas.push('entidade-no-h1');
    if (h.includes('julianecost.com/wp-content')) falhas.push('ainda-depende-do-wordpress');
    if (!h.includes('application/ld+json')) falhas.push('sem-schema');

    if (falhas.length) problemas.push(`${caminho.slice(0, 52).padEnd(54)} ${falhas.join(', ')}`);
    else ok++;
  }

  const cliques = alvos.reduce((a, x) => a + x.cliques, 0);
  console.log(`  idênticas ao WordPress: ${ok}/${alvos.length}`);
  console.log(`  com divergência:        ${problemas.length}`);
  console.log(`  cliques cobertos:       ${cliques.toLocaleString('pt-BR')} em 16 meses`);
  if (problemas.length) {
    console.log('\n  divergências:');
    for (const p of problemas.slice(0, 40)) console.log(`    ${p}`);
    if (problemas.length > 40) console.log(`    ... e mais ${problemas.length - 40}`);
  }
  console.log('');
  process.exit(problemas.length ? 1 : 0);
})();
