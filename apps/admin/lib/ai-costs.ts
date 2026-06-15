/**
 * Custos da IA (OpenRouter) em reais para o dashboard.
 *
 * O OpenRouter já agrega o gasto da chave por dia/semana/mês/total em
 * /api/v1/key, e o saldo da conta em /api/v1/credits. Convertemos USD→BRL com
 * a cotação ao vivo (awesomeapi) e caímos num valor fixo se a cotação falhar.
 * Tudo com timeout curto e tolerante a falha — o dashboard nunca quebra por isso.
 */

export interface AiCosts {
  ok: boolean;
  rate: number;                 // USD → BRL
  rateLabel: string;            // ex: "ao vivo" | "estimada"
  dailyUsd: number;
  monthlyUsd: number;
  totalUsd: number;             // gasto da chave (lifetime)
  limitUsd: number | null;      // limite (diário, normalmente)
  limitRemainingUsd: number | null;
  limitReset: string | null;    // "daily" | "monthly" | ...
  balanceUsd: number | null;    // saldo da conta (créditos - usados)
}

const FALLBACK_RATE = 5.2; // usado só se a cotação ao vivo falhar

async function fetchJson(url: string, init?: RequestInit, timeoutMs = 6000): Promise<any | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { ...init, signal: controller.signal, next: { revalidate: 300 } });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getAiCosts(): Promise<AiCosts> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const empty: AiCosts = {
    ok: false, rate: FALLBACK_RATE, rateLabel: 'estimada',
    dailyUsd: 0, monthlyUsd: 0, totalUsd: 0,
    limitUsd: null, limitRemainingUsd: null, limitReset: null, balanceUsd: null,
  };
  if (!apiKey) return empty;

  const headers = { Authorization: `Bearer ${apiKey}` };
  const [keyData, credits, fx] = await Promise.all([
    fetchJson('https://openrouter.ai/api/v1/key', { headers }),
    fetchJson('https://openrouter.ai/api/v1/credits', { headers }),
    fetchJson('https://economia.awesomeapi.com.br/last/USD-BRL'),
  ]);

  const k = keyData?.data;
  if (!k) return empty;

  let rate = FALLBACK_RATE;
  let rateLabel = 'estimada';
  const bid = parseFloat(fx?.USDBRL?.bid ?? '');
  if (!isNaN(bid) && bid > 0) { rate = bid; rateLabel = 'ao vivo'; }

  const c = credits?.data;
  const balanceUsd = c && typeof c.total_credits === 'number' && typeof c.total_usage === 'number'
    ? Math.max(0, c.total_credits - c.total_usage)
    : null;

  return {
    ok: true,
    rate,
    rateLabel,
    dailyUsd: Number(k.usage_daily ?? 0),
    monthlyUsd: Number(k.usage_monthly ?? 0),
    totalUsd: Number(k.usage ?? 0),
    limitUsd: typeof k.limit === 'number' ? k.limit : null,
    limitRemainingUsd: typeof k.limit_remaining === 'number' ? k.limit_remaining : null,
    limitReset: k.limit_reset ?? null,
    balanceUsd,
  };
}
