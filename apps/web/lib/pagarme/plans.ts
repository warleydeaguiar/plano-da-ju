import { pagarme } from './client';
import type { PagarMePlan } from './types';
import { installmentInfo, MAX_INSTALLMENTS } from '@/lib/pricing';

// Plano trimestral (90 dias) — renova a cada 3 meses.
//
// Agora há UM plano por nº de parcelas (1x, 2x, 3x), cada um com o preço COM
// JUROS daquele parcelamento (Tabela Price 2,99% a.m.). Assim a cobrança e a
// renovação batem exatamente com o que a cliente escolheu. À vista (1x) = sem
// juros. Cache em memória por nº de parcelas.
const cacheByInstallments = new Map<number, PagarMePlan>();

function planName(n: number): string {
  return `Plano da Ju — Trimestral Cartão ${n}x`;
}

function planPayload(n: number) {
  const info = installmentInfo(n);
  return {
    name: planName(n),
    interval: 'month',
    interval_count: 3,
    billing_type: 'prepaid',
    currency: 'BRL',
    statement_descriptor: 'PLANODAJU', // max 13 chars, aparece na fatura
    items: [
      {
        name: 'Plano da Ju — Acesso 90 dias',
        quantity: 1,
        // preço = TOTAL com juros do parcelamento escolhido (PagarMe divide em n)
        pricing_scheme: { scheme_type: 'unit', price: info.totalCents },
      },
    ],
    payment_methods: ['credit_card'],
    // Trava o parcelamento desse plano exatamente em n.
    installments: [n],
  };
}

/**
 * Retorna (ou cria) o plano trimestral do cartão para `installments` parcelas,
 * já com o preço com juros correto.
 */
export async function getOrCreateCardPlan(installments = 1): Promise<PagarMePlan> {
  const n = Math.max(1, Math.min(MAX_INSTALLMENTS, Math.floor(installments) || 1));
  const cached = cacheByInstallments.get(n);
  if (cached) return cached;

  const name = planName(n);

  // 1) Busca por nome (evita criar duplicado em corrida)
  try {
    const list = await pagarme.get<{ data: PagarMePlan[] }>(`/plans?name=${encodeURIComponent(name)}&size=10`);
    const existing = list.data?.find(p => p.name === name && p.status === 'active');
    if (existing) {
      cacheByInstallments.set(n, existing);
      return existing;
    }
  } catch (err) {
    console.error('[pagarme/plans] error searching plans by name:', err);
  }

  // 2) Cria o plano (roda só na primeira compra de cada nº de parcelas)
  console.warn(`[pagarme/plans] creating plan "${name}"`);
  const created = await pagarme.post<PagarMePlan>('/plans', planPayload(n));
  cacheByInstallments.set(n, created);
  return created;
}
