import { PLAN_BASE_CENTS } from '@/lib/pricing';

/**
 * Faixa de gasto mensal com produtos de cabelo (pergunta do quiz).
 *
 * Até 12/10/26 a faixa definia o preço (R$19,90 a R$44,90). Desde 13/10/26 o
 * plano custa R$97 para todas — "de R$197 por R$97" — e a pergunta continua no
 * quiz só como informação sobre a cliente. O preço segue SEMPRE recalculado no
 * servidor (lib/preco-servidor.ts); o navegador nunca manda preço.
 */
export const QUESTAO_GASTO = 'gasto_mensal';

export const FAIXAS_GASTO = [
  { id: 'ate_50',    label: 'Até R$ 50' },
  { id: 'ate_100',   label: 'De R$ 50 a R$ 100' },
  { id: 'ate_300',   label: 'De R$ 100 a R$ 300' },
  { id: 'acima_300', label: 'Mais de R$ 300' },
] as const;

export type FaixaGasto = (typeof FAIXAS_GASTO)[number]['id'];

/** Preço da faixa respondida — hoje o mesmo para todas (e para quem não respondeu). */
export function precoPorResposta(_resposta: unknown): number {
  return PLAN_BASE_CENTS;
}
