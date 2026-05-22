#!/usr/bin/env node
/**
 * Atualiza o plano existente no PagarMe pra adicionar:
 *  - installments: [1, 2, 3, 4]
 *  - statement_descriptor: PLANODAJU
 *
 * Uso: node scripts/fix-plan.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, '..', 'apps', 'web', '.env.local');

function loadEnv(p) {
  const txt = fs.readFileSync(p, 'utf8');
  for (const raw of txt.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnv(ENV_PATH);
const SECRET = process.env.PAGARME_SECRET_KEY;
const PLAN_ID = 'plan_OjAMrqaHXNc0pqLB';
const BASE_URL = 'https://api.pagar.me/core/v5';
const headers = {
  'Content-Type': 'application/json',
  Authorization: `Basic ${Buffer.from(SECRET + ':').toString('base64')}`,
};

async function req(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  console.log(`Buscando plano ${PLAN_ID}...`);
  const current = await req('GET', `/plans/${PLAN_ID}`);
  if (!current.ok) {
    console.error('✘ Plano não encontrado:', current.status, current.data);
    process.exit(1);
  }

  console.log('Estado atual:');
  console.log('  installments:', JSON.stringify(current.data.installments));
  console.log('  statement_descriptor:', current.data.statement_descriptor ?? '(vazio)');

  console.log('\nAtualizando para installments=[1,2,3,4] e statement_descriptor=PLANODAJU...');

  // PagarMe v5: PUT /plans/{id} aceita esses campos pra update
  const updated = await req('PUT', `/plans/${PLAN_ID}`, {
    name: current.data.name,
    interval: current.data.interval,
    interval_count: current.data.interval_count,
    billing_type: current.data.billing_type,
    payment_methods: current.data.payment_methods,
    currency: current.data.currency || 'BRL',
    status: current.data.status || 'active',
    statement_descriptor: 'PLANODAJU',
    installments: [1, 2, 3, 4],
  });

  if (!updated.ok) {
    console.error(`\n✘ PUT falhou (${updated.status}):`, JSON.stringify(updated.data, null, 2));
    console.log('\nTentando PATCH...');
    const patched = await req('PATCH', `/plans/${PLAN_ID}`, {
      statement_descriptor: 'PLANODAJU',
      installments: [1, 2, 3, 4],
    });
    if (!patched.ok) {
      console.error(`✘ PATCH também falhou (${patched.status}):`, JSON.stringify(patched.data, null, 2));
      console.log('\n→ AÇÃO MANUAL: delete o plano no dashboard PagarMe e remova PAGARME_PLAN_CARD_ID do Vercel.');
      process.exit(1);
    }
    console.log('✓ PATCH aceito');
  } else {
    console.log('✓ PUT aceito');
  }

  // Re-busca pra confirmar
  console.log('\nVerificando estado pós-update...');
  const after = await req('GET', `/plans/${PLAN_ID}`);
  console.log('  installments:', JSON.stringify(after.data.installments));
  console.log('  statement_descriptor:', after.data.statement_descriptor ?? '(vazio)');

  const ok =
    Array.isArray(after.data.installments) &&
    [1, 2, 3, 4].every(n => after.data.installments.includes(n)) &&
    after.data.statement_descriptor === 'PLANODAJU';

  if (ok) {
    console.log('\n✓ PLANO CORRIGIDO. Compras parceladas vão funcionar agora.');
  } else {
    console.log('\n✘ Ainda não está como deveria. Pode precisar deletar+recriar.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('✘ Erro:', err);
  process.exit(1);
});
