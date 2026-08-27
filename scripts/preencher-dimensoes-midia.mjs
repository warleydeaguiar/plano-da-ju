#!/usr/bin/env node
/**
 * Preenche largura e altura de cada imagem migrada.
 *
 * Sem width/height no <img>, o navegador não sabe quanto espaço reservar: o
 * texto aparece, a imagem carrega depois e a página inteira pula. É o que o
 * Google mede como CLS, uma das três métricas de Core Web Vitals. A auditoria
 * apontou 195 páginas nessa situação.
 *
 * A fonte é a própria API do WordPress: cada item de mídia declara suas
 * dimensões E as de cada variação de tamanho gerada (`media_details.sizes`).
 * O conteúdo referencia justamente essas variações, então sem ler `sizes` a
 * maioria das imagens ficaria de fora.
 *
 *   node scripts/preencher-dimensoes-midia.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WP = 'https://julianecost.com';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0 Safari/537.36';

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
  if (!r.ok) throw new Error(`Supabase ${caminho}: ${r.status} ${(await r.text()).slice(0, 250)}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

const semProtocolo = (u) => String(u || '').replace(/^https?:/, '').split('?')[0];

(async () => {
  console.log('\nLendo dimensões da biblioteca do WordPress…\n');

  // url (sem protocolo) -> { w, h }
  const dim = new Map();
  for (let pagina = 1; pagina <= 25; pagina++) {
    const r = await fetch(
      `${WP}/wp-json/wp/v2/media?per_page=100&page=${pagina}&_fields=source_url,media_details`,
      { headers: { 'User-Agent': UA } },
    );
    if (!r.ok) break;
    const lote = await r.json();
    if (!Array.isArray(lote) || !lote.length) break;
    for (const m of lote) {
      const d = m.media_details || {};
      if (m.source_url && d.width && d.height) dim.set(semProtocolo(m.source_url), { w: d.width, h: d.height });
      // As variações de tamanho são o que o conteúdo realmente referencia.
      for (const s of Object.values(d.sizes || {})) {
        if (s?.source_url && s.width && s.height) dim.set(semProtocolo(s.source_url), { w: s.width, h: s.height });
      }
    }
    const total = Number(r.headers.get('x-wp-totalpages') || 1);
    if (pagina >= total) break;
  }
  console.log(`  URLs com dimensão conhecida: ${dim.size}`);

  const midia = await supa('site_media?select=id,original_url,width,height&limit=5000');
  console.log(`  imagens no banco: ${midia.length}`);

  const atualizar = [];
  let jaTinha = 0;
  for (const m of midia) {
    if (m.width && m.height) { jaTinha++; continue; }
    const d = dim.get(semProtocolo(m.original_url));
    if (d) atualizar.push({ id: m.id, width: d.w, height: d.h });
  }

  console.log(`  já tinham dimensão: ${jaTinha}`);
  console.log(`  vou preencher: ${atualizar.length}`);
  console.log(`  sem correspondência: ${midia.length - jaTinha - atualizar.length}\n`);

  for (const a of atualizar) {
    await supa(`site_media?id=eq.${a.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ width: a.width, height: a.height }),
    });
  }
  console.log('  gravado. Rode reescrever-conteudo-site.mjs para aplicar no HTML.\n');
})().catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
