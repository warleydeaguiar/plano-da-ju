/**
 * Integração Google Analytics 4 (GA4) via OAuth + Data API.
 *
 * Fluxo "clico em Integrar → autorizo no Google":
 *  - /api/analytics/auth      → redireciona pro consentimento do Google
 *  - /api/analytics/callback  → troca o code por tokens e salva em integration_tokens
 *  - /analytics (page)        → usa o refresh_token pra chamar a Data API e mostrar métricas
 */
import { createAdminClient } from './supabase';

export const GA_PROVIDER = 'google_analytics';
export const GA_PROPERTY_ID = process.env.GA4_PROPERTY_ID ?? '352698969';
export const GA_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
export const GA_REDIRECT_URI =
  process.env.GOOGLE_ANALYTICS_REDIRECT_URI ?? 'https://admin.julianecost.com/api/analytics/callback';

export function gaClientId() {
  return process.env.GOOGLE_ANALYTICS_CLIENT_ID ?? '';
}
export function gaClientSecret() {
  return process.env.GOOGLE_ANALYTICS_CLIENT_SECRET ?? '';
}
export function gaConfigured() {
  return !!gaClientId() && !!gaClientSecret();
}

/** URL de consentimento do Google (access_type=offline + prompt=consent → garante refresh_token). */
export function buildAuthUrl(state = 'analytics'): string {
  const p = new URLSearchParams({
    client_id: gaClientId(),
    redirect_uri: GA_REDIRECT_URI,
    response_type: 'code',
    scope: GA_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TokenRow = { access_token: string | null; refresh_token: string | null; expires_at: string | null };

async function readToken(): Promise<TokenRow | null> {
  const sb = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb.from('integration_tokens') as any)
    .select('access_token, refresh_token, expires_at')
    .eq('provider', GA_PROVIDER)
    .maybeSingle();
  return (data as TokenRow) ?? null;
}

export async function isConnected(): Promise<boolean> {
  const t = await readToken();
  return !!t?.refresh_token;
}

/** Troca o authorization code por tokens e persiste (inclui refresh_token). */
export async function exchangeCode(code: string): Promise<void> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: gaClientId(),
      client_secret: gaClientSecret(),
      redirect_uri: GA_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`token exchange falhou: ${res.status} ${await res.text()}`);
  const j = await res.json();
  const sb = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb.from('integration_tokens') as any).upsert(
    {
      provider: GA_PROVIDER,
      access_token: j.access_token ?? null,
      // o Google só devolve refresh_token na 1ª autorização (com prompt=consent vem sempre)
      refresh_token: j.refresh_token ?? null,
      expires_at: j.expires_in ? new Date(Date.now() + j.expires_in * 1000).toISOString() : null,
      scope: j.scope ?? GA_SCOPE,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'provider' },
  );
}

/** Devolve um access_token válido, renovando pelo refresh_token quando expirado. */
export async function getAccessToken(): Promise<string | null> {
  const t = await readToken();
  if (!t?.refresh_token) return null;
  const stillValid = t.access_token && t.expires_at && new Date(t.expires_at).getTime() > Date.now() + 60_000;
  if (stillValid) return t.access_token;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: gaClientId(),
      client_secret: gaClientSecret(),
      refresh_token: t.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    console.error('[analytics] refresh falhou', res.status, await res.text());
    return null;
  }
  const j = await res.json();
  const sb = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb.from('integration_tokens') as any)
    .update({
      access_token: j.access_token,
      expires_at: j.expires_in ? new Date(Date.now() + j.expires_in * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('provider', GA_PROVIDER);
  return j.access_token ?? null;
}

export async function disconnect(): Promise<void> {
  const sb = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb.from('integration_tokens') as any).delete().eq('provider', GA_PROVIDER);
}

// ── GA4 Data API ───────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runReport(accessToken: string, body: any): Promise<any> {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${GA_PROPERTY_ID}:runReport`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw new Error(`GA Data API ${res.status}: ${await res.text()}`);
  return res.json();
}

export type GaSummary = {
  totals: { activeUsers: number; sessions: number; pageViews: number; conversions: number };
  byDay: Array<{ date: string; users: number; sessions: number }>;
  topPages: Array<{ path: string; views: number }>;
  channels: Array<{ channel: string; sessions: number; users: number }>;
};

const n = (v: unknown) => Number(v ?? 0) || 0;

/** Puxa um resumo dos últimos `days` dias da propriedade. */
export async function fetchSummary(days = 28): Promise<GaSummary | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const dateRanges = [{ startDate: `${days}daysAgo`, endDate: 'today' }];

  const [totals, daily, pages, channels] = await Promise.all([
    runReport(token, { dateRanges, metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }, { name: 'conversions' }] }),
    runReport(token, { dateRanges, dimensions: [{ name: 'date' }], metrics: [{ name: 'activeUsers' }, { name: 'sessions' }], orderBys: [{ dimension: { dimensionName: 'date' } }] }),
    runReport(token, { dateRanges, dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'screenPageViews' }], orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 10 }),
    runReport(token, { dateRanges, dimensions: [{ name: 'sessionDefaultChannelGroup' }], metrics: [{ name: 'sessions' }, { name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 8 }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tRow = totals.rows?.[0]?.metricValues ?? [];
  return {
    totals: {
      activeUsers: n(tRow[0]?.value),
      sessions: n(tRow[1]?.value),
      pageViews: n(tRow[2]?.value),
      conversions: n(tRow[3]?.value),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    byDay: (daily.rows ?? []).map((r: any) => ({
      date: r.dimensionValues?.[0]?.value ?? '',
      users: n(r.metricValues?.[0]?.value),
      sessions: n(r.metricValues?.[1]?.value),
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    topPages: (pages.rows ?? []).map((r: any) => ({
      path: r.dimensionValues?.[0]?.value ?? '',
      views: n(r.metricValues?.[0]?.value),
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    channels: (channels.rows ?? []).map((r: any) => ({
      channel: r.dimensionValues?.[0]?.value ?? '(outro)',
      sessions: n(r.metricValues?.[0]?.value),
      users: n(r.metricValues?.[1]?.value),
    })),
  };
}
