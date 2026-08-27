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
function montarPicture(avifUrl, tagOriginal, tamanho) {
  const webpUrl = avifUrl.replace(/\.avif$/, '.webp');
  const alt = escapar(atributo(tagOriginal, 'alt') || '');
  // Prioriza a dimensão real do arquivo (vinda do banco) sobre a que estava no
  // HTML do WordPress: o `width` escrito à mão no editor às vezes era o tamanho
  // exibido, não o do arquivo, e aí a proporção reservada sai errada.
  const largura = tamanho?.width || atributo(tagOriginal, 'width');
  const altura = tamanho?.height || atributo(tagOriginal, 'height');
  const classe = atributo(tagOriginal, 'class');
  const dim = [
    largura && /^\d+$/.test(String(largura)) ? ` width="${largura}"` : '',
    altura && /^\d+$/.test(String(altura)) ? ` height="${altura}"` : '',
  ].join('');
  const cls = classe ? ` class="${escapar(classe)}"` : '';
  return `<picture>` +
    `<source srcset="${avifUrl}" type="image/avif">` +
    `<source srcset="${webpUrl}" type="image/webp">` +
    `<img src="${webpUrl}" alt="${alt}"${dim}${cls} loading="lazy" decoding="async">` +
    `</picture>`;
}

const WHATSAPP_NUMERO = '5531999994001';

/**
 * Todo caminho que levava a Juliane por WhatsApp, e que hoje está quebrado.
 *
 * Os encurtadores foram conferidos um a um: `abrir.link`, `wa.link`,
 * `curtlink.com` e `curt.link` TODOS redirecionam para os números
 * `553171445597` e `5531971445597`, que ela não atende mais. `shre.ink` já
 * devolve 404. São 104 páginas com pelo menos um desses links — ou seja, a
 * maior parte das chamadas de compra do site estava morta.
 */
