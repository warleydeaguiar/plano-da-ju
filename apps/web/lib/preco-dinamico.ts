import { PLAN_BASE_CENTS } from '@/lib/pricing';

/**
 * Preço do plano por faixa de gasto mensal com produtos de cabelo.
 *
 * Quem já gasta R$300 por mês em produto enxerga R$44,90 como barato; quem
 * gasta R$40 não. O preço passa a acompanhar isso, em vez de ser um número só
 * para todo mundo. A faixa vem da resposta do quiz — declarada pela própria
 * cliente — e o valor é SEMPRE recalculado no servidor a partir do banco
 * (ver lib/preco-servidor.ts). O navegador nunca manda preço.
 *
 * ⚠️ Os cortes mudaram em 19/09/26. Na primeira versão (até R$100 / 300 / 600 /
 * 1.000) as respostas ficaram empilhadas embaixo: 63% marcaram "até R$100" e
 * 30% "até R$300" — só 6% caíam nas duas faixas de cima. Ou seja: quase todo
 * mundo pagava o topo da tabela que existia (R$34,90) e não havia nada abaixo
 * disso. Os cortes novos (50 / 100 / 300) abrem espaço embaixo, com R$29,90
 * para quem gasta pouco, e o teto passa a ser R$44,90.
 *
 * A âncora riscada continua fixa em R$149,90 para todas.
 */
export const QUESTAO_GASTO = 'gasto_mensal';

export const FAIXAS_GASTO = [
  { id: 'ate_50',    label: 'Até R$ 50',            precoCents: 2990 },
  { id: 'ate_100',   label: 'De R$ 50 a R$ 100',    precoCents: 3490 },
  { id: 'ate_300',   label: 'De R$ 100 a R$ 300',   precoCents: 3990 },
  { id: 'acima_300', label: 'Mais de R$ 300',       precoCents: 4490 },
] as const;

export type FaixaGasto = (typeof FAIXAS_GASTO)[number]['id'];

/**
 * Faixas que saíram do ar mas continuam gravadas em respostas antigas. Sem
 * isso, quem respondeu antes da mudança cairia no preço padrão.
 */
const LEGADO: Record<string, number> = {
  ate_600: 4490,   // era R$44,90 — segue no teto novo
  ate_1000: 4490,  // era R$49,90 — o teto agora é 44,90
};

/** Preço da faixa respondida. Sem resposta reconhecida, o preço de sempre. */
export function precoPorResposta(resposta: unknown): number {
  const id = String((Array.isArray(resposta) ? resposta[0] : resposta) ?? '');
  return FAIXAS_GASTO.find((f) => f.id === id)?.precoCents ?? LEGADO[id] ?? PLAN_BASE_CENTS;
}
