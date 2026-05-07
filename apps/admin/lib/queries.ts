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

  const [active, pending, weekNew, weekCanceled, todayCk] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('profiles') as any)
      .select('*', { count: 'exact', head: true })
      .eq('subscription_status', 'active'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('hair_plans') as any)
      .select('user_id', { count: 'exact', head: true })
      .eq('approved_by_juliane', false)
      .eq('week_number', 1),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('profiles') as any)
      .select('*', { count: 'exact', head: true })
      .eq('subscription_status', 'active')
      .gte('created_at', sevenDaysAgo),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('profiles') as any)
      .select('*', { count: 'exact', head: true })
      .eq('subscription_status', 'cancelled')
      .gte('updated_at', sevenDaysAgo),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('check_ins') as any)
      .select('*', { count: 'exact', head: true })
      .gte('checked_at', todayStart.toISOString()),
  ]);

  // Receita mensal estimada com base em assinaturas ativas
  // Anual cartão: R$ 34,90 / 12 ≈ R$ 2,91 por assinante por mês
  // Anual PIX: pago de uma vez — R$ 49,90 / 12 ≈ R$ 4,16 (one-time já contabilizado)
  const activeCount = active.count ?? 0;
  const monthlyRevenueBrl = Math.round(activeCount * 2.91);

  return {
    activeSubscribers: activeCount,
    pendingPlans: pending.count ?? 0,
    monthlyRevenueBrl,
    todayCheckIns: todayCk.count ?? 0,
    newSubscribersThisWeek: weekNew.count ?? 0,
    cancellationsThisWeek: weekCanceled.count ?? 0,
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

  // Pega 1 row por user_id (a primeira semana que está pendente)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: plans } = await (sb.from('hair_plans') as any)
    .select('user_id,approved_by_juliane,created_at,juliane_notes,week_number')
    .eq('week_number', 1)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!plans?.length) return [];

  const userIds = (plans as Array<{ user_id: string }>).map(p => p.user_id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profs } = await (sb.from('profiles') as any)
    .select('id,full_name,email,hair_type')
    .in('id', userIds);

  const profMap = new Map(
    (profs as Array<{ id: string; full_name: string | null; email: string; hair_type: string | null }>)?.map(p => [p.id, p]) ??
      [],
  );

  return (plans as Array<{
    user_id: string;
    approved_by_juliane: boolean;
    created_at: string;
    juliane_notes: string | null;
  }>).map(p => {
    const prof = profMap.get(p.user_id);
    return {
      user_id: p.user_id,
      full_name: prof?.full_name ?? null,
      email: prof?.email ?? '',
      hair_type: prof?.hair_type ?? null,
      approved_by_juliane: p.approved_by_juliane,
      created_at: p.created_at,
      juliane_notes: p.juliane_notes,
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
  const sb = createAdminClient();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb.from('hair_plans') as any)
    .select('created_at,week_number')
    .eq('week_number', 1)
    .gte('created_at', sevenDaysAgo.toISOString());

  const days: Array<{ day: string; count: number; isToday: boolean }> = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayLetters = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const isToday = i === 0;
    const dayKey = d.toISOString().slice(0, 10);
    const count =
      ((data as Array<{ created_at: string }>) ?? []).filter(
        r => r.created_at.slice(0, 10) === dayKey,
      ).length;
    days.push({
      day: isToday ? 'Hoje' : dayLetters[d.getDay()],
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
