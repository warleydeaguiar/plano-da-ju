#!/usr/bin/env node
// Cria (ou acha) o plano trimestral de 90 dias na PagarMe e mostra o ID.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
for (const line of fs.readFileSync(path.join(__dirname,'..','apps','web','.env.local'),'utf8').split('\n')) {
  const l=line.trim(); if(!l||l.startsWith('#'))continue; const i=l.indexOf('='); if(i<0)continue;
  const k=l.slice(0,i).trim(); const v=l.slice(i+1).trim().replace(/^["']|["']$/g,''); if(!process.env[k])process.env[k]=v;
}
const SECRET = process.env.PAGARME_SECRET_KEY;
const H = { 'Content-Type':'application/json', Authorization:`Basic ${Buffer.from(SECRET+':').toString('base64')}` };
const NAME = 'Plano da Ju — Trimestral Cartão';

async function req(method, p, body) {
  const r = await fetch(`https://api.pagar.me/core/v5${p}`, { method, headers:H, body: body?JSON.stringify(body):undefined });
  return { ok:r.ok, status:r.status, data: await r.json().catch(()=>({})) };
}

// 1) Já existe?
const list = await req('GET', `/plans?name=${encodeURIComponent(NAME)}&size=10`);
const existing = list.data?.data?.find(p => p.name === NAME && p.status === 'active');
if (existing) {
  console.log('Plano trimestral JÁ existe:');
  console.log('  id:', existing.id, '| interval:', existing.interval, existing.interval_count, '| installments:', JSON.stringify(existing.installments));
  process.exit(0);
}

// 2) Cria
console.log('Criando plano trimestral...');
const created = await req('POST', '/plans', {
  name: NAME, interval: 'month', interval_count: 3, billing_type: 'prepaid', currency: 'BRL',
  statement_descriptor: 'PLANODAJU',
  items: [{ name: 'Plano da Ju — Acesso 90 dias', quantity: 1, pricing_scheme: { scheme_type: 'unit', price: 3490 } }],
  payment_methods: ['credit_card'], installments: [1,2,3,4],
});
if (!created.ok) { console.error('✘ Falha:', created.status, JSON.stringify(created.data)); process.exit(1); }
console.log('✓ Criado:');
console.log('  id:', created.data.id);
console.log('  interval:', created.data.interval, created.data.interval_count);
console.log('  installments:', JSON.stringify(created.data.installments));
console.log('  statement_descriptor:', created.data.statement_descriptor);
console.log('\n→ Defina no Vercel (web): PAGARME_PLAN_CARD_ID=' + created.data.id);
