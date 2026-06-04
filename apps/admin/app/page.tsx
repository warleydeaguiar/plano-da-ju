import Sidebar from './components/Sidebar';
import ProgressFeed from './components/ProgressFeed';
import {
  getDashboardStats,
  getPendingPlans,
  getRecentCheckIns,
  getNewPlansByDay,
} from '../lib/queries';
import { createAdminClient } from '../lib/supabase';
import { getQuizAdSpend, type AdGroupResult } from '../lib/meta-ads-quiz';
import { fetchYberaOrders, salesOnDateBR, salesTotal, YBERA_COMMISSION_RATE } from '../lib/ybera-api';
import { T, fonts, shadow, gradient, gradientForId } from './theme';
import {
  IconUsers, IconUserPlus, IconMoney, IconCreditCard, IconReceipt, IconBag,
  IconHandshake, IconChart, IconTrendUp, IconTrendDown, IconTarget, IconClipboard,
  IconMegaphone, IconCursor, IconEye, IconEdit, IconCheckCircle, IconWarning,
  IconChat, iconForHairFeel,
} from './icons';

export const dynamic = 'force-dynamic';

type IconType = React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }>;

// Preço do plano (R$34,90 cartão). Usado pra estimar receita do dia.
const PLAN_PRICE = 34.90;

function brl(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `há ${hr} ${hr === 1 ? 'hora' : 'horas'}`;
  const d = Math.floor(hr / 24);
  return `há ${d} ${d === 1 ? 'dia' : 'dias'}`;
}

function initialsFor(name: string | null): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '');
}

const HAIR_TYPE_LABEL: Record<string, string> = {
  liso: 'Liso',
  ondulado: 'Ondulado',
  cacheado: 'Cacheado',
  crespo: 'Crespo',
};

// ── Componentes auxiliares ───────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background: T.surface,
  borderRadius: 18,
  border: `1px solid ${T.borderSoft}`,
  boxShadow: shadow.card,
  overflow: 'hidden',
  // Sem isto, o card encolhe (flex-shrink) dentro do <main> flex-column de
  // altura fixa e o overflow:hidden corta o conteúdo (ex: subtítulo do header).
  flexShrink: 0,
};

