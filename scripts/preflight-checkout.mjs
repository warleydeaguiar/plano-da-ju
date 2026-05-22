#!/usr/bin/env node
/**
 * Pré-voo do checkout de cartão.
 *
 * Faz checks SEM criar transação:
 *  1. Conectividade com PagarMe (whoami)
 *  2. Plano existe (via env PAGARME_PLAN_CARD_ID OU lookup por nome)
 *  3. Plano tem array installments [1,2,3,4]
 *  4. Plano tem statement_descriptor configurado
 *  5. Webhook configurado no PagarMe? (lista endpoints)
 *  6. Env vars críticas configuradas?
 *
 * Uso: node scripts/preflight-checkout.mjs
 * Requer: apps/web/.env.local com PAGARME_SECRET_KEY
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, '..', 'apps', 'web', '.env.local');

// Carrega .env.local manualmente (sem dependência)
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

if (!fs.existsSync(ENV_PATH)) {
  console.error(`✘ .env.local não encontrado em ${ENV_PATH}`);
  process.exit(1);
}
loadEnv(ENV_PATH);

const SECRET = process.env.PAGARME_SECRET_KEY;
const PLAN_ID_ENV = process.env.PAGARME_PLAN_CARD_ID;
const WEBHOOK_USER = process.env.PAGARME_WEBHOOK_USER;
const WEBHOOK_PASS = process.env.PAGARME_WEBHOOK_PASS;
const PLAN_NAME = 'Plano da Ju — Anual Cartão';

if (!SECRET) {
  console.error('✘ PAGARME_SECRET_KEY ausente em .env.local');
  process.exit(1);
}

const BASE_URL = 'https://api.pagar.me/core/v5';
const headers = {
  'Content-Type': 'application/json',
  Authorization: `Basic ${Buffer.from(SECRET + ':').toString('base64')}`,
};

async function get(path) {
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

const log = {
  pass: (msg) => console.log(`✓ ${msg}`),
  fail: (msg) => console.log(`✘ ${msg}`),
  warn: (msg) => console.log(`⚠ ${msg}`),
  info: (msg) => console.log(`· ${msg}`),
  section: (msg) => console.log(`\n━━━ ${msg} ━━━`),
};

let failures = 0;

async function main() {
  log.section('1. Conectividade PagarMe');
  const ping = await get('/plans?size=1');
  if (!ping.ok) {
    log.fail(`API rejeitou: ${ping.status} ${JSON.stringify(ping.data).slice(0, 200)}`);
    failures++;
    return;
  }
  log.pass(`API respondeu (${ping.status})`);
  log.info(`Chave: ${SECRET.slice(0, 10)}...${SECRET.slice(-4)} ${SECRET.startsWith('sk_test') ? '(SANDBOX)' : '(LIVE)'}`);

  log.section('2. Plano anual cartão');
  let plan = null;

  if (PLAN_ID_ENV) {
    log.info(`PAGARME_PLAN_CARD_ID=${PLAN_ID_ENV}`);
    const r = await get(`/plans/${PLAN_ID_ENV}`);
    if (!r.ok) {
      log.fail(`Plano do env não existe na PagarMe (${r.status}). Provavelmente foi deletado ou ID errado.`);
      log.warn('→ Limpe PAGARME_PLAN_CARD_ID no Vercel e refaça o deploy. O sistema criará um novo plano na próxima compra.');
      failures++;
    } else {
      plan = r.data;
      log.pass(`Plano achado: ${plan.id} (status: ${plan.status})`);
    }
  } else {
    log.warn('PAGARME_PLAN_CARD_ID não setado — sistema vai buscar por nome a cada cold start');
    const r = await get(`/plans?name=${encodeURIComponent(PLAN_NAME)}&size=10`);
    if (r.ok && r.data?.data?.length) {
      const matches = r.data.data.filter(p => p.name === PLAN_NAME);
      if (matches.length === 0) {
        log.warn('Nenhum plano com nome exato encontrado. Será criado na primeira compra.');
      } else if (matches.length === 1) {
        plan = matches[0];
        log.pass(`Plano único achado por nome: ${plan.id} (status: ${plan.status})`);
        log.warn(`→ Recomendado setar PAGARME_PLAN_CARD_ID=${plan.id} no Vercel pra evitar lookup`);
      } else {
        log.fail(`MÚLTIPLOS PLANOS com o mesmo nome (${matches.length}). Isso vai dar problema. Delete os antigos no dashboard.`);
        matches.forEach(p => log.info(`  - ${p.id} (status: ${p.status})`));
        failures++;
        plan = matches.find(p => p.status === 'active') ?? matches[0];
      }
    }
  }

  if (!plan) {
    log.warn('Sem plano pra validar estrutura. Será criado na primeira compra com installments=[1,2,3,4] e statement_descriptor=PLANODAJU.');
  } else {
    log.section('3. Estrutura do plano');

    const inst = plan.installments;
    if (Array.isArray(inst) && [1, 2, 3, 4].every(n => inst.includes(n))) {
      log.pass(`installments: [${inst.join(', ')}]`);
    } else {
      log.fail(`installments AUSENTE ou incompleto: ${JSON.stringify(inst)}`);
      log.warn('→ AÇÃO: delete esse plano no dashboard PagarMe e limpe PAGARME_PLAN_CARD_ID. Sem isso, compras parceladas serão rejeitadas.');
      failures++;
    }

    if (plan.statement_descriptor) {
      log.pass(`statement_descriptor: "${plan.statement_descriptor}"`);
    } else {
      log.fail('statement_descriptor AUSENTE. Cliente verá nome genérico na fatura → chargebacks.');
      log.warn('→ AÇÃO: delete esse plano e recrie via primeira compra.');
      failures++;
    }

    if (plan.interval === 'year' && plan.interval_count === 1) {
      log.pass(`interval: ${plan.interval} (${plan.interval_count}x)`);
    } else {
      log.fail(`interval errado: ${plan.interval} (${plan.interval_count}x) — esperado: year (1x)`);
      failures++;
    }

    const item = plan.items?.[0];
    if (item?.pricing_scheme?.price === 3490) {
      log.pass(`preço: R$ 34,90 (3490 centavos)`);
    } else {
      log.fail(`preço errado: ${item?.pricing_scheme?.price} — esperado 3490`);
      failures++;
    }

    if (plan.payment_methods?.includes('credit_card')) {
      log.pass(`payment_methods inclui credit_card`);
    } else {
      log.fail(`payment_methods sem credit_card: ${plan.payment_methods?.join(', ')}`);
      failures++;
    }
  }

  log.section('4. Webhooks configurados');
  // PagarMe v5: endpoint para listar webhooks é /hooks (ou similar) — varia. Vamos tentar.
  const hooks = await get('/hooks?size=20');
  if (!hooks.ok) {
    log.warn(`Não foi possível listar webhooks (${hooks.status}) — checar manualmente no dashboard`);
  } else if (!hooks.data?.data?.length) {
    log.fail('Nenhum webhook configurado na PagarMe. Sem webhook, perfis nunca ficam ativos após pagamento.');
    log.warn('→ AÇÃO: dashboard PagarMe → Webhooks → adicionar https://plano.julianecost.com/api/webhook/pagarme com Basic Auth');
    failures++;
  } else {
    log.pass(`${hooks.data.data.length} webhook(s) configurado(s):`);
    for (const h of hooks.data.data) {
      log.info(`  - ${h.url} (${h.status ?? 'unknown'})`);
    }
  }

  log.section('5. Env vars de produção');
  if (WEBHOOK_USER && WEBHOOK_PASS) {
    log.pass('PAGARME_WEBHOOK_USER e PAGARME_WEBHOOK_PASS setados localmente');
    log.warn('→ Confirme que as MESMAS credenciais estão no dashboard PagarMe e no Vercel');
  } else {
    log.warn('PAGARME_WEBHOOK_USER/PASS não setados — webhook aberto (vulnerável). Configure quando puder.');
  }

  console.log();
  if (failures === 0) {
    log.pass(`PRÉ-VOO OK. Pronto pra teste real com cartão.`);
  } else {
    log.fail(`${failures} problema(s) ENCONTRADO(S). Corrigir antes de testar com cliente.`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('✘ Erro inesperado:', err);
  process.exit(1);
});
