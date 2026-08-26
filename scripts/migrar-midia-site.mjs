#!/usr/bin/env node
/**
 * Migra as imagens usadas no conteúdo do WordPress para o storage do Supabase,
 * convertendo para AVIF + WebP.
 *
 * Só migra o que está de fato embutido em post/página/produto (`used_in_content`).
 * A biblioteca do WordPress tem ~1.777 itens e boa parte é sobra de Instagram,
 * com vídeos de dezenas de MB que ninguém referencia.
 *
 * Cada imagem vira DOIS arquivos, servidos por <picture>: AVIF para quem
 * aceita, WebP como fallback universal. Sem conversão em runtime — o Next
 * cobraria por transformação a cada imagem nova, e aqui são mais de mil.
 * SVG e GIF passam intactos (vetor não ganha nada, GIF perderia a animação).
 *
 * Retomável: pula o que já tem public_url. Pode interromper e rodar de novo.
 *
 *   node scripts/migrar-midia-site.mjs
 *   node scripts/migrar-midia-site.mjs --limite=50   # lote pequeno pra testar
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUCKET = 'site-conteudo';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0 Safari/537.36';
const PARALELO = 4;

const LIMITE = Number((process.argv.find((a) => a.startsWith('--limite=')) || '').slice(9)) || 0;

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

async function subir(chave, buffer, mime) {
  const r = await fetch(`${SUPA_URL}/storage/v1/object/${BUCKET}/${chave}`, {
    method: 'POST',
    headers: {
      apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': mime, 'x-upsert': 'true', 'cache-control': 'public, max-age=31536000, immutable',
    },
    body: buffer,
  });
  if (!r.ok) throw new Error(`upload ${chave}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return `${SUPA_URL}/storage/v1/object/public/${BUCKET}/${chave}`;
}

/**
 * Nome estável derivado da URL original. Duas imagens diferentes com o mesmo
 * nome de arquivo (o WordPress permite) não se sobrescrevem, e reexecutar
 * sempre gera o mesmo caminho.
 */
function chaveDe(url) {
  const hash = crypto.createHash('sha1').update(url).digest('hex').slice(0, 10);
  const base = decodeURIComponent(url.split('?')[0].split('/').pop() || 'imagem')
    .replace(/\.[^.]+$/, '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'imagem';
  return `${hash}/${base}`;
}

const MIME = {
  avif: 'image/avif', webp: 'image/webp', svg: 'image/svg+xml',
  gif: 'image/gif', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
};

async function processarUma(item, tmp) {
  const url = item.original_url;
  const ext = (url.split('?')[0].split('.').pop() || '').toLowerCase();

  const resp = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!resp.ok) throw new Error(`download ${resp.status}`);
  const original = Buffer.from(await resp.arrayBuffer());
  const chave = chaveDe(url);

  // Vetor e animação passam direto: converter só pioraria.
  if (ext === 'svg' || ext === 'gif') {
    const publica = await subir(`${chave}.${ext}`, original, MIME[ext]);
    return { public_url: publica, storage_path: `${chave}.${ext}`, mime_type: MIME[ext],
             filesize: original.length, bytes_antes: original.length, bytes_depois: original.length };
  }

  const entrada = path.join(tmp, `e.${ext || 'jpg'}`);
  const saidaAvif = path.join(tmp, 's.avif');
  const saidaWebp = path.join(tmp, 's.webp');
  fs.writeFileSync(entrada, original);

  // avifenc não lê webp; nesse caso passa por PNG usando o sips do macOS.
  let fonte = entrada;
  if (ext === 'webp') {
    fonte = path.join(tmp, 'e.png');
    await exec('sips', ['-s', 'format', 'png', entrada, '--out', fonte]);
  }

  await exec('avifenc', ['--min', '24', '--max', '34', '--speed', '6', '-j', 'all', fonte, saidaAvif]);
  await exec('cwebp', ['-quiet', '-q', '80', '-m', '5', fonte, '-o', saidaWebp]);

  const avif = fs.readFileSync(saidaAvif);
  const webp = fs.readFileSync(saidaWebp);
  const publicaAvif = await subir(`${chave}.avif`, avif, MIME.avif);
  await subir(`${chave}.webp`, webp, MIME.webp);

  for (const f of [entrada, fonte, saidaAvif, saidaWebp]) { try { fs.unlinkSync(f); } catch {} }

  return {
    public_url: publicaAvif, storage_path: `${chave}.avif`, mime_type: MIME.avif,
    filesize: avif.length, bytes_antes: original.length, bytes_depois: avif.length + webp.length,
  };
}

(async () => {
  const pendentes = await supa(
    `site_media?used_in_content=is.true&public_url=is.null&select=id,original_url&order=id${LIMITE ? `&limit=${LIMITE}` : ''}`,
  );
  console.log(`\nMigrando mídia para o bucket "${BUCKET}"`);
  console.log(`  pendentes: ${pendentes.length}\n`);
  if (!pendentes.length) { console.log('  nada a fazer.\n'); return; }

  const tmpRaiz = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-midia-'));
  let ok = 0, falhas = 0, antes = 0, depois = 0;
  const erros = [];

  const fila = [...pendentes];
  await Promise.all(Array.from({ length: PARALELO }, async (_, w) => {
    const tmp = path.join(tmpRaiz, String(w));
    fs.mkdirSync(tmp, { recursive: true });
    while (fila.length) {
      const item = fila.shift();
      try {
        const r = await processarUma(item, tmp);
        antes += r.bytes_antes; depois += r.bytes_depois;
        await supa(`site_media?id=eq.${item.id}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            public_url: r.public_url, storage_path: r.storage_path,
            mime_type: r.mime_type, filesize: r.filesize,
            migrated_at: new Date().toISOString(),
          }),
        });
        ok++;
      } catch (e) {
        falhas++;
        erros.push(`${item.original_url.split('/').pop()}: ${e.message}`);
      }
      const feito = ok + falhas;
      if (feito % 25 === 0) console.log(`  ${feito}/${pendentes.length}  (${ok} ok, ${falhas} falhas)`);
    }
  }));

  try { fs.rmSync(tmpRaiz, { recursive: true, force: true }); } catch {}

  console.log(`\n  migradas: ${ok} | falhas: ${falhas}`);
  if (antes) {
    console.log(`  peso: ${(antes / 1048576).toFixed(1)} MB -> ${(depois / 1048576).toFixed(1)} MB ` +
      `(${(100 - (depois / antes) * 100).toFixed(0)}% menor, já contando AVIF + WebP juntos)`);
  }
  if (erros.length) {
    console.log(`\n  erros (${erros.length}):`);
    for (const e of erros.slice(0, 15)) console.log(`    ${e}`);
    if (erros.length > 15) console.log(`    ... e mais ${erros.length - 15}`);
  }
  console.log('');
})().catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
