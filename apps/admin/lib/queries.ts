/**
 * Server-side queries para dados do painel admin.
 *
 * Todas usam service-role; só chame de Server Components / Route Handlers.
 */

import { createAdminClient } from './supabase';

export interface DashboardStats {
  activeSubscribers: number;
  pendingPlans: number;
  monthlyRevenueBrl: number;
  todayCheckIns: number;
  newSubscribersThisWeek: number;
  cancellationsThisWeek: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const sb = createAdminClient();

  // Sempre em horário de Brasília (UTC-3) — antes usava local time (UTC no Vercel),
  // o que fazia "hoje" e "este mês" baterem em dias diferentes em outras métricas.
  const BR_OFFSET = 3 * 60 * 60 * 1000;
  const nowBR = new Date(Date.now() - BR_OFFSET);
  const yyyy = nowBR.getUTCFullYear();
  const mm = String(nowBR.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(nowBR.getUTCDate()).padStart(2, '0');
  const todayStart = new Date(`${yyyy}-${mm}-${dd}T03:00:00.000Z`); // BR 00:00 = 03:00 UTC
  const monthStart = new Date(`${yyyy}-${mm}-01T03:00:00.000Z`);    // BR 1º do mês 00:00
  const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 86400000).toISOString();

  const [active, activeProfiles, plansData, weekActivations, weekRefunds, todayCk, paymentsThisMonth] = await Promise.all([
    // 1) Total ativas
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('profiles') as any)
      .select('*', { count: 'exact', head: true })
      .eq('subscription_status', 'active'),

    // 2) Lista de IDs ativos (pra cruzar com hair_plans)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('profiles') as any)
      .select('id')
      .eq('subscription_status', 'active'),

    // 3) hair_plans semana 1 das ativas
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('hair_plans') as any)
      .select('user_id,approved_by_juliane')
      .eq('week_number', 1),

    // 4) Novas ativações (uso subscription_activated_at — refletindo ativação real, não cadastro)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('profiles') as any)
      .select('*', { count: 'exact', head: true })
      .eq('subscription_status', 'active')
      .gte('subscription_activated_at', sevenDaysAgo),

    // 5) Reembolsos esta semana (campo dedicado, não confiar em updated_at)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('profiles') as any)
      .select('*', { count: 'exact', head: true })
      .eq('subscription_status', 'refunded')
      .gte('refunded_at', sevenDaysAgo),

    // 6) Check-ins hoje
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('check_ins') as any)
      .select('*', { count: 'exact', head: true })
      .gte('checked_at', todayStart.toISOString()),

    // 7) Pagamentos confirmados neste mês (dedupe por order_id pois webhook duplica order.paid + charge.paid)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('checkout_events') as any)
      .select('order_id,amount_cents')
      .eq('event_type', 'payment_confirmed')
      .gte('created_at', monthStart.toISOString()),
  ]);

  const activeCount = active.count ?? 0;
  const activeIds = new Set(((activeProfiles.data ?? []) as Array<{ id: string }>).map(p => p.id));
  const plans = (plansData.data ?? []) as Array<{ user_id: string; approved_by_juliane: boolean }>;

  // "Planos pra revisar" = ativas SEM plano + ativas COM plano não aprovado
  const usersWithPlan = new Set(plans.map(p => p.user_id));
  const activeWithoutPlan = [...activeIds].filter(id => !usersWithPlan.has(id)).length;
  const plansNotApproved = plans.filter(p => activeIds.has(p.user_id) && !p.approved_by_juliane).length;
  const pendingPlansCount = activeWithoutPlan + plansNotApproved;

  // Receita do mês: soma pagamentos únicos por order_id
  const dedupedOrders = new Map<string, number>();
  for (const e of (paymentsThisMonth.data ?? []) as Array<{ order_id: string | null; amount_cents: number | null }>) {
    const key = e.order_id ?? Math.random().toString(36); // se não tem order_id, conta como único
    if (!dedupedOrders.has(key)) dedupedOrders.set(key, e.amount_cents ?? 0);
  }
  const monthlyRevenueCents = Array.from(dedupedOrders.values()).reduce((a, b) => a + b, 0);
  const monthlyRevenueBrl = Math.round(monthlyRevenueCents / 100);

  return {
    activeSubscribers: activeCount,
    pendingPlans: pendingPlansCount,
    monthlyRevenueBrl,
    todayCheckIns: todayCk.count ?? 0,
    newSubscribersThisWeek: weekActivations.count ?? 0,
    cancellationsThisWeek: weekRefunds.count ?? 0,
  };
}

