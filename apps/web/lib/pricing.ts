/**
 * Preço do Plano da Ju e cálculo de parcelas no CARTÃO com juros (Tabela Price).
 * Fonte única usada tanto no front (exibição) quanto no back (valor cobrado),
 * pra nunca divergir o que a cliente vê do que é cobrado.
 *
 * - À vista (1x) e PIX: R$34,90, SEM juros.
 * - Cartão 2x/3x: COM juros de 2,99% ao mês (parcelamento com juros pro cliente).
 * - Máximo de 3 parcelas.
 * PAGAMENTO ÚNICO (sem mensalidade/recorrência).
 */
export const PLAN_BASE_CENTS = 3490;            // R$34,90 — preço à vista / PIX (pagamento único)
/** Preço "cheio" usado como âncora (riscado) na oferta. */
export const PLAN_ANCHOR_CENTS = 14990;         // R$149,90
/** % de desconto da âncora → preço atual (arredondado). Usado na roleta/oferta. */
export const PLAN_DISCOUNT_PCT = Math.round((1 - PLAN_BASE_CENTS / PLAN_ANCHOR_CENTS) * 100); // 77
export const INSTALLMENT_MONTHLY_RATE = 0.0299; // 2,99% a.m.
export const MAX_INSTALLMENTS = 3;

export interface InstallmentInfo {
  n: number;          // nº de parcelas (1..3)
  perCents: number;   // valor de cada parcela, em centavos
  totalCents: number; // total cobrado (com juros, se houver)
  hasInterest: boolean;
}

/**
 * Calcula a parcela (Tabela Price) pra `n` parcelas. 1x nunca tem juros.
 */
export function installmentInfo(
  n: number,
  baseCents: number = PLAN_BASE_CENTS,
  monthlyRate: number = INSTALLMENT_MONTHLY_RATE,
): InstallmentInfo {
  const clamped = Math.max(1, Math.min(MAX_INSTALLMENTS, Math.floor(n) || 1));
  if (clamped <= 1) {
    return { n: 1, perCents: baseCents, totalCents: baseCents, hasInterest: false };
  }
  const i = monthlyRate;
  // PMT = PV * i / (1 - (1+i)^-n)
  const per = Math.round((baseCents * i) / (1 - Math.pow(1 + i, -clamped)));
  return { n: clamped, perCents: per, totalCents: per * clamped, hasInterest: true };
}

/** Formata centavos como "R$12,33". */
export function brlCents(cents: number): string {
  return `R$${(cents / 100).toFixed(2).replace('.', ',')}`;
}

/** "3x de R$12,33" (com sufixo opcional de juros). */
export function installmentLabel(n: number): string {
  const info = installmentInfo(n);
  return `${info.n}x de ${brlCents(info.perCents)}`;
}

// ── Mercado EUA (brasileiras morando nos Estados Unidos) ──────────────
// Cobrado em DÓLAR via Stripe — a PagarMe só opera em BRL ("The gateway
// Pagar.me just supports currency BRL"), então o funil dos EUA não usa PIX.
export const PLAN_USD_CENTS = 990;            // US$ 9,90 (preço de entrada)
export const PLAN_USD_ANCHOR_CENTS = 4900;    // US$ 49 — âncora (consulta)
/** Formata centavos de dólar: 990 → "$9.90" */
export function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
