import { pagarme } from './client';
import type { PagarMePlan } from './types';

// Cache em memória — primeira chamada faz lookup/create, demais retornam cached
let cached: PagarMePlan | null = null;

const PLAN_NAME = 'Plano da Ju — Anual Cartão';
const PLAN_PAYLOAD = {
  name: PLAN_NAME,
  interval: 'year',
  interval_count: 1,
  billing_type: 'prepaid',
  currency: 'BRL',
  statement_descriptor: 'PLANODAJU', // max 13 chars, aparece na fatura
  items: [
    {
      name: 'Plano da Ju — Acesso Anual',
      quantity: 1,
      pricing_scheme: { scheme_type: 'unit', price: 3490 },
    },
  ],
  payment_methods: ['credit_card'],
};

export async function getOrCreateCardPlan(): Promise<PagarMePlan> {
  if (cached) return cached;

  // 1) Preferred: env var aponta direto pro plano
  const envId = process.env.PAGARME_PLAN_CARD_ID;
  if (envId) {
    cached = await pagarme.get<PagarMePlan>(`/plans/${envId}`);
    return cached;
  }

  // 2) Fallback: busca por nome (evita criar duplicado em race)
  try {
    const list = await pagarme.get<{ data: PagarMePlan[] }>(`/plans?name=${encodeURIComponent(PLAN_NAME)}&size=10`);
    const existing = list.data?.find(p => p.name === PLAN_NAME && p.status === 'active');
    if (existing) {
      console.warn(`[pagarme/plans] using plan found by name (id=${existing.id}) — please set PAGARME_PLAN_CARD_ID env var`);
      cached = existing;
      return cached;
    }
  } catch (err) {
    console.error('[pagarme/plans] error searching plans by name:', err);
  }

  // 3) Last resort: cria novo plano (deveria rodar só na primeira compra de todas)
  console.warn('[pagarme/plans] creating new plan — please set PAGARME_PLAN_CARD_ID env var after first run');
  cached = await pagarme.post<PagarMePlan>('/plans', PLAN_PAYLOAD);
  return cached;
}
