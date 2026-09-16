import { PLAN_BASE_CENTS } from '@/lib/pricing';

/**
 * Preço do plano por faixa de gasto mensal com produtos de cabelo.
 *
 * Quem já gasta R$600 por mês em produto enxerga R$44,90 como barato; quem
 * gasta R$100 não. O preço passa a acompanhar isso, em vez de ser um número só
 * para todo mundo. A faixa vem da resposta do quiz — declarada pela própria
 * cliente — e o valor é SEMPRE recalculado no servidor a partir do banco
 * (ver lib/preco-servidor.ts). O navegador nunca manda preço.
 *
 * A âncora riscada continua fixa em R$149,90 para todas.
 */
export const QUESTAO_GASTO = 'gasto_mensal';

export const FAIXAS_GASTO = [
  { id: 'ate_100',  label: 'Até R$ 100',   precoCents: 3490 },
  { id: 'ate_300',  label: 'Até R$ 300',   precoCents: 3990 },
  { id: 'ate_600',  label: 'Até R$ 600',   precoCents: 4490 },
  { id: 'ate_1000', label: 'Até R$ 1.000', precoCents: 4990 },
] as const;

export type FaixaGasto = (typeof FAIXAS_GASTO)[number]['id'];

/** Preço da faixa respondida. Sem resposta reconhecida, o preço de sempre. */
export function precoPorResposta(resposta: unknown): number {
  const id = Array.isArray(resposta) ? resposta[0] : resposta;
  return FAIXAS_GASTO.find((f) => f.id === String(id ?? ''))?.precoCents ?? PLAN_BASE_CENTS;
}