export interface PlanRow {
  user_id: string;
  full_name: string | null;
  email: string;
  hair_type: string | null;
  approved_by_juliane: boolean;
  created_at: string;
  juliane_notes: string | null;
  /** Pedido de ajuste enviado pela cliente (quando plan_status='revision_requested'). */
  revision_message?: string | null;
  /** Prazo (2 dias úteis) pra responder o pedido de revisão. */
  revision_due_at?: string | null;
}

export async function getPendingPlans(limit = 8): Promise<PlanRow[]> {
  const sb = createAdminClient();

  // FONTE DA VERDADE = plan_feedback com status='open' (pedido de ajuste da
  // cliente). Antes isso dependia de profiles.plan_status='revision_requested',
  // que se perdia se o status voltasse pra 'ready' (cron de entrega, regeneração,
  // aprovação). Lendo do plan_feedback, o pedido NUNCA some até ser resolvido.
  // Mais antigos primeiro (prazo de 2 dias úteis correndo).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: fb } = await (sb.from('plan_feedback') as any)
    .select('user_id,message,due_at,created_at')
    .eq('status', 'open')
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(limit);

  if (!fb?.length) return [];

  // Mantém só o pedido aberto mais recente por cliente.
  const byUser = new Map<string, { message: string | null; due_at: string | null; created_at: string }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const f of fb as any[]) {
    if (!byUser.has(f.user_id)) byUser.set(f.user_id, { message: f.message ?? null, due_at: f.due_at ?? null, created_at: f.created_at });
  }
  const userIds = [...byUser.keys()];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profs } = await (sb.from('profiles') as any)
    .select('id,full_name,email,hair_type,subscription_activated_at,created_at')
    .in('id', userIds);
  const profMap = new Map<string, { full_name: string | null; email: string; hair_type: string | null; subscription_activated_at: string | null; created_at: string }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const p of (profs ?? []) as any[]) profMap.set(p.id, p);

  return userIds.map(uid => {
    const f = byUser.get(uid)!;
    const p = profMap.get(uid);
    return {
      user_id: uid,
      full_name: p?.full_name ?? null,
      email: p?.email ?? '',
      hair_type: p?.hair_type ?? null,
      approved_by_juliane: false,
      created_at: p?.subscription_activated_at ?? p?.created_at ?? f.created_at,
      juliane_notes: null,
      revision_message: f.message,
      revision_due_at: f.due_at,
    };
  });
}

export interface RecentCheckIn {
  id: string;
  user_id: string;
  full_name: string | null;
  hair_feel: string | null;
  checked_at: string;
}

export async function getRecentCheckIns(limit = 6): Promise<RecentCheckIn[]> {
  const sb = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb.from('check_ins') as any)
    .select('id,user_id,hair_feel,checked_at')
    .order('checked_at', { ascending: false })
    .limit(limit);

  if (!data?.length) return [];

  const userIds = (data as Array<{ user_id: string }>).map(c => c.user_id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profs } = await (sb.from('profiles') as any)
    .select('id,full_name')
    .in('id', userIds);

  const profMap = new Map(
    (profs as Array<{ id: string; full_name: string | null }>)?.map(p => [p.id, p]) ?? [],
  );

  return (data as Array<{
    id: string;
    user_id: string;
    hair_feel: string | null;
    checked_at: string;
  }>).map(c => ({
    id: c.id,
    user_id: c.user_id,
    full_name: profMap.get(c.user_id)?.full_name ?? null,
    hair_feel: c.hair_feel,
    checked_at: c.checked_at,
  }));
}

