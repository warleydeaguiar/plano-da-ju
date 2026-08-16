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

export interface YberaTrendPoint { ym: string; label: string; buyers: number; conversion: number; revenue: number; base: number; }
export interface ClickFunnelDay { day: string; clickers: number; buyers: number; clicks: number; }
/** Vendas na Ybera feitas por clientes do plano capilar, por dia. */
export interface StudentSalesDay { day: string; revenue: number; orders: number; buyers: number; }
export interface YberaDashboardData {
  trend: YberaTrendPoint[];       // conversão de alunas por mês (últimos 12)
  activeCount: number;
  funnel: ClickFunnelDay[];       // cliques em produto do plano × conversão, por dia (14d)
  totalClickers: number;          // clientes distintos que clicaram (janela)
  totalBuyers: number;            // desses, quantos compraram na Ybera
  buyRate: number;                // totalBuyers / totalClickers
  totalClicks: number;
  studentSales: StudentSalesDay[];   // faturamento/dia só das alunas do plano (14d)
  studentSalesTotal: number;         // soma do período
  studentOrdersTotal: number;        // nº de pedidos no período
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
    .select('id, email, phone, full_name, subscription_status, created_at, subscription_activated_at').limit(100000);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allProfiles = (profRows ?? []) as (MatchProfile & { subscription_activated_at: string | null })[];
  const activeProfiles = allProfiles.filter(p => p.subscription_status === 'active');
  const activeCount = activeProfiles.length;

  // Quantas alunas JÁ EXISTIAM em cada mês (ativações acumuladas até o fim do mês).
  // Antes dividíamos todo mês pela base de HOJE — o que achatava os meses antigos
  // (jun/26 tinha 757 alunas, não 2.9k) e criava meses "0%" de quando o produto
  // nem existia. A base do mês é o denominador correto.
  const activationMonths = activeProfiles
    .map(p => (p.subscription_activated_at ? p.subscription_activated_at.slice(0, 7) : null))
    .filter((k): k is string => !!k)
    .sort();
  const baseAtMonth = (k: string) => activationMonths.filter(m => m <= k).length;

  // ── Tendência mensal: conversão das alunas ativas (compraram no mês ÷ base do mês) ──
  const monthSet = Array.from(new Set(orders.map(o => ym(o.register_date)).filter(k => k !== '—'))).sort();
  const ordersByMonth = new Map<string, MatchOrder[]>();
  for (const o of orders) { const k = ym(o.register_date); if (k === '—') continue; const arr = ordersByMonth.get(k) ?? []; arr.push(o); ordersByMonth.set(k, arr); }
  const trend: YberaTrendPoint[] = monthSet
    // Sem base naquele mês = o produto ainda não existia → não é "0% de conversão",
    // é "não se aplica". Mostrar esses meses só polui o gráfico.
    .filter(k => baseAtMonth(k) > 0)
    .map(k => {
      const base = baseAtMonth(k);
      const matches = matchOrdersToProfiles(ordersByMonth.get(k) ?? [], activeProfiles);
      const buyers = matches.filter(m => m.bought);
      const revenue = buyers.reduce((s, m) => s + m.totalSpent, 0);
      return { ym: k, label: ymLabel(k), buyers: buyers.length, conversion: base ? buyers.length / base : 0, revenue, base };
    }).slice(-12);

  // ── Vendas por dia FEITAS PELAS ALUNAS do plano (últimos 14 dias) ──
  // Índice inverso: chave (email/telefone) da aluna → serve pra dizer se um pedido
  // da Ybera veio de alguém que é cliente do plano capilar.
  const studentKeys = new Set<string>();
  for (const p of activeProfiles) {
    const e = normEmail(p.email); if (e) studentKeys.add(e);
    const ph = normPhoneKey(p.phone); if (ph) studentKeys.add('tel:' + ph);
  }
  const isStudentOrder = (o: MatchOrder): boolean => {
    const e = normEmail(o.customer_email); if (e && studentKeys.has(e)) return true;
    const ph = normPhoneKey(o.customer_phone); if (ph && studentKeys.has('tel:' + ph)) return true;
    return false;
  };
  const brDayOf = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
  const salesByDay = new Map<string, { revenue: number; orders: number; buyers: Set<string> }>();
  const since14ms = Date.now() - 14 * 86400000;
  for (const o of orders) {
    if (!o.register_date) continue;
    if (new Date(o.register_date).getTime() < since14ms) continue;
    if (!isStudentOrder(o)) continue;
    const d = brDayOf(o.register_date);
    const rec = salesByDay.get(d) ?? { revenue: 0, orders: 0, buyers: new Set<string>() };
    rec.revenue += Number(o.subtotal ?? 0);
    rec.orders += 1;
    const key = normEmail(o.customer_email) || 'tel:' + normPhoneKey(o.customer_phone);
    if (key) rec.buyers.add(key);
    salesByDay.set(d, rec);
  }
  const studentSales: StudentSalesDay[] = Array.from({ length: 14 }, (_, i) => {
    const dt = new Date(Date.now() - (13 - i) * 86400000);
    const key = brDayOf(dt.toISOString());
    const rec = salesByDay.get(key);
    const [, m, dd] = key.split('-');
    return { day: `${dd}/${m}`, revenue: rec?.revenue ?? 0, orders: rec?.orders ?? 0, buyers: rec?.buyers.size ?? 0 };
  });
  const studentSalesTotal = studentSales.reduce((s, d) => s + d.revenue, 0);
  const studentOrdersTotal = studentSales.reduce((s, d) => s + d.orders, 0);

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
    studentSales, studentSalesTotal, studentOrdersTotal,
  };
}
