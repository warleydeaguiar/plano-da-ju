import { createAdminClient } from '@/lib/supabase';
import {
  matchOrdersToProfiles, normEmail, normPhoneKey,
  type MatchOrder, type MatchProfile,
} from '@/lib/ybera-match';

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const ymLabel = (ym: string) => { const [y, m] = ym.split('-'); return `${MES[Number(m) - 1]}/${y.slice(2)}`; };
const ym = (iso: string | null) => (iso ? iso.slice(0, 7) : '—');

async function loadAllOrders(sb: ReturnType<typeof createAdminClient>): Promise<MatchOrder[]> {
  const out: MatchOrder[] = [];
  for (let page = 0; page < 50; page++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.from('ybera_orders') as any)
      .select('id, subtotal, total, register_date, customer_email, customer_phone, customer_name, products')
      .order('register_date', { ascending: true })
      .range(page * 1000, page * 1000 + 999);
    if (error || !data || data.length === 0) break;
    out.push(...(data as MatchOrder[]));
    if (data.length < 1000) break;
  }
  return out;
}

export interface YberaTrendPoint { ym: string; label: string; buyers: number; conversion: number; revenue: number; }
export interface ClickFunnelDay { day: string; clickers: number; buyers: number; clicks: number; }
export interface YberaDashboardData {
  trend: YberaTrendPoint[];       // conversão de alunas por mês (últimos 12)
  activeCount: number;
  funnel: ClickFunnelDay[];       // cliques em produto do plano × conversão, por dia (14d)
  totalClickers: number;          // clientes distintos que clicaram (janela)
  totalBuyers: number;            // desses, quantos compraram na Ybera
  buyRate: number;                // totalBuyers / totalClickers
  totalClicks: number;
}

/**
 * Computa os dois gráficos de conversão Ybera do dashboard, carregando pedidos +
 * perfis uma vez só. Reaproveita o matching (email/telefone) do módulo ybera-match.
 */
export async function getYberaDashboard(): Promise<YberaDashboardData> {
  const sb = createAdminClient();
  const orders = await loadAllOrders(sb);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profRows } = await (sb.from('profiles') as any)
    .select('id, email, phone, full_name, subscription_status, created_at').limit(100000);
  const allProfiles = (profRows ?? []) as MatchProfile[];
  const activeProfiles = allProfiles.filter(p => p.subscription_status === 'active');
  const activeCount = activeProfiles.length;

  // ── Tendência mensal: conversão das alunas ativas (compraram no mês ÷ base ativa) ──
  const monthSet = Array.from(new Set(orders.map(o => ym(o.register_date)).filter(k => k !== '—'))).sort();
  const ordersByMonth = new Map<string, MatchOrder[]>();
  for (const o of orders) { const k = ym(o.register_date); if (k === '—') continue; const arr = ordersByMonth.get(k) ?? []; arr.push(o); ordersByMonth.set(k, arr); }
  const trend: YberaTrendPoint[] = monthSet.map(k => {
    const matches = matchOrdersToProfiles(ordersByMonth.get(k) ?? [], activeProfiles);
    const buyers = matches.filter(m => m.bought);
    const revenue = buyers.reduce((s, m) => s + m.totalSpent, 0);
    return { ym: k, label: ymLabel(k), buyers: buyers.length, conversion: activeCount ? buyers.length / activeCount : 0, revenue };
  }).slice(-12);

  // ── Funil diário: cliques em produto do plano × quem comprou na Ybera ──
  // Conjunto de "chaves compradoras" (email/telefone que aparece em algum pedido Ybera).
  const buyerKeys = new Set<string>();
  for (const o of orders) {
    const e = normEmail(o.customer_email); if (e) buyerKeys.add(e);
    const p = normPhoneKey(o.customer_phone); if (p) buyerKeys.add('tel:' + p);
  }
  const profById = new Map(allProfiles.map(p => [p.id, p]));
  const isBuyer = (userId: string | null): boolean => {
    if (!userId) return false;
    const p = profById.get(userId);
    if (!p) return false;
    const e = normEmail(p.email); if (e && buyerKeys.has(e)) return true;
    const ph = normPhoneKey(p.phone); if (ph && buyerKeys.has('tel:' + ph)) return true;
    return false;
  };

  // Cliques dos últimos 14 dias
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sinceISO = new Date(Date.now() - 14 * 86400000).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: clickRows } = await (sb.from('plan_product_clicks') as any)
    .select('user_id, created_at').gte('created_at', sinceISO).limit(100000);
  const clicks = (clickRows ?? []) as { user_id: string | null; created_at: string }[];

  const brDay = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
  const byDay = new Map<string, { clickers: Set<string>; buyers: Set<string>; clicks: number }>();
  const allClickers = new Set<string>();
  const allBuyerClickers = new Set<string>();
  let totalClicks = 0;
  for (const c of clicks) {
    const d = brDay(c.created_at);
    const rec = byDay.get(d) ?? { clickers: new Set<string>(), buyers: new Set<string>(), clicks: 0 };
    rec.clicks++; totalClicks++;
    if (c.user_id) {
      rec.clickers.add(c.user_id);
      allClickers.add(c.user_id);
      if (isBuyer(c.user_id)) { rec.buyers.add(c.user_id); allBuyerClickers.add(c.user_id); }
    }
    byDay.set(d, rec);
  }

  // Série contínua dos últimos 14 dias (preenche dias sem clique)
  const funnel: ClickFunnelDay[] = Array.from({ length: 14 }, (_, i) => {
    const dt = new Date(Date.now() - (13 - i) * 86400000);
    const key = brDay(dt.toISOString());
    const rec = byDay.get(key);
    const [, m, dd] = key.split('-');
    return { day: `${dd}/${m}`, clickers: rec?.clickers.size ?? 0, buyers: rec?.buyers.size ?? 0, clicks: rec?.clicks ?? 0 };
  });

  return {
    trend, activeCount, funnel,
    totalClickers: allClickers.size,
    totalBuyers: allBuyerClickers.size,
    buyRate: allClickers.size ? allBuyerClickers.size / allClickers.size : 0,
    totalClicks,
  };
}