export async function getNewPlansByDay(): Promise<Array<{ day: string; count: number; isToday: boolean }>> {
  // Renomeado conceitualmente: agora retorna VENDAS por dia (era planos, mas a IA
  // não está gerando consistentemente — vendas é a métrica mais real pra Juliane).
  const sb = createAdminClient();

  // IMPORTANTE: agrupar por dia em HORÁRIO DE BRASÍLIA (UTC-3), igual aos cards
  // "Receita hoje" do dashboard. Antes agrupava por data UTC e divergia (uma venda
  // entre 00h–03h UTC caía em dias diferentes nos dois lugares).
  const BR_OFFSET = 3 * 60 * 60 * 1000;
  const nowBR = new Date(Date.now() - BR_OFFSET);

  // Busca uma janela folgada (8 dias) e bucketiza por data BR no JS.
  const sinceUtc = new Date(Date.now() - 8 * 86400000).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb.from('profiles') as any)
    .select('subscription_activated_at')
    .eq('subscription_status', 'active')
    // exclui gift/cortesia — não deve inflar faturamento (NULL-safe)
    .or('is_gift.is.null,is_gift.eq.false')
    .gte('subscription_activated_at', sinceUtc);

  // data BR (YYYY-MM-DD) de um timestamp
  const brDateKey = (ts: string) => new Date(new Date(ts).getTime() - BR_OFFSET).toISOString().slice(0, 10);

  const days: Array<{ day: string; count: number; isToday: boolean }> = [];
  const dayLetters = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  for (let i = 6; i >= 0; i--) {
    const dayBR = new Date(nowBR.getTime() - i * 86400000);
    const key = dayBR.toISOString().slice(0, 10);
    const isToday = i === 0;
    const count =
      ((data as Array<{ subscription_activated_at: string | null }>) ?? []).filter(
        r => r.subscription_activated_at != null && brDateKey(r.subscription_activated_at) === key,
      ).length;
    days.push({
      day: isToday ? 'Hoje' : dayLetters[new Date(key + 'T12:00:00Z').getUTCDay()],
      count,
      isToday,
    });
  }
  return days;
}

// ── VENDAS / RECEITA FIÉIS (100% Pagar.me) ────────────────────────────────────
// Fonte única da verdade: checkout_events 'payment_confirmed' (amount_cents = valor
// REAL cobrado). Dedup por (cliente, dia BR) → colapsa as duplicatas que o webhook
// grava (order.paid + charge.paid) e usa o MENOR valor do grupo = preço-base/com
// desconto, SEM os juros da parcela do cartão (que vão pra adquirente, não pra nós).
// Cortesias/parcerias NÃO entram (não têm pagamento). Respeita descontos dos funis.
export interface RealSalesBucket { count: number; cents: number }
export interface RealSales {
  today: RealSalesBucket;
  yesterday: RealSalesBucket;
  month: RealSalesBucket;
  byDay: Array<{ day: string; count: number; revenueCents: number; isToday: boolean }>;
}

export async function getRealSales(): Promise<RealSales> {
  const sb = createAdminClient();
  const brDay = (ts: string | number | Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ts));
  const todayKey = brDay(Date.now());
  const yKey = brDay(Date.now() - 86400000);
  const monthKey = todayKey.slice(0, 7);
  const monthStartUtc = new Date(`${monthKey}-01T03:00:00.000Z`).getTime(); // BR 00:00
  const sinceISO = new Date(Math.min(monthStartUtc, Date.now() - 8 * 86400000)).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb.from('checkout_events') as any)
    .select('email, order_id, amount_cents, created_at')
    .eq('event_type', 'payment_confirmed')
    .gte('created_at', sinceISO)
    .limit(50000);

  const sale = new Map<string, { cents: number; day: string }>();
  for (const r of ((data ?? []) as Array<{ email: string | null; order_id: string | null; amount_cents: number | null; created_at: string }>)) {
    const day = brDay(r.created_at);
    const id = String(r.email ?? r.order_id ?? `_${day}_${Math.random()}`).toLowerCase();
    const key = `${id}|${day}`;
    const cents = r.amount_cents ?? 0;
    const cur = sale.get(key);
    if (!cur) sale.set(key, { cents, day });
    else if (cents < cur.cents) cur.cents = cents;
  }

  const buckets: { today: RealSalesBucket; yesterday: RealSalesBucket; month: RealSalesBucket } = {
    today: { count: 0, cents: 0 }, yesterday: { count: 0, cents: 0 }, month: { count: 0, cents: 0 },
  };
  for (const s of sale.values()) {
    if (s.day.slice(0, 7) === monthKey) { buckets.month.count++; buckets.month.cents += s.cents; }
    if (s.day === todayKey) { buckets.today.count++; buckets.today.cents += s.cents; }
    else if (s.day === yKey) { buckets.yesterday.count++; buckets.yesterday.cents += s.cents; }
  }

  const dayLetters = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const byDay: RealSales['byDay'] = [];
  for (let i = 6; i >= 0; i--) {
    const dKey = brDay(Date.now() - i * 86400000);
    let count = 0, cents = 0;
    for (const s of sale.values()) if (s.day === dKey) { count++; cents += s.cents; }
    byDay.push({ day: i === 0 ? 'Hoje' : dayLetters[new Date(dKey + 'T12:00:00Z').getUTCDay()], count, revenueCents: cents, isToday: i === 0 });
  }
  return { ...buckets, byDay };
}

