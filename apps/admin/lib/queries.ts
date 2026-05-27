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

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  // 1º dia do mês corrente
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

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
}

export async function getPendingPlans(limit = 8): Promise<PlanRow[]> {
  const sb = createAdminClient();

  // 1) Pega todas as ativas — qualquer uma pode estar precisando de revisão
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profs } = await (sb.from('profiles') as any)
    .select('id,full_name,email,hair_type,subscription_activated_at,created_at')
    .eq('subscription_status', 'active')
    .order('subscription_activated_at', { ascending: false, nullsFirst: false });

  if (!profs?.length) return [];

  const activeProfiles = profs as Array<{
    id: string; full_name: string | null; email: string; hair_type: string | null;
    subscription_activated_at: string | null; created_at: string;
  }>;

  // 2) Hair plans semana 1 dessas ativas
  const userIds = activeProfiles.map(p => p.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: plans } = await (sb.from('hair_plans') as any)
    .select('user_id,approved_by_juliane,created_at,juliane_notes')
    .eq('week_number', 1)
    .in('user_id', userIds);

  const planMap = new Map(
    (plans as Array<{ user_id: string; approved_by_juliane: boolean; created_at: string; juliane_notes: string | null }>)
      ?.map(p => [p.user_id, p]) ?? [],
  );

  // 3) Cards para revisão: ativas COM plano não aprovado primeiro, depois ativas SEM plano (aguardando IA)
  const cards: PlanRow[] = activeProfiles.map(prof => {
    const plan = planMap.get(prof.id);
    return {
      user_id: prof.id,
      full_name: prof.full_name,
      email: prof.email,
      hair_type: prof.hair_type,
      approved_by_juliane: plan?.approved_by_juliane ?? false,
      created_at: plan?.created_at ?? prof.subscription_activated_at ?? prof.created_at,
      juliane_notes: plan?.juliane_notes ?? null,
    };
  });

  // Mostra primeiro as que precisam mais atenção (não aprovadas)
  return cards
    .filter(c => !c.approved_by_juliane)
    .slice(0, limit);
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
