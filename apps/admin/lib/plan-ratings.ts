import { createAdminClient } from '@/lib/supabase';

// Avaliações dos planos entregues (tabela plan_feedback, coluna rating 1–5).
export interface PlanRatings {
  total: number;                 // nº de avaliações com nota
  avg: number | null;            // média das notas
  dist: Record<number, number>;  // distribuição 1..5
  today: number;                 // avaliações hoje (BR)
  month: number;                 // avaliações no mês (BR)
  delivered: number;             // planos entregues (ready) — base da taxa
  rate: number | null;           // total ÷ delivered (taxa de avaliação)
  fiveStarPct: number | null;    // % nota 5
  lowPct: number | null;         // % nota 1–2 (insatisfeitas)
}

export async function getPlanRatings(): Promise<PlanRatings> {
  const sb = createAdminClient();

  // Janelas em horário de Brasília (UTC-3)
  const brNow = new Date(Date.now() - 3 * 3600 * 1000);
  const yyyy = brNow.getUTCFullYear();
  const mm = String(brNow.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(brNow.getUTCDate()).padStart(2, '0');
  const todayStartBR = `${yyyy}-${mm}-${dd}T03:00:00.000Z`;
  const monthStartBR = `${yyyy}-${mm}-01T03:00:00.000Z`;

  const [fbRes, deliveredRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('plan_feedback') as any).select('rating, created_at').not('rating', 'is', null).limit(100000),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('profiles') as any).select('id', { count: 'exact', head: true }).eq('plan_status', 'ready'),
  ]);

  const rows = (fbRes.data ?? []) as { rating: number; created_at: string }[];
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0, today = 0, month = 0;
  for (const r of rows) {
    const n = Number(r.rating);
    if (n >= 1 && n <= 5) dist[n]++;
    sum += n;
    if (r.created_at >= todayStartBR) today++;
    if (r.created_at >= monthStartBR) month++;
  }
  const total = rows.length;
  const delivered = deliveredRes.count ?? 0;
  const fiveStar = dist[5];
  const low = dist[1] + dist[2];

  return {
    total,
    avg: total > 0 ? sum / total : null,
    dist,
    today,
    month,
    delivered,
    rate: delivered > 0 ? total / delivered : null,
    fiveStarPct: total > 0 ? (fiveStar / total) * 100 : null,
    lowPct: total > 0 ? (low / total) * 100 : null,
  };
}
