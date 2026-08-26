#!/usr/bin/env node
/**
 * Gera `content_clean` a partir do `content_html` cru do WordPress.
 *
 * O que faz:
 *   - troca cada <img> por <picture> com AVIF + WebP do nosso storage
 *   - remove srcset/sizes, que apontavam para variações de tamanho do WP e
 *     manteriam o site novo dependente do WordPress no ar
 *   - remove o lixo de lazy-load (noscript duplicado, data-lazy-*) e atributos
 *     de plugin que não significam nada fora do WordPress
 *
 * `content_html` nunca é alterado — é a fonte da verdade. Isto é derivado e
 * pode ser regerado quantas vezes for preciso.
 *
 *   node scripts/reescrever-conteudo-site.mjs
 *   node scripts/reescrever-conteudo-site.mjs --dry
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry');

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

const escapar = (s) => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function atributo(tag, nome) {
  const m = tag.match(new RegExp(`${nome}=["']([^"']*)["']`, 'i'));
  return m ? m[1] : null;
}

/**
 * <picture> com AVIF primeiro e WebP como fallback. O <img> final aponta para
 * o WebP: navegador antigo que ignora <source> ainda mostra a imagem.
 */
function montarPicture(avifUrl, tagOriginal) {
  const webpUrl = avifUrl.replace(/\.avif$/, '.webp');
  const alt = escapar(atributo(tagOriginal, 'alt') || '');
  const largura = atributo(tagOriginal, 'width');
  const altura = atributo(tagOriginal, 'height');
  const classe = atributo(tagOriginal, 'class');
  const dim = [
    largura && /^\d+$/.test(largura) ? ` width="${largura}"` : '',
    altura && /^\d+$/.test(altura) ? ` height="${altura}"` : '',
  ].join('');
  const cls = classe ? ` class="${escapar(classe)}"` : '';
  return `<picture>` +
    `<source srcset="${avifUrl}" type="image/avif">` +
    `<source srcset="${webpUrl}" type="image/webp">` +
    `<img src="${webpUrl}" alt="${alt}"${dim}${cls} loading="lazy" decoding="async">` +
    `</picture>`;
}

function limpar(html, mapa, contador) {
  let saida = html || '';

  // O lazy-load do WP duplica cada imagem dentro de <noscript>. Manter os dois
  // faria a imagem contar duas vezes no HTML final.
  saida = saida.replace(/<noscript>[\s\S]*?<\/noscript>/gi, '');

  // A limpeza vem ANTES de montar os <picture>. Na ordem inversa ela apagaria
  // o srcset que acabamos de gerar, deixando <source> vazio — o navegador
  // ignoraria o AVIF em silêncio e todo mundo receberia o WebP.
  saida = saida.replace(/\s(?:srcset|sizes|data-lazy-srcset|data-lazy-sizes)=["'][^"']*["']/gi, '');
  saida = saida.replace(/\s(?:data-ll-status|data-was-processed|data-id|data-element_type|data-widget_type|data-settings)=["'][^"']*["']/gi, '');

  saida = saida.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = atributo(tag, 'src') || atributo(tag, 'data-src') || atributo(tag, 'data-lazy-src');
    if (!src) { contador.semSrc++; return tag; }
    const abs = src.startsWith('//') ? `https:${src}` : src;
    const nova = mapa.get(abs) || mapa.get(abs.replace(/^http:/, 'https:')) || mapa.get(abs.split('?')[0]);
    if (!nova) { contador.naoAchou.add(src); return tag; }
    contador.trocadas++;
    return montarPicture(nova, tag);
  });

  return saida.trim();
}

(async () => {
  console.log(`\nReescrevendo conteúdo${DRY ? '  [DRY-RUN]' : ''}\n`);

  const midia = await supa('site_media?public_url=not.is.null&select=original_url,public_url&limit=5000');
  const mapa = new Map(midia.map((m) => [m.original_url, m.public_url]));
  console.log(`  imagens disponíveis no storage: ${mapa.size}`);

  const conteudo = await supa('site_content?select=id,kind,path,content_html&limit=1000');
  console.log(`  conteúdos a processar: ${conteudo.length}\n`);

  const contador = { trocadas: 0, semSrc: 0, naoAchou: new Set() };
  const atualizacoes = [];
  for (const c of conteudo) {
    const limpo = limpar(c.content_html, mapa, contador);
    atualizacoes.push({ id: c.id, content_clean: limpo });
  }

  if (!DRY) {
    for (const a of atualizacoes) {
      await supa(`site_content?id=eq.${a.id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ content_clean: a.content_clean }),
      });
    }
  }

  console.log(`  <img> trocadas por <picture>: ${contador.trocadas}`);
  console.log(`  <img> sem src reconhecível:   ${contador.semSrc}`);
  console.log(`  URLs sem correspondência:     ${contador.naoAchou.size}`);
  for (const u of [...contador.naoAchou].slice(0, 12)) console.log(`      ${u.slice(0, 96)}`);
  if (contador.naoAchou.size > 12) console.log(`      ... e mais ${contador.naoAchou.size - 12}`);
  console.log('');
})().catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
