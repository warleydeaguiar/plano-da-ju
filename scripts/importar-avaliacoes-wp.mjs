#!/usr/bin/env node
/**
 * Resgata as avaliações de produto que ficaram no WordPress.
 *
 * São 11 no total. Poucas, mas são de clientes reais de 2023 e sustentam o
 * aggregateRating dos dois únicos produtos que hoje têm nota. Sem elas, o
 * schema marcaria uma nota que não aparece em lugar nenhum da página — que é
 * violação de política do Google, não só falta de conteúdo.
 *
 * O WordPress já saiu do DNS, então o acesso é pelo IP de origem com o Host
 * forçado. Isso deixa de funcionar quando o servidor for desligado: rodar
 * antes disso.
 *
 *   node scripts/importar-avaliacoes-wp.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IP_ORIGEM = '173.236.218.149';
const USUARIO = 'julianecost_pb7gus';
const SENHA_APP = 'FZf9 7jdR VBr6 h294 shX9 gFJy';

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

/** `fetch` não resolve host manualmente; o curl do sistema resolve. */
async function doWordpress(caminho) {
  const { stdout } = await exec('curl', [
    '-s', '--max-time', '40',
    '--resolve', `julianecost.com:443:${IP_ORIGEM}`,
    '-u', `${USUARIO}:${SENHA_APP}`,
    '-A', 'Mozilla/5.0',
    `https://julianecost.com${caminho}`,
  ], { maxBuffer: 20 * 1024 * 1024 });
  return JSON.parse(stdout);
}

const limpar = (html) =>
  String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

(async () => {
  console.log('\nResgatando avaliações do WordPress\n');

  const brutas = await doWordpress(
    '/wp-json/wp/v2/comments?per_page=100&status=approve&type=review&_fields=id,post,author_name,content,date',
  );
  console.log(`  encontradas no WordPress: ${brutas.length}`);

  const conteudo = await supa('site_content?kind=eq.product&select=id,wp_id,path,rating_value');
  const porWpId = new Map(conteudo.map((c) => [c.wp_id, c]));

  const linhas = [];
  const semProduto = [];
  for (const c of brutas) {
    const produto = porWpId.get(c.post);
    if (!produto) { semProduto.push(c.post); continue; }
    const texto = limpar(c.content?.rendered);
    if (texto.length < 20) continue;
    linhas.push({
      content_id: produto.id,
      autora: (c.author_name || 'Cliente').trim().slice(0, 80),
      // O WooCommerce guarda a nota em meta que a REST não expõe. Como os dois
      // produtos com avaliação estavam ambos com média 5,0 na página, todas as
      // notas são 5 — conferido antes de assumir.
      nota: produto.rating_value ? Math.round(Number(produto.rating_value)) : 5,
      texto: texto.slice(0, 1500),
      data: (c.date || '').slice(0, 10) || null,
      origem: 'site_antigo',
    });
  }

  // Uma das 11 é duplicata exata (mesma autora, mesmo texto, mesma data).
  const unicas = [...new Map(linhas.map((l) => [`${l.content_id}|${l.autora}|${l.texto}`, l])).values()];
  console.log(`  prontas para gravar: ${unicas.length} (${linhas.length - unicas.length} duplicata descartada)`);
  if (semProduto.length) console.log(`  sem produto correspondente: ${semProduto.length}`);

  if (unicas.length) {
    await supa('site_avaliacoes?on_conflict=content_id,autora,texto', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(unicas),
    });
  }

  const resumo = await supa('site_avaliacoes_resumo?select=content_id,total,media');
  console.log(`\n  produtos com avaliação: ${resumo.length}`);
  for (const r of resumo) {
    const p = conteudo.find((c) => c.id === r.content_id);
    console.log(`    ${r.media} ★ · ${r.total} avaliações · ${p?.path ?? r.content_id}`);
  }
  console.log('');
})().catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
