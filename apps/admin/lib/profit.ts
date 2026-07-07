import { createAdminClient } from './supabase';
import { META_TAX_RATE } from './meta-ads-quiz';

// Custos unitários (ajustáveis por env) — usados nos custos operacionais do Plano.
const AI_COST_PER_PLAN = Number(process.env.AI_COST_PER_PLAN_BRL ?? '0.85'); // R$ por plano gerado
const SMS_COST_BRL = Number(process.env.ZENVIA_SMS_COST_BRL ?? '0.08');       // R$ por SMS
const PAGARME_FEE_RATE = Number(process.env.PAGARME_FEE_RATE ?? '0.011');     // taxa efetiva (~PIX+cartão)
const YBERA_COMMISSION = Number(process.env.YBERA_COMMISSION_RATE ?? '0.20'); // 20% sobre vendas afiliadas

const META_TOKEN = process.env.META_ADS_QUIZ_TOKEN;
const META_ACCOUNT = process.env.META_ADS_QUIZ_ACCOUNT ?? 'act_306090736984417';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
function monthName(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${MESES[m - 1]} ${y}`;
}

export interface PlanoRow { ym: string; monthName: string; receita: number; anuncios: number; ia: number; sms: number; taxas: number; custos: number; lucro: number; }
export interface GruposRow { ym: string; monthName: string; comissao: number; anuncios: number; lucro: number; }
export interface ProfitReport { plano: PlanoRow[]; grupos: GruposRow[]; metaOk: boolean; }

// Gasto Meta por mês e por tipo (plano/grupos), já com o imposto de 13,68%.
async function metaMonthlySpend(sinceYm: string): Promise<{ data: Record<string, { plano: number; grupos: number }>; ok: boolean }> {
  const out: Record<string, { plano: number; grupos: number }> = {};
  if (!META_TOKEN) return { data: out, ok: false };
  const since = `${sinceYm}-01`;
  const until = new Date().toISOString().slice(0, 10);
  let url: string | null =
    `https://graph.facebook.com/v20.0/${META_ACCOUNT}/insights?level=campaign&fields=campaign_name,spend`
    + `&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}&time_increment=monthly&limit=500&access_token=${META_TOKEN}`;
  try {
    for (let page = 0; url && page < 12; page++) {
      const r = await fetch(url, { next: { revalidate: 3600 } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j: any = await r.json();
      if (!r.ok) return { data: out, ok: false };
      for (const row of (j.data ?? [])) {
        const m = String(row.date_start ?? '').slice(0, 7);
        if (!m) continue;
        const name = String(row.campaign_name ?? '').toLowerCase();
        const type = name.includes('plano') ? 'plano' : name.includes('grupo') ? 'grupos' : null;
        if (!type) continue;
        const spend = parseFloat(row.spend ?? '0') * (1 + META_TAX_RATE);
        out[m] = out[m] ?? { plano: 0, grupos: 0 };
        out[m][type] += spend;
      }
      url = j.paging?.next ?? null;
    }
    return { data: out, ok: true };
  } catch {
    return { data: out, ok: false };
  }
}

export async function getProfitReport(): Promise<ProfitReport> {
  const sb = createAdminClient();
  const dayKey = (iso: string) => iso.slice(0, 10);

  // ── PLANO: receita mensal (pagamentos reais, deduplicados por cliente/dia) ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pays } = await (sb.from('checkout_events') as any)
    .select('email, order_id, amount_cents, created_at')
    .eq('event_type', 'payment_confirmed')
    .order('created_at', { ascending: false })
    .limit(20000);
  const receitaByMonth: Record<string, number> = {};
  const seen = new Set<string>();
  for (const r of (pays ?? [])) {
    const iso = String(r.created_at);
    const m = iso.slice(0, 7);
    const dedupKey = `${String(r.email ?? r.order_id ?? Math.random()).toLowerCase()}_${dayKey(iso)}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    receitaByMonth[m] = (receitaByMonth[m] ?? 0) + (Number(r.amount_cents ?? 0) / 100);
  }

  // ── PLANO: planos gerados por mês (custo de IA) e SMS por mês ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profs } = await (sb.from('profiles') as any)
    .select('plan_requested_at, pix_sms_last_at')
    .limit(50000);
  const plansByMonth: Record<string, number> = {};
  const smsByMonth: Record<string, number> = {};
  for (const p of (profs ?? [])) {
    if (p.plan_requested_at) { const m = String(p.plan_requested_at).slice(0, 7); plansByMonth[m] = (plansByMonth[m] ?? 0) + 1; }
    if (p.pix_sms_last_at) { const m = String(p.pix_sms_last_at).slice(0, 7); smsByMonth[m] = (smsByMonth[m] ?? 0) + 1; }
  }

  const planoMonths = Object.keys(receitaByMonth);
  const sinceYm = planoMonths.length ? planoMonths.sort()[0] : new Date().toISOString().slice(0, 7);
  const meta = await metaMonthlySpend(sinceYm);

  // ── GRUPOS: comissão (vendas afiliadas × 20%) e anúncios, do ybera_monthly_data ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: yb } = await (sb.from('ybera_monthly_data') as any)
    .select('year_month, vendas_afiliadas, anuncios')
    .order('year_month', { ascending: false });

  const plano: PlanoRow[] = Object.keys(receitaByMonth).sort().reverse().map(ym => {
    const receita = receitaByMonth[ym] ?? 0;
    const anuncios = meta.data[ym]?.plano ?? 0;
    const ia = (plansByMonth[ym] ?? 0) * AI_COST_PER_PLAN;
    const sms = (smsByMonth[ym] ?? 0) * SMS_COST_BRL;
    const taxas = receita * PAGARME_FEE_RATE;
    const custos = anuncios + ia + sms + taxas;
    return { ym, monthName: monthName(ym), receita, anuncios, ia, sms, taxas, custos, lucro: receita - custos };
  });

  const grupos: GruposRow[] = (yb ?? []).map((r: { year_month: string; vendas_afiliadas: number | null; anuncios: number | null }) => {
    const comissao = (Number(r.vendas_afiliadas ?? 0)) * YBERA_COMMISSION;
    // Anúncios: prefere o gasto real do Meta (com imposto) quando existe pro mês; senão o manual.
    const anuncios = meta.data[r.year_month]?.grupos ?? Number(r.anuncios ?? 0);
    return { ym: r.year_month, monthName: monthName(r.year_month), comissao, anuncios, lucro: comissao - anuncios };
  });

  return { plano, grupos, metaOk: meta.ok };
}