function StatCard({ icon: Icon, label, value, sub, accent = T.pink, accentSoft = T.pinkSoft, valueColor }: {
  icon?: IconType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  accentSoft?: string;
  valueColor?: string;
}) {
  return (
    <div style={{ ...cardStyle, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        {Icon && (
          <div style={{
            width: 38, height: 38, borderRadius: 11, flexShrink: 0,
            background: accentSoft, color: accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={20} />
          </div>
        )}
        <div style={{
          fontSize: 11, fontWeight: 700, color: T.inkMuted,
          textTransform: 'uppercase', letterSpacing: 0.6, lineHeight: 1.3,
        }}>{label}</div>
      </div>
      <div style={{
        fontSize: 28, fontWeight: 700, fontFamily: fonts.display,
        color: valueColor ?? T.ink, letterSpacing: -1, lineHeight: 1,
      }}>{value}</div>
      {sub && (
        <div style={{ fontSize: 12, color: T.inkMuted, fontWeight: 500, marginTop: 6 }}>{sub}</div>
      )}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle, accent }: {
  icon: IconType; title: string; subtitle: string; accent: string;
}) {
  return (
    <div style={{
      ...cardStyle,
      padding: '14px 18px',
      borderLeft: `4px solid ${accent}`,
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 12, flexShrink: 0,
        background: accent + '15', color: accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={22} />
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.ink, fontFamily: fonts.ui }}>{title}</div>
        <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>{subtitle}</div>
      </div>
    </div>
  );
}

function AdGroupDailyChart({ data, color, label }: { data: AdGroupResult['daily']; color: string; label: string }) {
  if (data.length === 0) {
    return <div style={{ fontSize: 13, color: T.inkMuted, textAlign: 'center', padding: '24px 0' }}>Sem dados</div>;
  }
  const maxSpend = Math.max(1, ...data.map(d => d.spend));
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: T.inkMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label} — últimos 7 dias
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 90 }}>
        {data.map((d, i) => {
          const isLast = i === data.length - 1;
          const h = d.spend > 0 ? Math.max(6, (d.spend / maxSpend) * 78) : 3;
          return (
            <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              {d.spend > 0 && (
                <div style={{ fontSize: 8.5, fontWeight: 700, color: isLast ? color : T.ink, whiteSpace: 'nowrap' }}>
                  R${d.spend.toFixed(0)}
                </div>
              )}
              <div style={{
                width: '100%', height: h, borderRadius: '3px 3px 0 0',
                background: d.spend === 0 ? T.borderSoft : color,
                opacity: d.spend === 0 ? 0.4 : isLast ? 1 : 0.85,
              }} />
              <div style={{ fontSize: 9, color: isLast ? color : T.inkMuted, fontWeight: isLast ? 700 : 400, whiteSpace: 'nowrap' }}>
                {d.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RevenueDailyChart({ data, price }: {
  data: Array<{ day: string; count: number; isToday: boolean }>;
  price: number;
}) {
  const series = data.map(d => ({ ...d, revenue: d.count * price }));
  const maxRev = Math.max(1, ...series.map(d => d.revenue));
  const total = series.reduce((s, d) => s + d.revenue, 0);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, fontFamily: fonts.ui }}>
          Faturamento por dia{' '}
          <span style={{ fontSize: 11, fontWeight: 500, color: T.inkMuted }}>(últimos 7 dias)</span>
        </div>
        <div style={{ fontSize: 12, color: T.inkMuted }}>
          Total 7d: <strong style={{ color: T.green }}>{brl(total)}</strong>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 110 }}>
        {series.map((d, i) => {
          const h = d.revenue > 0 ? Math.max(8, (d.revenue / maxRev) * 84) : 4;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: d.isToday ? T.green : T.ink, whiteSpace: 'nowrap' }}>
                {d.revenue > 0 ? `R$${d.revenue.toFixed(0)}` : '—'}
              </div>
              <div style={{
                width: '100%', height: h, borderRadius: '6px 6px 0 0',
                background: d.revenue === 0 ? T.borderSoft : d.isToday ? T.green : T.greenSoft,
                transition: 'all 0.2s',
              }} />
              <div style={{ fontSize: 11, color: d.isToday ? T.green : T.inkMuted, fontWeight: d.isToday ? 700 : 500 }}>
                {d.day}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CampaignList({ campaigns, color }: { campaigns: AdGroupResult['campaigns']; color: string }) {
  if (campaigns.length === 0) {
    return <div style={{ fontSize: 13, color: T.inkMuted, padding: '12px 0' }}>Nenhuma campanha com gasto este mês</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
      {campaigns.map((c, i) => (
        <div key={c.campaign_id} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          padding: '8px 10px', borderRadius: 8,
          background: i % 2 === 0 ? T.cream : 'transparent',
        }}>
          <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {c.campaign_name}
            </div>
            <div style={{ fontSize: 10.5, color: T.inkMuted, marginTop: 2 }}>
              {c.impressions.toLocaleString('pt-BR')} imp · {c.link_clicks.toLocaleString('pt-BR')} cliques no link
              {c.ctr != null && ` · CTR ${c.ctr.toFixed(2)}%`}
              {c.cpc != null && ` · CPC R$${c.cpc.toFixed(2)}`}
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color, flexShrink: 0 }}>
            {brl(c.spend)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function DashboardPage() {
  const sb = createAdminClient();
  const now = new Date();

  // ── Janelas em horário de Brasília (UTC-3) ─────────────────────
  const brasiliaOffsetMs = 3 * 60 * 60 * 1000;
  const brasiliaNow = new Date(now.getTime() - brasiliaOffsetMs);
  const yyyy = brasiliaNow.getUTCFullYear();
  const mm   = String(brasiliaNow.getUTCMonth() + 1).padStart(2, '0');
  const dd   = String(brasiliaNow.getUTCDate()).padStart(2, '0');
  const todayStartBR     = new Date(`${yyyy}-${mm}-${dd}T03:00:00.000Z`);
  const yesterdayStartBR = new Date(todayStartBR.getTime() - 86400_000);
  const monthStartBR     = new Date(`${yyyy}-${mm}-01T03:00:00.000Z`);
  const day7agoBR        = new Date(todayStartBR.getTime() -  7 * 86400_000);
  const day30agoBR       = new Date(todayStartBR.getTime() - 30 * 86400_000);

  const [
    // Dashboard operacional (queries.ts)
    stats,
    plans,
    checkIns,
    byDay,
    // Plano — usuárias / receita
    totalUsers,
    activeUsers,
    activeToday,
    activeYesterday,
    activeMonth,
    newLast7,
    // Funil quiz
    quizViewsToday, quizViewsYesterday, quizViewsMonth,
    leadsToday, leadsYesterday, leadsMonth,
    offerViewsToday, offerViewsYesterday,
    checkoutToday, checkoutYesterday,
    offerViewsMonth, checkoutMonth,
    interactTodayRaw, interactYestRaw, interactMonthRaw,
    // Grupos
    groupJoinsToday,
    groupJoinsYesterday,
    groupJoinsMonth,
    totalClicks,
    clicksToday,
    clicksLast7,
    // App geral
    totalPlans,
    pendingPlansCount,
    checkInsToday,
    checkInsLast7,
    checkInsLast30,
    // Meta Ads
    metaAds,
    // Ybera orders
    yberaMonthOrders,
  ] = await Promise.all([
    getDashboardStats(),
    getPendingPlans(8),
    getRecentCheckIns(6),
    getNewPlansByDay(),
    // Plano
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('profiles') as any).select('*', { count: 'exact', head: true }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('profiles') as any).select('*', { count: 'exact', head: true }).eq('subscription_status', 'active'),
    // VENDAS — exclui presentes/cortesia (is_gift=true) pra não inflar receita.
    // Filtro NULL-safe: aceita is_gift=false OU NULL (perfis antigos sem o campo).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('profiles') as any).select('*', { count: 'exact', head: true }).eq('subscription_status', 'active').or('is_gift.is.null,is_gift.eq.false').gte('subscription_activated_at', todayStartBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('profiles') as any).select('*', { count: 'exact', head: true }).eq('subscription_status', 'active').or('is_gift.is.null,is_gift.eq.false').gte('subscription_activated_at', yesterdayStartBR.toISOString()).lt('subscription_activated_at', todayStartBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('profiles') as any).select('*', { count: 'exact', head: true }).eq('subscription_status', 'active').or('is_gift.is.null,is_gift.eq.false').gte('subscription_activated_at', monthStartBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('profiles') as any).select('*', { count: 'exact', head: true }).gte('created_at', day7agoBR.toISOString()),
    // Funil
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_views') as any).select('*', { count: 'exact', head: true }).eq('quiz_slug', 'plano-capilar').gte('created_at', todayStartBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_views') as any).select('*', { count: 'exact', head: true }).eq('quiz_slug', 'plano-capilar').gte('created_at', yesterdayStartBR.toISOString()).lt('created_at', todayStartBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_views') as any).select('*', { count: 'exact', head: true }).eq('quiz_slug', 'plano-capilar').gte('created_at', day30agoBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_leads') as any).select('*', { count: 'exact', head: true }).eq('quiz_slug', 'plano-capilar').gte('created_at', todayStartBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_leads') as any).select('*', { count: 'exact', head: true }).eq('quiz_slug', 'plano-capilar').gte('created_at', yesterdayStartBR.toISOString()).lt('created_at', todayStartBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_leads') as any).select('*', { count: 'exact', head: true }).eq('quiz_slug', 'plano-capilar').gte('created_at', day30agoBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('checkout_events') as any).select('*', { count: 'exact', head: true }).eq('event_type', 'offer_viewed').gte('created_at', todayStartBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('checkout_events') as any).select('*', { count: 'exact', head: true }).eq('event_type', 'offer_viewed').gte('created_at', yesterdayStartBR.toISOString()).lt('created_at', todayStartBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('checkout_events') as any).select('*', { count: 'exact', head: true }).eq('event_type', 'checkout_initiated').gte('created_at', todayStartBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('checkout_events') as any).select('*', { count: 'exact', head: true }).eq('event_type', 'checkout_initiated').gte('created_at', yesterdayStartBR.toISOString()).lt('created_at', todayStartBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('checkout_events') as any).select('*', { count: 'exact', head: true }).eq('event_type', 'offer_viewed').gte('created_at', day30agoBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('checkout_events') as any).select('*', { count: 'exact', head: true }).eq('event_type', 'checkout_initiated').gte('created_at', day30agoBR.toISOString()),
    // "Interagiu" = sessions únicas com step_index=0 answered
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_step_events') as any).select('session_id').eq('quiz_slug', 'plano-capilar').eq('step_index', 0).eq('event_type', 'answered').gte('created_at', todayStartBR.toISOString()).limit(5000),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_step_events') as any).select('session_id').eq('quiz_slug', 'plano-capilar').eq('step_index', 0).eq('event_type', 'answered').gte('created_at', yesterdayStartBR.toISOString()).lt('created_at', todayStartBR.toISOString()).limit(5000),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_quiz_step_events') as any).select('session_id').eq('quiz_slug', 'plano-capilar').eq('step_index', 0).eq('event_type', 'answered').gte('created_at', day30agoBR.toISOString()).limit(20000),
    // Grupos — joins e cliques
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_member_events') as any).select('*', { count: 'exact', head: true }).eq('action', 'join').gte('created_at', todayStartBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_member_events') as any).select('*', { count: 'exact', head: true }).eq('action', 'join').gte('created_at', yesterdayStartBR.toISOString()).lt('created_at', todayStartBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_member_events') as any).select('*', { count: 'exact', head: true }).eq('action', 'join').gte('created_at', monthStartBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_redirect_clicks') as any).select('*', { count: 'exact', head: true }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_redirect_clicks') as any).select('*', { count: 'exact', head: true }).gte('created_at', todayStartBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_redirect_clicks') as any).select('*', { count: 'exact', head: true }).gte('created_at', day7agoBR.toISOString()),
    // App
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('hair_plans') as any).select('*', { count: 'exact', head: true }).eq('week_number', 1),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('hair_plans') as any).select('*', { count: 'exact', head: true }).eq('week_number', 1).eq('approved_by_juliane', false),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('check_ins') as any).select('*', { count: 'exact', head: true }).gte('checked_at', todayStartBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('check_ins') as any).select('*', { count: 'exact', head: true }).gte('checked_at', day7agoBR.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('check_ins') as any).select('*', { count: 'exact', head: true }).gte('checked_at', day30agoBR.toISOString()),
    // Meta Ads
    getQuizAdSpend(),
    // Vendas Ybera do mês até hoje
    (async () => {
      const since = `${yyyy}-${mm}-01`;
      const until = `${yyyy}-${mm}-${dd}`;
      return await fetchYberaOrders(since, until);
    })(),
  ]);

  // ── PLANO: KPIs derivados ────────────────────────────────────────
  const planoSpendToday      = metaAds.plano.today;
  const planoSpendYesterday  = metaAds.plano.yesterday;
  const planoSpendMonth      = metaAds.plano.thisMonth;

  const salesToday      = activeToday.count ?? 0;
  const salesYesterday  = activeYesterday.count ?? 0;
  const salesMonth      = activeMonth.count ?? 0;

  const revenueToday      = salesToday      * PLAN_PRICE;
  const revenueMonth      = salesMonth      * PLAN_PRICE;

  const roasToday = planoSpendToday    > 0 ? revenueToday    / planoSpendToday    : null;
  const roasMonth = planoSpendMonth    > 0 ? revenueMonth    / planoSpendMonth    : null;
  const cpaToday  = salesToday         > 0 ? planoSpendToday / salesToday         : null;
  const cpaMonth  = salesMonth         > 0 ? planoSpendMonth / salesMonth         : null;

  const profitToday = revenueToday - planoSpendToday;
  const profitMonth = revenueMonth - planoSpendMonth;

  // ── GRUPOS: KPIs ─────────────────────────────────────────────────
  const gruposSpendToday      = metaAds.grupos.today;
  const gruposSpendYesterday  = metaAds.grupos.yesterday;
  const gruposSpendMonth      = metaAds.grupos.thisMonth;

  const joinsToday     = groupJoinsToday.count     ?? 0;
  const joinsYesterday = groupJoinsYesterday.count ?? 0;
  const joinsMonth     = groupJoinsMonth.count     ?? 0;

  const cpjToday = joinsToday > 0 ? gruposSpendToday / joinsToday : null;
  const cpjMonth = joinsMonth > 0 ? gruposSpendMonth / joinsMonth : null;

  // ── YBERA: vendas + comissão ─────────────────────────────────────
  const yberaOrders = yberaMonthOrders.orders ?? [];
  const yberaStatus = yberaMonthOrders.status;
  const todayBR     = `${yyyy}-${mm}-${dd}`;
  // "Ontem" precisa preservar ano+mês corretos na virada de mês — antes só
  // trocava o dia, então no dia 1 do mês caía em "MM-31/30" do mês corrente (errado).
  const yesterdayDt   = new Date(todayStartBR.getTime() - 86400_000);
  const yesterdayBR   = `${yesterdayDt.getUTCFullYear()}-${String(yesterdayDt.getUTCMonth() + 1).padStart(2, '0')}-${String(yesterdayDt.getUTCDate()).padStart(2, '0')}`;

  const yberaSalesToday     = salesOnDateBR(yberaOrders, todayBR);
  const yberaSalesYesterday = salesOnDateBR(yberaOrders, yesterdayBR);
  const yberaSalesMonth     = salesTotal(yberaOrders);

  const commissionToday     = yberaSalesToday     * YBERA_COMMISSION_RATE;
  const commissionMonth     = yberaSalesMonth     * YBERA_COMMISSION_RATE;

  const gruposProfitToday = commissionToday - gruposSpendToday;
  const gruposProfitMonth = commissionMonth - gruposSpendMonth;

  const gruposRoasToday = gruposSpendToday > 0 ? commissionToday / gruposSpendToday : null;
  const gruposRoasMonth = gruposSpendMonth > 0 ? commissionMonth / gruposSpendMonth : null;

  // Funil — Meta Ads
  const adClicksToday = metaAds.plano.funnelToday.link_clicks;
  const adClicksYest  = metaAds.plano.funnelYesterday.link_clicks;
  const adClicksMonth = metaAds.plano.funnelMonth.link_clicks;
  const lpvToday      = metaAds.plano.funnelToday.landing_page_views;
  const lpvYest       = metaAds.plano.funnelYesterday.landing_page_views;
  const lpvMonth      = metaAds.plano.funnelMonth.landing_page_views;

  // Funil — Interagiu (dedupe session_id em JS)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uniq = (rows: any): number => {
    if (!rows?.data) return 0;
    const s = new Set<string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of rows.data as any[]) if (r.session_id) s.add(r.session_id);
    return s.size;
  };
  const iToday = uniq(interactTodayRaw);
  const iYest  = uniq(interactYestRaw);
  const iMonth = uniq(interactMonthRaw);

  // Funil — quiz interno
  const qToday = quizViewsToday.count ?? 0;
  const qYest  = quizViewsYesterday.count ?? 0;
  const qMonth = quizViewsMonth.count ?? 0;
  const lToday = leadsToday.count ?? 0;
  const lYest  = leadsYesterday.count ?? 0;
  const lMonth = leadsMonth.count ?? 0;
  const oToday = offerViewsToday.count ?? 0;
  const oYest  = offerViewsYesterday.count ?? 0;
  const oMonth = offerViewsMonth.count ?? 0;
  const cToday = checkoutToday.count ?? 0;
  const cYest  = checkoutYesterday.count ?? 0;
  const cMonth = checkoutMonth.count ?? 0;

  function pct(a: number, b: number) {
    if (!b) return '—';
    return `${Math.round((a / b) * 100)}%`;
  }

  // ── Dashboard greeting / chart ───────────────────────────────────
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const todayLabel = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
  const maxCount = Math.max(1, ...byDay.map(d => d.count));

  // ── Estilos compartilhados ──────────────────────────────────────
  const card = cardStyle;
  const cardHeader: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px 14px', borderBottom: `1px solid ${T.borderSoft}`,
  };
  const sectionTitle: React.CSSProperties = {
    fontSize: 14, fontWeight: 700, color: T.ink, fontFamily: fonts.ui,
  };
  const th: React.CSSProperties = {
    fontSize: 10.5, fontWeight: 700, color: T.inkMuted,
    textTransform: 'uppercase', letterSpacing: 0.8,
    padding: '10px 20px', textAlign: 'left',
    background: T.cream, borderBottom: `1px solid ${T.borderSoft}`,
  };
  const td: React.CSSProperties = {
    padding: '12px 20px', fontSize: 13, color: T.ink,
    borderBottom: `1px solid ${T.borderSoft}`,
  };

  // Funil — linhas com ícones
  const funnelRows: Array<{
    icon: IconType; label: string; today: number; yest: number; month: number;
    convToday: string | null; convYest: string | null; convMonth: string | null;
    source: 'meta' | 'quiz' | 'sale'; highlight: boolean;
  }> = [
    { icon: IconCursor, label: 'Cliques no link (Meta)', today: adClicksToday, yest: adClicksYest, month: adClicksMonth,
      convToday: null, convYest: null, convMonth: null, source: 'meta', highlight: false },
    { icon: IconEye, label: 'Visualização de página', today: lpvToday, yest: lpvYest, month: lpvMonth,
      convToday: pct(lpvToday, adClicksToday), convYest: pct(lpvYest, adClicksYest), convMonth: pct(lpvMonth, adClicksMonth),
      source: 'meta', highlight: false },
    { icon: IconEdit, label: 'Interagiu (clicou na 1ª opção)', today: iToday, yest: iYest, month: iMonth,
      convToday: pct(iToday, lpvToday || qToday), convYest: pct(iYest, lpvYest || qYest), convMonth: pct(iMonth, lpvMonth || qMonth),
      source: 'quiz', highlight: true },
    { icon: IconClipboard, label: 'Completou (lead)', today: lToday, yest: lYest, month: lMonth,
      convToday: pct(lToday, iToday), convYest: pct(lYest, iYest), convMonth: pct(lMonth, iMonth),
      source: 'quiz', highlight: false },
    { icon: IconBag, label: 'Viu a oferta', today: oToday, yest: oYest, month: oMonth,
      convToday: pct(oToday, lToday), convYest: pct(oYest, lYest), convMonth: pct(oMonth, lMonth),
      source: 'quiz', highlight: false },
    { icon: IconCreditCard, label: 'Iniciou checkout', today: cToday, yest: cYest, month: cMonth,
      convToday: pct(cToday, oToday), convYest: pct(cYest, oYest), convMonth: pct(cMonth, oMonth),
      source: 'quiz', highlight: false },
    { icon: IconCheckCircle, label: 'Comprou', today: salesToday, yest: salesYesterday, month: salesMonth,
      convToday: pct(salesToday, cToday), convYest: pct(salesYesterday, cYest), convMonth: pct(salesMonth, cMonth),
      source: 'sale', highlight: true },
  ];

  const funnelTh: React.CSSProperties = {
    padding: '11px 20px', fontSize: 11, color: T.inkMuted, fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: 0.4,
  };

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: T.bg, fontFamily: fonts.ui, color: T.ink,
    }}>
      <Sidebar />
      <main style={{
        marginLeft: 234, flex: 1, height: '100vh', overflowY: 'auto',
        padding: 32, display: 'flex', flexDirection: 'column', gap: 22,
      }}>
        {/* ── Hero header ─────────────────────────────────────────── */}
        <div style={{
          position: 'relative',
          background: gradient.hero,
          borderRadius: 22,
          padding: '30px 28px',
          boxShadow: shadow.hero,
          overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          minHeight: 104,
        }}>
          <div style={{ position: 'absolute', right: -40, top: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.10)' }} />
          <div style={{ position: 'absolute', right: 60, bottom: -60, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ position: 'relative' }}>
            <h1 style={{
              fontSize: 28, fontWeight: 600, margin: 0, color: '#fff',
              fontFamily: fonts.display, letterSpacing: -0.5,
            }}>
              {greeting}, <em style={{ fontStyle: 'italic' }}>Juliane</em>
            </h1>
            <div style={{
              fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 4,
              textTransform: 'capitalize', fontWeight: 500,
            }}>
              {todayLabel}
            </div>
          </div>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Status Meta Ads */}
            {metaAds.status === 'ok' && (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '6px 12px', borderRadius: 99,
                background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)',
                color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 7,
              }}>
                <span style={{ width: 7, height: 7, background: '#fff', borderRadius: '50%', display: 'inline-block' }} />
                Meta Ads ao vivo
              </span>
            )}
            {metaAds.status === 'not_configured' && (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '6px 12px', borderRadius: 99,
                background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)',
                color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 7,
              }}>
                <IconWarning size={13} /> Meta Ads não configurado
              </span>
            )}
            {metaAds.status === 'error' && (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '6px 12px', borderRadius: 99,
                background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)',
                color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 7,
              }}>
                <IconWarning size={13} /> Erro Meta Ads
              </span>
            )}
            {stats.pendingPlans > 0 && (
              <a href="/planos" style={{
                background: 'rgba(255,255,255,0.18)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.25)',
                color: '#fff', fontSize: 13, fontWeight: 600,
                padding: '10px 18px', borderRadius: 99, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none',
              }}>
                <span style={{ width: 8, height: 8, background: '#fff', borderRadius: '50%', display: 'inline-block' }} />
                {stats.pendingPlans} {stats.pendingPlans === 1 ? 'plano' : 'planos'} p/ revisar
              </a>
            )}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════ */}
        {/* SEÇÃO 1: PLANO CAPILAR                                    */}
        {/* ════════════════════════════════════════════════════════ */}
        <SectionHeader
          icon={IconMegaphone}
          title="Plano Capilar — Anúncios com 'Plano' no nome"
          subtitle={`Receita = vendas × R$${PLAN_PRICE.toFixed(2)} (preço cartão). Lucro = receita − investimento.`}
          accent={T.pinkDeep}
        />

        {/* KPIs Plano — hoje */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          <StatCard
            icon={IconMoney} label="Investimento hoje" value={brl(planoSpendToday)}
            accent={T.blue} accentSoft={T.blueSoft} valueColor={T.blue}
            sub={`ontem ${brl(planoSpendYesterday)}`}
          />
          <StatCard
            icon={IconReceipt} label="Receita hoje" value={brl(revenueToday)}
            accent={T.green} accentSoft={T.greenSoft} valueColor={T.green}
            sub={`${salesToday} venda${salesToday !== 1 ? 's' : ''}`}
          />
          <StatCard
            icon={IconChart} label="ROAS hoje"
            value={roasToday !== null ? `${roasToday.toFixed(2)}x` : '—'}
            accent={T.pink} accentSoft={T.pinkSoft}
            valueColor={roasToday !== null && roasToday >= 1 ? T.green : roasToday !== null ? T.danger : T.inkMuted}
            sub={roasToday !== null ? (roasToday >= 1 ? 'lucrativo' : 'no prejuízo') : 'sem investimento hoje'}
          />
          <StatCard
            icon={profitToday >= 0 ? IconTrendUp : IconTrendDown} label="Lucro hoje"
            value={brl(profitToday)}
            accent={profitToday >= 0 ? T.green : T.danger}
            accentSoft={profitToday >= 0 ? T.greenSoft : T.dangerSoft}
            valueColor={profitToday >= 0 ? T.green : T.danger}
            sub={`R$ ${cpaToday !== null ? cpaToday.toFixed(2) : '—'} custo/venda`}
          />
        </div>

        {/* KPIs Plano — mês */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          <StatCard label="Investimento mês" value={brl(planoSpendMonth)} sub="acumulado" />
          <StatCard label="Receita mês" value={brl(revenueMonth)} valueColor={T.green} sub={`${salesMonth} venda${salesMonth !== 1 ? 's' : ''}`} />
          <StatCard
            label="ROAS mês"
            value={roasMonth !== null ? `${roasMonth.toFixed(2)}x` : '—'}
            valueColor={roasMonth !== null && roasMonth >= 1 ? T.green : roasMonth !== null ? T.danger : T.inkMuted}
            sub={cpaMonth !== null ? `CPA R$${cpaMonth.toFixed(2)}` : undefined}
          />
          <StatCard
            label="Lucro mês" value={brl(profitMonth)}
            valueColor={profitMonth >= 0 ? T.green : T.danger}
          />
        </div>

        {/* Plano — gráfico + campanhas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ ...card, padding: 22 }}>
            <AdGroupDailyChart data={metaAds.plano.daily} color={T.pinkDeep} label="Investimento (Plano)" />
          </div>
          <div style={{ ...card, padding: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.inkMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Campanhas Plano — mês atual
            </div>
            <CampaignList campaigns={metaAds.plano.campaigns} color={T.pinkDeep} />
          </div>
        </div>

        {/* Faturamento por dia (Plano) */}
        <div style={{ ...card, padding: 22 }}>
          <RevenueDailyChart data={byDay} price={PLAN_PRICE} />
          <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 14, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ color: T.green, flexShrink: 0, marginTop: 1 }}><IconReceipt size={14} /></span>
            <span>Faturamento = vendas confirmadas no dia × R${PLAN_PRICE.toFixed(2)}. Baseado em <strong>subscription_activated_at</strong> (pagamento aprovado).</span>
          </div>
        </div>

        {/* Funil Plano */}
        <div style={card}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.borderSoft}`, fontSize: 12, fontWeight: 700, color: T.ink, letterSpacing: 0.2 }}>
            Funil de conversão — Anúncio → Compra
            <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 500, color: T.inkMuted, textTransform: 'none' }}>
              · Conv. = % que avança da etapa anterior
            </span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: T.cream, borderBottom: `1px solid ${T.borderSoft}` }}>
                {['Etapa', 'Hoje', 'Conv.', 'Ontem', 'Conv.', '30d', 'Conv. 30d'].map((h, i) => (
                  <th key={i} style={{ ...funnelTh, textAlign: i === 0 ? 'left' : 'right' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {funnelRows.map((row, i) => {
                const RowIcon = row.icon;
                const isMeta = row.source === 'meta';
                const isSale = row.source === 'sale';
                const valueColor = isMeta ? T.blue : isSale ? T.green : T.pinkDeep;
                return (
                  <tr key={i} style={{
                    borderBottom: `1px solid ${T.borderSoft}`,
                    background: row.highlight ? T.pinkSoft : 'transparent',
                  }}>
                    <td style={{ padding: '12px 20px', fontSize: 13, color: T.ink, fontWeight: 600 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: valueColor, display: 'inline-flex' }}><RowIcon size={17} /></span>
                        {row.label}
                      </span>
                      {isMeta && (
                        <span style={{
                          marginLeft: 6, fontSize: 9.5, fontWeight: 700,
                          padding: '2px 6px', borderRadius: 4,
                          background: T.blueSoft, color: T.blue, letterSpacing: 0.3,
                        }}>META</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: 14, fontWeight: 700, color: valueColor }}>
                      {row.today.toLocaleString('pt-BR')}
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: 12, color: row.convToday === null || row.convToday === '—' ? T.inkMuted : T.green, fontWeight: 600 }}>
                      {row.convToday ?? '—'}
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: 14, fontWeight: 700, color: T.ink }}>
                      {row.yest.toLocaleString('pt-BR')}
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: 12, color: row.convYest === null || row.convYest === '—' ? T.inkMuted : T.green, fontWeight: 600 }}>
                      {row.convYest ?? '—'}
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: 13, color: T.ink, fontWeight: 600 }}>
                      {row.month.toLocaleString('pt-BR')}
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: 12, color: row.convMonth === null || row.convMonth === '—' ? T.inkMuted : T.green, fontWeight: 600 }}>
                      {row.convMonth ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ padding: '11px 20px', borderTop: `1px solid ${T.borderSoft}`, fontSize: 11, color: T.inkSoft, lineHeight: 1.55, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ color: T.gold, flexShrink: 0, marginTop: 1 }}><IconTarget size={14} /></span>
            <span><strong>Interagiu</strong> é a taxa de qualidade do tráfego — quem entra e clica na primeira opção do quiz mostra que o anúncio atraiu a pessoa certa. Quanto maior essa taxa, melhor o match anúncio×audiência.</span>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════ */}
        {/* SEÇÃO 2: GRUPOS YBERA                                     */}
        {/* ════════════════════════════════════════════════════════ */}
        <SectionHeader
          icon={IconChat}
          title="Grupos Ybera — Anúncios com 'Grupos' no nome"
          subtitle={`Cruzamento: investimento (Meta) × vendas Ybera × comissão (${(YBERA_COMMISSION_RATE * 100).toFixed(0)}%). Comissão é o que recebemos.`}
          accent={T.blue}
        />

        {/* KPIs Grupos — linha 1 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          <StatCard
            icon={IconMoney} label="Investimento hoje" value={brl(gruposSpendToday)}
            accent={T.blue} accentSoft={T.blueSoft} valueColor={T.blue}
            sub={`ontem ${brl(gruposSpendYesterday)}`}
          />
          <StatCard
            icon={IconUsers} label="Cadastros hoje" value={joinsToday}
            accent={T.green} accentSoft={T.greenSoft} valueColor={T.green}
            sub={`ontem ${joinsYesterday}`}
          />
          <StatCard
            icon={IconTarget} label="Custo/cadastro hoje"
            value={cpjToday !== null ? brl(cpjToday) : '—'}
            accent={T.pink} accentSoft={T.pinkSoft}
            sub={cpjToday === null ? (joinsToday === 0 ? 'sem cadastros' : 'sem investimento') : 'CPA do dia'}
          />
          <StatCard
            icon={IconTarget} label="Custo/cadastro mês"
            value={cpjMonth !== null ? brl(cpjMonth) : '—'}
            accent={T.pink} accentSoft={T.pinkSoft}
            sub={`${joinsMonth} cadastro${joinsMonth !== 1 ? 's' : ''} · ${brl(gruposSpendMonth)} gasto`}
          />
        </div>

        {/* KPIs Grupos — linha 2: vendas Ybera + comissão */}
        {yberaStatus === 'ok' ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
              <StatCard
                icon={IconBag} label="Vendas Ybera hoje" value={brl(yberaSalesToday)}
                accent={T.gold} accentSoft={T.goldSoft}
                sub={`ontem ${brl(yberaSalesYesterday)}`}
              />
              <StatCard
                icon={IconHandshake} label="Comissão hoje" value={brl(commissionToday)}
                accent={T.green} accentSoft={T.greenSoft} valueColor={T.green}
                sub={`${(YBERA_COMMISSION_RATE * 100).toFixed(0)}% das vendas`}
              />
              <StatCard
                icon={IconChart} label="ROAS hoje"
                value={gruposRoasToday !== null ? `${gruposRoasToday.toFixed(2)}x` : '—'}
                accent={T.pink} accentSoft={T.pinkSoft}
                valueColor={gruposRoasToday !== null && gruposRoasToday >= 1 ? T.green : gruposRoasToday !== null ? T.danger : T.inkMuted}
                sub={gruposRoasToday !== null ? (gruposRoasToday >= 1 ? 'lucrativo' : 'no prejuízo') : 'sem investimento hoje'}
              />
              <StatCard
                icon={gruposProfitToday >= 0 ? IconTrendUp : IconTrendDown} label="Lucro hoje"
                value={brl(gruposProfitToday)}
                accent={gruposProfitToday >= 0 ? T.green : T.danger}
                accentSoft={gruposProfitToday >= 0 ? T.greenSoft : T.dangerSoft}
                valueColor={gruposProfitToday >= 0 ? T.green : T.danger}
                sub="comissão − investimento"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
              <StatCard label="Vendas Ybera mês" value={brl(yberaSalesMonth)} sub={`${yberaOrders.length} pedido${yberaOrders.length !== 1 ? 's' : ''}`} />
              <StatCard label="Comissão mês" value={brl(commissionMonth)} valueColor={T.green} />
              <StatCard
                label="ROAS mês"
                value={gruposRoasMonth !== null ? `${gruposRoasMonth.toFixed(2)}x` : '—'}
                valueColor={gruposRoasMonth !== null && gruposRoasMonth >= 1 ? T.green : gruposRoasMonth !== null ? T.danger : T.inkMuted}
              />
              <StatCard
                label="Lucro mês" value={brl(gruposProfitMonth)}
                valueColor={gruposProfitMonth >= 0 ? T.green : T.danger}
              />
            </div>
          </>
        ) : (
          <div style={{
            ...card, border: `1px solid ${T.alert}30`,
            padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'center',
          }}>
            <span style={{ color: T.alert, flexShrink: 0 }}><IconWarning size={22} /></span>
            <div style={{ fontSize: 13, color: T.inkSoft }}>
              <strong style={{ color: T.ink }}>Vendas Ybera indisponíveis</strong> — {
                yberaStatus === 'no_token'
                  ? 'configure YBERA_API_TOKEN no Vercel para ver comissão/lucro.'
                  : 'erro ao chamar API da Ybera. Tente recarregar.'
              }
            </div>
          </div>
        )}

        {/* Grupos — gráfico + campanhas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ ...card, padding: 22 }}>
            <AdGroupDailyChart data={metaAds.grupos.daily} color={T.blue} label="Investimento (Grupos)" />
          </div>
          <div style={{ ...card, padding: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.inkMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Campanhas Grupos — mês atual
            </div>
            <CampaignList campaigns={metaAds.grupos.campaigns} color={T.blue} />
          </div>
        </div>

        {/* Cliques no link dos grupos */}
        <div style={{ ...card, padding: 22 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, marginBottom: 16 }}>
            Cliques no link de entrada dos grupos
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
            {[
              { label: 'Hoje',       value: clicksToday.count ?? 0 },
              { label: 'Últimos 7d', value: clicksLast7.count ?? 0 },
              { label: 'Total',      value: totalClicks.count ?? 0 },
            ].map(({ label, value }) => (
              <div key={label} style={{ textAlign: 'center', padding: 16, background: T.cream, borderRadius: 10 }}>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: fonts.display, color: T.blue }}>{value.toLocaleString('pt-BR')}</div>
                <div style={{ fontSize: 12, color: T.inkMuted, marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 12, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ color: T.alert, flexShrink: 0, marginTop: 1 }}><IconWarning size={14} /></span>
            <span>Cliques ≠ cadastros. Nem todo quem clica entra no grupo. O CPA acima usa os cadastros confirmados (Evolution webhook).</span>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════ */}
        {/* SEÇÃO 3: OPERAÇÕES                                        */}
        {/* ════════════════════════════════════════════════════════ */}
        <SectionHeader
          icon={IconClipboard}
          title="Operações"
          subtitle="Planos a revisar, check-ins recentes, reembolsos e vendas da semana."
          accent={T.pink}
        />

        {/* Main grid operacional */}
        <div style={{ display: 'grid', gridTemplateColumns: '60fr 40fr', gap: 16, alignItems: 'start' }}>
          {/* Planos pendentes */}
          <div style={card}>
            <div style={cardHeader}>
              <span style={sectionTitle}>Planos Aguardando Revisão</span>
              <a href="/planos" style={{ fontSize: 12.5, color: T.pinkDeep, textDecoration: 'none', fontWeight: 600 }}>
                Ver todos →
              </a>
            </div>
            {plans.length === 0 ? (
              <div style={{ padding: 44, textAlign: 'center', color: T.inkMuted, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8, color: T.green }}>
                  <IconCheckCircle size={30} />
                </div>
                Nenhum plano aguardando revisão!
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Usuária', 'Tipo', 'Criado', 'Status', 'Ação'].map(h => (
                      <th key={h} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {plans.map(p => (
                    <tr key={p.user_id}>
                      <td style={{ ...td, fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                            background: gradientForId(p.user_id),
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 10.5, fontWeight: 700, color: '#fff',
                          }}>{initialsFor(p.full_name).toUpperCase()}</div>
                          {p.full_name ?? p.email.split('@')[0]}
                        </div>
                      </td>
                      <td style={td}>
                        {p.hair_type ? HAIR_TYPE_LABEL[p.hair_type] ?? p.hair_type : '—'}
                      </td>
                      <td style={{ ...td, color: T.inkMuted }}>
                        {formatRelativeTime(p.created_at)}
                      </td>
                      <td style={td}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99,
                          background: !p.approved_by_juliane ? T.alertSoft : T.greenSoft,
                          color: !p.approved_by_juliane ? T.alert : T.green,
                        }}>
                          {!p.approved_by_juliane
                            ? <><span style={{ width: 7, height: 7, background: T.alert, borderRadius: '50%', display: 'inline-block' }} /> Pendente</>
                            : <><IconCheckCircle size={13} /> Aprovado</>}
                        </span>
                      </td>
                      <td style={td}>
                        <a href={`/planos?user=${p.user_id}`} style={{
                          display: 'inline-block', fontSize: 12, fontWeight: 600,
                          padding: '6px 14px', borderRadius: 9, textDecoration: 'none',
                          background: !p.approved_by_juliane ? gradient.heroSoft : T.cream,
                          color: !p.approved_by_juliane ? '#fff' : T.ink,
                          boxShadow: !p.approved_by_juliane ? '0 3px 10px rgba(190,24,93,0.22)' : 'none',
                        }}>
                          {!p.approved_by_juliane ? 'Revisar' : 'Ver'}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Coluna direita */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Check-ins */}
            <div style={card}>
              <div style={{ ...cardHeader, justifyContent: 'flex-start', gap: 7 }}>
                <span style={{ width: 7, height: 7, background: T.green, borderRadius: '50%', display: 'inline-block' }} />
                <span style={sectionTitle}>Check-ins Recentes</span>
              </div>
              {checkIns.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: T.inkMuted, fontSize: 13 }}>
                  Sem check-ins recentes
                </div>
              ) : (
                checkIns.map((c, i) => {
                  const FeelIcon = iconForHairFeel(c.hair_feel);
                  return (
                    <div key={c.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
                      borderBottom: i < checkIns.length - 1 ? `1px solid ${T.borderSoft}` : 'none',
                    }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                        background: gradientForId(c.user_id),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, color: '#fff',
                      }}>{initialsFor(c.full_name).toUpperCase()}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{c.full_name ?? 'Anônima'}</div>
                        <div style={{ fontSize: 11.5, color: T.inkMuted, marginTop: 1 }}>{formatRelativeTime(c.checked_at)}</div>
                      </div>
                      <span style={{ color: T.pink, display: 'inline-flex' }}>
                        <FeelIcon size={20} />
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Reembolsos */}
            <div style={card}>
              <div style={cardHeader}>
                <span style={sectionTitle}>Reembolsos esta semana</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 20 }}>
                <span style={{
                  fontSize: 30, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -0.5,
                  color: stats.cancellationsThisWeek > 0 ? T.danger : T.green,
                }}>
                  {stats.cancellationsThisWeek}
                </span>
                <span style={{ fontSize: 13, color: T.inkSoft }}>
                  {stats.cancellationsThisWeek === 0
                    ? 'Tudo certo nesta semana'
                    : stats.cancellationsThisWeek === 1 ? 'cancelamento' : 'cancelamentos'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Gráfico de vendas */}
        <div style={{ ...card, padding: 22 }}>
          <div style={{ ...sectionTitle, marginBottom: 20 }}>Vendas por dia (últimos 7 dias)</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 110 }}>
            {byDay.map((d, i) => {
              const h = d.count > 0 ? Math.max(8, (d.count / maxCount) * 84) : 4;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: d.isToday ? T.pinkDeep : T.ink }}>
                    {d.count}
                  </div>
                  <div style={{
                    width: '100%', height: h,
                    background: d.count === 0 ? T.borderSoft : d.isToday ? gradient.heroSoft : T.pinkBlush,
                    borderRadius: '6px 6px 0 0',
                    transition: 'all 0.2s',
                  }} />
                  <div style={{ fontSize: 11, color: d.isToday ? T.pinkDeep : T.inkMuted, fontWeight: d.isToday ? 700 : 500 }}>
                    {d.day}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════ */}
        {/* SEÇÃO 4: APP & USUÁRIAS                                   */}
        {/* ════════════════════════════════════════════════════════ */}
        <SectionHeader
          icon={IconUsers}
          title="App & Usuárias"
          subtitle="Visão geral da base de clientes e engajamento no app."
          accent={T.ink}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          <StatCard icon={IconUsers} label="Total usuárias" value={(totalUsers.count ?? 0).toLocaleString('pt-BR')} sub="cadastradas" />
          <StatCard
            icon={IconCheckCircle} label="Assinantes ativas"
            value={(activeUsers.count ?? 0).toLocaleString('pt-BR')}
            accent={T.green} accentSoft={T.greenSoft} valueColor={T.green}
            sub={`${((activeUsers.count ?? 0) / Math.max(1, totalUsers.count ?? 1) * 100).toFixed(0)}% do total`}
          />
          <StatCard
            icon={IconUserPlus} label="Novas usuárias 7d" value={newLast7.count ?? 0}
            accent={T.pink} accentSoft={T.pinkSoft}
            sub="cadastros recentes"
          />
          <StatCard
            icon={IconClipboard} label="Planos pendentes" value={pendingPlansCount.count ?? 0}
            accent={T.alert} accentSoft={T.alertSoft}
            valueColor={pendingPlansCount.count ? T.alert : T.ink}
            sub={`de ${totalPlans.count ?? 0} total`}
          />
        </div>

        <div style={{ ...card, padding: 22 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, marginBottom: 16 }}>Check-ins no app</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
            {[
              { label: 'Hoje',        value: checkInsToday.count ?? 0,  color: T.pinkDeep },
              { label: 'Últimos 7d',  value: checkInsLast7.count ?? 0,  color: T.blue },
              { label: 'Últimos 30d', value: checkInsLast30.count ?? 0, color: T.green },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ textAlign: 'center', padding: 16, background: T.cream, borderRadius: 10 }}>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: fonts.display, color }}>{value.toLocaleString('pt-BR')}</div>
                <div style={{ fontSize: 12, color: T.inkMuted, marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Feed paginado das fotos de progresso (check-ins) das clientes */}
        <ProgressFeed />
      </main>
    </div>
  );
}
