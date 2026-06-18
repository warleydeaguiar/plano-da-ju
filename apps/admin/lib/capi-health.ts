// Saúde do Sinal de Compra (Pixel + CAPI) — lê capi_event_log e resume.
// Mostra se o evento de Compra server-side está vivo e o índice de
// correspondência (proxy da Event Match Quality da Meta, que não tem API pública).

import { createAdminClient } from './supabase';

export interface CapiDayPoint {
  day: string;        // YYYY-MM-DD (BR)
  purchases: number;  // Purchase enviados (status=sent)
}

export interface CapiHealth {
  configured: boolean;             // false se só há registros 'skipped' (token off)
  status: 'ok' | 'warn' | 'down' | 'unknown';
  lastPurchaseAt: string | null;   // ISO
  hoursSinceLastPurchase: number | null;
  purchasesToday: number;
  purchases7d: number;
  purchases30d: number;
  sent30d: number;
  error30d: number;
  skipped30d: number;
  daily14d: CapiDayPoint[];
  // Índice de correspondência (só Purchase enviados, 30d)
  matchScore: number | null;       // 0..100
  matchGrade: 'Ótima' | 'Boa' | 'Baixa' | null;
  avgFields: number | null;        // média de identificadores por evento
  pctEmail: number; pctPhone: number; pctFbc: number; pctFbp: number;
}

const BR_TZ = 'America/Sao_Paulo';
function brDay(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BR_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export async function getCapiHealth(): Promise<CapiHealth | { error: string }> {
  try {
    const sb = createAdminClient();
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.from('capi_event_log') as any)
      .select('event_name,status,fields_count,has_email,has_phone,has_fbc,has_fbp,created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(50000);
    if (error) return { error: error.message };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = data ?? [];
    const purch = rows.filter(r => r.event_name === 'Purchase');
    const purchSent = purch.filter(r => r.status === 'sent');

    const now = Date.now();
    const todayBR = brDay(new Date());
    const d7 = now - 7 * 24 * 3600 * 1000;
    const d30 = now - 30 * 24 * 3600 * 1000;

    const purchasesToday = purchSent.filter(r => brDay(new Date(r.created_at)) === todayBR).length;
    const purchases7d = purchSent.filter(r => new Date(r.created_at).getTime() >= d7).length;
    const purchases30d = purchSent.filter(r => new Date(r.created_at).getTime() >= d30).length;

    const lastSent = purchSent[0]?.created_at ?? null;
    const hoursSince = lastSent ? Math.floor((now - new Date(lastSent).getTime()) / 3600000) : null;

    // Houve algum disparo real (sent/error) de Purchase? senão, token provavelmente off.
    const everReal = purch.some(r => r.status === 'sent' || r.status === 'error');
    const configured = everReal;

    // 14 dias (gráfico)
    const daily14d: CapiDayPoint[] = [];
    for (let i = 13; i >= 0; i--) {
      const day = brDay(new Date(now - i * 24 * 3600 * 1000));
      daily14d.push({ day, purchases: purchSent.filter(r => brDay(new Date(r.created_at)) === day).length });
    }

    // Índice de correspondência (Purchase enviados, 30d)
    const n = purchSent.length;
    let matchScore: number | null = null;
    let matchGrade: CapiHealth['matchGrade'] = null;
    let avgFields: number | null = null;
    let pctEmail = 0, pctPhone = 0, pctFbc = 0, pctFbp = 0;
    if (n > 0) {
      avgFields = purchSent.reduce((s, r) => s + (r.fields_count ?? 0), 0) / n;
      pctEmail = purchSent.filter(r => r.has_email).length / n;
      pctPhone = purchSent.filter(r => r.has_phone).length / n;
      pctFbc = purchSent.filter(r => r.has_fbc).length / n;
      pctFbp = purchSent.filter(r => r.has_fbp).length / n;
      // Score ponderado: email/phone são os mais fortes; fbc (clique do anúncio) é ouro p/ atribuição.
      matchScore = Math.round(100 * (0.35 * pctEmail + 0.30 * pctPhone + 0.20 * pctFbc + 0.15 * pctFbp));
      matchGrade = matchScore >= 75 ? 'Ótima' : matchScore >= 50 ? 'Boa' : 'Baixa';
    }

    // Status do sinal
    let status: CapiHealth['status'] = 'unknown';
    if (!configured) status = 'down';                 // nunca disparou de verdade → token off
    else if (hoursSince === null) status = 'down';
    else if (hoursSince <= 24) status = 'ok';
    else if (hoursSince <= 72) status = 'warn';
    else status = 'down';

    return {
      configured, status,
      lastPurchaseAt: lastSent,
      hoursSinceLastPurchase: hoursSince,
      purchasesToday, purchases7d, purchases30d,
      sent30d: rows.filter(r => r.status === 'sent').length,
      error30d: rows.filter(r => r.status === 'error').length,
      skipped30d: rows.filter(r => r.status === 'skipped').length,
      daily14d,
      matchScore, matchGrade, avgFields, pctEmail, pctPhone, pctFbc, pctFbp,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'erro' };
  }
}