const ENCURTADORES = /https?:\/\/(?:abrir\.link|wa\.link|curtlink\.com|curt\.link|shre\.ink)\/[A-Za-z0-9_-]+/gi;
const WHATSAPP_DIRETO = /https?:\/\/(?:api\.whatsapp\.com\/send\?[^"'\s<]*|wa\.me\/[^"'\s<]*)/gi;

const semTagsCurto = (html) =>
  String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function linkWhats({ produto, artigo }) {
  const mensagem = produto
    ? `Oi, tudo bem? Estou interessada no produto ${produto}. Você poderia me enviar o link para comprar com desconto adicional?`
    : artigo
      ? `Oi, tudo bem? Vim pelo artigo "${artigo}" e queria o link para comprar com desconto adicional.`
      : 'Oi, tudo bem? Vim pelo site e queria tirar uma dúvida sobre os produtos.';
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensagem)}`;
}

/**
 * Troca todo link de WhatsApp quebrado pelo número atual, com a mensagem já
 * dizendo o que a pessoa estava vendo.
 *
 * Num post "Top 10 melhores progressivas" existem dez links diferentes, e cada
 * um está logo abaixo do título da sua seção. Por isso o assunto vem do H2/H3
 * mais próximo ACIMA do link, e não do título do artigo: assim quem clica no
 * item 5 chega no WhatsApp dizendo "Escova Progressiva Bio Lizz", não "Top 10
 * melhores progressivas". Em página de produto o assunto é o próprio produto.
 */
function corrigirWhatsapp(html, item, contador) {
  const ehProduto = item?.kind === 'product';
  let produtoDaSecao = ehProduto ? item.title : null;

  return String(html || '').replace(
    /<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>|https?:\/\/[^"'\s<]+/gi,
    (trecho, mioloHeading) => {
      if (mioloHeading !== undefined) {
        if (!ehProduto) {
          // Só título NUMERADO vira nome de produto. Num "Top 10", os itens da
          // lista são justamente as seções numeradas — e essa é a única pista
          // confiável. Sem esse filtro, a mensagem saía com "Estou interessada
          // no produto Conclusão Melhor shampoo para cabelo loiro".
          const texto = semTagsCurto(mioloHeading);
          const numerado = texto.match(/^\s*\d+\s*[.)-]\s*(.{4,80})$/);
          produtoDaSecao = numerado ? numerado[1].trim() : null;
        }
        return trecho;
      }
      ENCURTADORES.lastIndex = 0;
      WHATSAPP_DIRETO.lastIndex = 0;
      if (!ENCURTADORES.test(trecho) && !WHATSAPP_DIRETO.test(trecho)) return trecho;
      contador.whatsappCorrigidos++;
      // Sem produto identificado, a mensagem cita o artigo: a Juliane continua
      // sabendo o que a pessoa estava lendo, que é o que ela precisa para
      // atender bem.
      return linkWhats({ produto: produtoDaSecao, artigo: item?.title });
    },
  );
}

/** Slug estável para âncora de heading. */
function slugAncora(texto, usados) {
  const base = texto
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'secao';
  let slug = base;
  let n = 2;
  while (usados.has(slug)) slug = `${base}-${n++}`;
  usados.add(slug);
  return slug;
}

/**
 * Põe `id` em cada H2 do conteúdo.
 *
 * É o que permite o índice no topo do post — e, num site cujo conteúdo é
 * "Top 10 melhores X", é também o que dá ao Google âncoras para exibir como
 * sublinks do resultado. Precisa estar no HTML estático, não montado por
 * script no navegador.
 */
function ancorarHeadings(html) {
  const usados = new Set();
  return String(html || '').replace(
    /<h2\b([^>]*)>([\s\S]*?)<\/h2>/gi,
    (inteiro, attrs, miolo) => {
      if (/\bid=/.test(attrs)) return inteiro;
      const texto = miolo.replace(/<[^>]+>/g, ' ').trim();
      if (!texto) return inteiro;
      return `<h2${attrs} id="${slugAncora(texto, usados)}">${miolo}</h2>`;
    },
  );
}

function limpar(html, mapa, dimensoes, contador, item) {
  let saida = html || '';

  saida = corrigirWhatsapp(saida, item, contador);

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
    const chave = mapa.has(abs) ? abs : mapa.has(abs.replace(/^http:/, 'https:')) ? abs.replace(/^http:/, 'https:') : abs.split('?')[0];
    const nova = mapa.get(chave);
    if (!nova) { contador.naoAchou.add(src); return tag; }
    contador.trocadas++;
    const tamanho = dimensoes.get(chave);
    if (!tamanho) contador.semDimensao++;
    return montarPicture(nova, tag, tamanho);
  });

  // O corpo vindo do WordPress às vezes traz um <h1> próprio, e a página passa
  // a ter dois: o do template e o do conteúdo. Dois H1 confundem o Google sobre
  // qual é o assunto da página. Rebaixar para H2 preserva a hierarquia e ainda
  // ganha âncora no índice.
  saida = saida.replace(/<(\/?)h1\b/gi, '<$1h2');

  saida = ancorarHeadings(saida);

  return saida.trim();
}

(async () => {
  console.log(`\nReescrevendo conteúdo${DRY ? '  [DRY-RUN]' : ''}\n`);

  const midia = await supa('site_media?public_url=not.is.null&select=original_url,public_url,width,height&limit=5000');
  const mapa = new Map(midia.map((m) => [m.original_url, m.public_url]));
  const dimensoes = new Map(
    midia.filter((m) => m.width && m.height).map((m) => [m.original_url, { width: m.width, height: m.height }]),
  );
  console.log(`  imagens disponíveis no storage: ${mapa.size}`);
  console.log(`  com dimensão conhecida: ${dimensoes.size}`);

  const conteudo = await supa(
    'site_content?select=id,kind,path,title,content_html,og_image,featured_image_url&limit=1000',
  );
  console.log(`  conteúdos a processar: ${conteudo.length}\n`);

  const contador = { trocadas: 0, semSrc: 0, semDimensao: 0, whatsappCorrigidos: 0, naoAchou: new Set() };
  let capasTrocadas = 0;
  const atualizacoes = [];
  for (const c of conteudo) {
    const limpo = limpar(c.content_html, mapa, dimensoes, contador, c);

    // og:image e imagem de destaque não estão no corpo do texto, mas são o que
    // aparece no compartilhamento, no Article.image do schema e na miniatura
    // das listagens. Sem trocar aqui, continuariam apontando para o WordPress
    // e ficariam quebradas no dia em que ele sair do ar.
    const capa = c.og_image ? mapa.get(c.og_image) || null : null;
    if (capa) capasTrocadas++;

    atualizacoes.push({
      id: c.id,
      content_clean: limpo,
      ...(capa ? { og_image: capa, featured_image_url: capa } : {}),
    });
  }

  if (!DRY) {
    for (const a of atualizacoes) {
      const { id, ...campos } = a;
      await supa(`site_content?id=eq.${id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(campos),
      });
    }
  }
  console.log(`  capas (og:image) apontando para o storage: ${capasTrocadas}`);

  console.log(`  <img> trocadas por <picture>: ${contador.trocadas}`);
  console.log(`  <img> sem src reconhecível:   ${contador.semSrc}`);
  console.log(`  <img> sem dimensão (risco CLS): ${contador.semDimensao}`);
  console.log(`  links de WhatsApp corrigidos:  ${contador.whatsappCorrigidos}`);
  console.log(`  URLs sem correspondência:     ${contador.naoAchou.size}`);
  for (const u of [...contador.naoAchou].slice(0, 12)) console.log(`      ${u.slice(0, 96)}`);
  if (contador.naoAchou.size > 12) console.log(`      ... e mais ${contador.naoAchou.size - 12}`);
  console.log('');
})().catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