export interface AdminPlanDetail {
  user: {
    id: string;
    full_name: string | null;
    email: string;
    hair_type: string | null;
    porosity: string | null;
    main_problems: string[] | null;
  };
  plans: Array<{
    week_number: number;
    focus: string;
    tasks: unknown;
    products: string[];
    tips: string[];
    approved_by_juliane: boolean;
    juliane_notes: string | null;
  }>;
}

export async function getPlanDetail(userId: string): Promise<AdminPlanDetail | null> {
  const sb = createAdminClient();

  const [profileRes, plansRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('profiles') as any)
      .select('id,full_name,email,hair_type,porosity,main_problems')
      .eq('id', userId)
      .maybeSingle(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('hair_plans') as any)
      .select('week_number,focus,tasks,products,tips,approved_by_juliane,juliane_notes')
      .eq('user_id', userId)
      .order('week_number'),
  ]);

  if (!profileRes.data) return null;

  return {
    user: profileRes.data,
    plans: plansRes.data ?? [],
  };
}

// ── Conversão de PIX (checkout_events) ─────────────────────────────
export type PixStats = {
  generated: number;   // pix_generated
  paid: number;        // payment_confirmed (pix)
  rate: number;        // % pagos / gerados (cap 100)
  generated7: number;
  paid7: number;
  rate7: number;
};

export async function getPixStats(): Promise<PixStats> {
  const sb = createAdminClient();
  const since7 = new Date(Date.now() - 7 * 86400000).toISOString();

  // Contamos CLIENTES DISTINTOS (por email), não eventos crus. Motivo: o webhook
  // grava payment_confirmed em order.paid E charge.paid (ids diferentes), e o
  // cliente pode regerar o QR (vários pix_generated). Contar evento cru inflava
  // os "pagos" (ex.: 108 eventos p/ 66 pessoas) → conversão estourava 100%.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [genRows, paidRows] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('checkout_events') as any).select('email, created_at').eq('event_type', 'pix_generated').not('email', 'is', null).limit(50000),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('checkout_events') as any).select('email, created_at').eq('event_type', 'payment_confirmed').eq('payment_type', 'pix').not('email', 'is', null).limit(50000),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const distinct = (rows: { data: any[] | null }, sinceIso?: string): number => {
    const s = new Set<string>();
    for (const r of rows.data ?? []) {
      if (sinceIso && (r.created_at ?? '') < sinceIso) continue;
      const e = (r.email ?? '').toLowerCase().trim();
      if (e) s.add(e);
    }
    return s.size;
  };

  const generated  = distinct(genRows);
  const paidN      = distinct(paidRows);
  const generated7 = distinct(genRows, since7);
  const paid7      = distinct(paidRows, since7);
  const pct = (p: number, g: number) => (g > 0 ? Math.min(100, Math.round((p / g) * 100)) : 0);

  return {
    generated, paid: paidN, rate: pct(paidN, generated),
    generated7, paid7, rate7: pct(paid7, generated7),
  };
}
