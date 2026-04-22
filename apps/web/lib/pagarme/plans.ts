import { pagarme } from './client';
import type { PagarMePlan } from './types';

// Plan IDs are created once and cached — set via env after first creation
const CARD_PLAN_ID = process.env.PAGARME_PLAN_CARD_ID;

export async function getOrCreateCardPlan(): Promise<PagarMePlan> {
  if (CARD_PLAN_ID) {
    return pagarme.get<PagarMePlan>(`/plans/${CARD_PLAN_ID}`);
  }

  // Create plan (run once, then set PAGARME_PLAN_CARD_ID in env)
  return pagarme.post<PagarMePlan>('/plans', {
    name: 'Plano da Ju — Anual Cartão',
    interval: 'year',
    interval_count: 1,
    billing_type: 'prepaid',
    currency: 'BRL',
    items: [
      {
        name: 'Plano da Ju — Acesso Anual',
        quantity: 1,
        pricing_scheme: { scheme_type: 'unit', price: 3490 }, // R$34,90 em centavos
      },
    ],
    payment_methods: ['credit_card'],
  });
}
