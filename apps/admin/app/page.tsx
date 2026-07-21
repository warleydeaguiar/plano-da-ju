import Sidebar from './components/Sidebar';
import ProgressFeed from './components/ProgressFeed';
import InitialHairFeed from './components/InitialHairFeed';
import {
  getDashboardStats,
  getPendingPlans,
  getRecentCheckIns,
  getRealSales,
  getPixStats,
} from '../lib/queries';
import { createAdminClient } from '../lib/supabase';
import { getQuizAdSpend, META_TAX_RATE, type AdGroupResult } from '../lib/meta-ads-quiz';
import { getAiCosts } from '../lib/ai-costs';
import { getPlanRatings } from '../lib/plan-ratings';
import { getYberaDashboard } from '../lib/ybera-dashboard';
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

function RevenueDailyChart({ data }: {
  data: Array<{ day: string; count: number; revenueCents: number; isToday: boolean }>;
}) {
  const series = data.map(d => ({ ...d, revenue: d.revenueCents / 100 }));
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

function YberaDailyChart({ data }: {
  data: Array<{ day: string; subtotal: number; count: number; isToday: boolean }>;
}) {
  const maxVal = Math.max(1, ...data.map(d => d.subtotal));
  const total = data.reduce((s, d) => s + d.subtotal, 0);
  const totalPedidos = data.reduce((s, d) => s + d.count, 0);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, fontFamily: fonts.ui }}>
          Vendas Ybera por dia{' '}
          <span style={{ fontSize: 11, fontWeight: 500, color: T.inkMuted }}>(últimos 14 dias · subtotal dos produtos)</span>
        </div>
        <div style={{ fontSize: 12, color: T.inkMuted }}>
          Total 14d: <strong style={{ color: T.gold }}>{brl(total)}</strong> · {totalPedidos.toLocaleString('pt-BR')} pedidos
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
        {data.map((d, i) => {
          const h = d.subtotal > 0 ? Math.max(8, (d.subtotal / maxVal) * 88) : 4;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: d.isToday ? T.gold : T.ink, whiteSpace: 'nowrap' }}>
                {d.subtotal > 0 ? `R$${d.subtotal >= 1000 ? (d.subtotal / 1000).toFixed(1) + 'k' : d.subtotal.toFixed(0)}` : '—'}
              </div>
              <div style={{
                width: '100%', height: h, borderRadius: '6px 6px 0 0',
                background: d.subtotal === 0 ? T.borderSoft : d.isToday ? T.gold : T.goldSoft,
                transition: 'all 0.2s',
              }} title={`${d.count} pedido(s)`} />
              <div style={{ fontSize: 10, color: d.isToday ? T.gold : T.inkMuted, fontWeight: d.isToday ? 700 : 500 }}>
                {d.day}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function YberaConversionTrend({ data, activeCount }: {
  data: Array<{ ym: string; label: string; buyers: number; conversion: number; revenue: number }>;
  activeCount: number;
}) {
  const maxConv = Math.max(0.0001, ...data.map(d => d.conversion));
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, fontFamily: fonts.ui, marginBottom: 2 }}>
        📈 Conversão das alunas por mês — está subindo?
      </div>
      <div style={{ fontSize: 11.5, color: T.inkMuted, marginBottom: 16 }}>
        % da base de {activeCount.toLocaleString('pt-BR')} alunas ativas que comprou na Ybera no mês
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 130 }}>
        {data.map(t => (
          <div key={t.ym} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, height: '100%', justifyContent: 'flex-end' }}
            title={`${t.label}: ${(t.conversion * 100).toFixed(1)}% · ${t.buyers} alunas · ${brl(t.revenue)}`}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.pinkDeep }}>{(t.conversion * 100).toFixed(0)}%</div>
            <div style={{ width: '100%', maxWidth: 46, height: Math.max((t.conversion / maxConv) * 90, t.conversion > 0 ? 4 : 2), borderRadius: '5px 5px 0 0', background: `linear-gradient(180deg, ${T.pinkDeep}, ${T.pink})` }} />
            <div style={{ fontSize: 10, color: T.inkMuted }}>{t.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanClickFunnel({ data, buyRate, totalClickers, totalBuyers }: {
  data: Array<{ day: string; clickers: number; buyers: number; clicks: number }>;
  buyRate: number; totalClickers: number; totalBuyers: number;
}) {
  const maxC = Math.max(1, ...data.map(d => d.clickers));
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, fontFamily: fonts.ui }}>
          🎯 Cliques nos produtos do plano × quem comprou (por dia)
        </div>
        <div style={{ fontSize: 12, color: T.inkMuted }}>
          14 dias: <strong style={{ color: T.blue }}>{totalClickers.toLocaleString('pt-BR')}</strong> clicaram ·{' '}
          <strong style={{ color: T.green }}>{totalBuyers.toLocaleString('pt-BR')}</strong> compraram ·{' '}
          <strong style={{ color: buyRate >= 0.15 ? T.green : T.danger }}>{(buyRate * 100).toFixed(1)}%</strong> conversão
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: T.inkMuted, marginBottom: 16 }}>
        Barra clara = clientes que clicaram num produto indicado · barra cheia = quantos desses compraram na Ybera. O vão entre as duas é a venda que estamos perdendo.
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 140 }}>
        {data.map((d, i) => {
          const hc = d.clickers > 0 ? Math.max(8, (d.clickers / maxC) * 100) : 3;
          const hb = d.clickers > 0 ? (d.buyers / d.clickers) * hc : 0;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.ink, whiteSpace: 'nowrap' }}>
                {d.clickers > 0 ? `${d.buyers}/${d.clickers}` : '—'}
              </div>
              <div style={{ width: '100%', maxWidth: 40, height: hc, borderRadius: '6px 6px 0 0', background: T.blueSoft, position: 'relative' }}
                title={`${d.day}: ${d.clickers} clicaram, ${d.buyers} compraram (${d.clicks} cliques)`}>
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: hb, borderRadius: hb >= hc - 1 ? '6px 6px 0 0' : 0, background: T.green }} />
              </div>
              <div style={{ fontSize: 10, color: d.day.startsWith(String(new Date().getDate())) ? T.blue : T.inkMuted }}>{d.day}</div>
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

  // Planos travados na geração (processing há >15min, com foto, sem plano pronto).
  // Sinal de que a IA parou — quase sempre OpenRouter sem crédito. Alerta no topo.
  const stuck15 = new Date(now.getTime() - 15 * 60_000).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: stuckPlansCount } = await (sb.from('profiles') as any)
    .select('id', { count: 'exact', head: true })
    .eq('plan_status', 'processing')
    .not('photo_url', 'is', null)
    .lt('plan_requested_at', stuck15);
  const stuckPlans = stuckPlansCount ?? 0;

  const [
    // Dashboard operacional (queries.ts)
    stats,
    plans,
    checkIns,
    realSales,
    // Plano — usuárias / receita
    totalUsers,
    activeUsers,
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
    getRealSales(),
    // Plano
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('profiles') as any).select('*', { count: 'exact', head: true }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('profiles') as any).select('*', { count: 'exact', head: true }).eq('subscription_status', 'active'),
    // (vendas/receita do dia/ontem/mês agora vêm de getRealSales — pagamento real Pagar.me)
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
    // "Planos p/ revisar" = pedidos de ajuste ABERTOS (fonte: plan_feedback,
    // robusto — não depende do flag plan_status que pode ser revertido).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('plan_feedback') as any).select('*', { count: 'exact', head: true }).eq('status', 'open'),
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

  const pixStats = await getPixStats();
  const aiCosts = await getAiCosts();

  // Planos gerados HOJE (BR) → custo médio de IA por plano (custo do dia / planos)
  const _br = new Date(Date.now() - 3 * 3600 * 1000);
  const _startTodayBR = new Date(Date.UTC(_br.getUTCFullYear(), _br.getUTCMonth(), _br.getUTCDate(), 3, 0, 0)).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: plansGeneratedToday } = await (sb.from('profiles') as any)
    .select('id', { count: 'exact', head: true })
    .gte('plan_requested_at', _startTodayBR);
  const aiCostPerPlanToday = (aiCosts.ok && plansGeneratedToday && plansGeneratedToday > 0)
    ? (aiCosts.dailyUsd * aiCosts.rate) / plansGeneratedToday
    : null;

  // Avaliações dos planos entregues (plan_feedback)
  const planRatings = await getPlanRatings();

  // Conversão Ybera: tendência mensal + funil diário cliques→vendas
  const yberaDash = await getYberaDashboard();

  // ── SMS (Zenvia) — recuperação de PIX + aviso de plano pronto ────────
  // Contamos as colunas ATUAIS: pix_sms_last_at (fluxo de PIX: imediato + 24h/72h)
  // e plan_sms_sent_at (SMS de "plano pronto"). Custo estimado por SMS ajustável.
  const SMS_COST_BRL = Number(process.env.ZENVIA_SMS_COST_BRL ?? '0.08');
  const _startMonthBR = new Date(Date.UTC(_br.getUTCFullYear(), _br.getUTCMonth(), 1, 3, 0, 0)).toISOString();
  const cnt = (col: string, gte?: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (sb.from('profiles') as any).select('id', { count: 'exact', head: true });
    q = gte ? q.gte(col, gte) : q.not(col, 'is', null);
    return q;
  };
  const [pixToday, pixMonth, pixTotal, planToday, planMonth, planTotal] = await Promise.all([
    cnt('pix_sms_last_at', _startTodayBR), cnt('pix_sms_last_at', _startMonthBR), cnt('pix_sms_last_at'),
    cnt('plan_sms_sent_at', _startTodayBR), cnt('plan_sms_sent_at', _startMonthBR), cnt('plan_sms_sent_at'),
  ]);
  const smsToday = (pixToday.count ?? 0) + (planToday.count ?? 0);
  const smsMonth = (pixMonth.count ?? 0) + (planMonth.count ?? 0);
  const smsTotal = (pixTotal.count ?? 0) + (planTotal.count ?? 0);

  // ── PLANO: KPIs derivados ────────────────────────────────────────
  const planoSpendToday      = metaAds.plano.today;
  const planoSpendYesterday  = metaAds.plano.yesterday;
  const planoSpendMonth      = metaAds.plano.thisMonth;

  // VENDAS/RECEITA 100% FIÉIS — soma real dos pagamentos (Pagar.me), deduplicada
  // por cliente/dia, sem cortesias, respeitando descontos. (Antes: ativações × R$34,90,
  // que inflava com cortesias de parceria e ignorava descontos/PIX×cartão.)
  const salesToday      = realSales.today.count;
  const salesYesterday  = realSales.yesterday.count;
  const salesMonth      = realSales.month.count;

  const revenueToday      = realSales.today.cents / 100;
  const revenueYesterday  = realSales.yesterday.cents / 100;
  const revenueMonth      = realSales.month.cents / 100;

  const roasToday     = planoSpendToday     > 0 ? revenueToday     / planoSpendToday     : null;
  const roasYesterday = planoSpendYesterday > 0 ? revenueYesterday / planoSpendYesterday : null;
  const roasMonth     = planoSpendMonth     > 0 ? revenueMonth     / planoSpendMonth     : null;
  const cpaToday  = salesToday         > 0 ? planoSpendToday / salesToday         : null;
  const cpaMonth  = salesMonth         > 0 ? planoSpendMonth / salesMonth         : null;

  const profitToday     = revenueToday     - planoSpendToday;
  const profitYesterday = revenueYesterday - planoSpendYesterday;
  const profitMonth     = revenueMonth     - planoSpendMonth;

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

  // Vendas Ybera por dia (últimos 14 dias BR) — pro gráfico do dashboard
  const yberaByDay = Array.from({ length: 14 }, (_, i) => {
    const dt = new Date(todayStartBR.getTime() - (13 - i) * 86400_000);
    const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
    const subtotal = salesOnDateBR(yberaOrders, key);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const count = yberaOrders.filter((o: any) => new Date(new Date(o.registerDate).getTime() - 3 * 3600_000).toISOString().slice(0, 10) === key).length;
    return { day: `${dt.getUTCDate()}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}`, subtotal, count, isToday: key === todayBR };
  });

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
    // Limita a 100%: eventos de uma etapa podem disparar mais de uma vez (ex.:
    // offer_viewed repetido), o que gerava conversões impossíveis (101%+).
    return `${Math.min(100, Math.round((a / b) * 100))}%`;
  }

  // ── Dashboard greeting / chart ───────────────────────────────────
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const todayLabel = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
  const maxCount = Math.max(1, ...realSales.byDay.map(d => d.count));

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
    source: 'meta' | 'quiz' | 'sale' | 'conv'; highlight: boolean;
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
    // Conversão geral = quem comprou ÷ cliques no link do Meta (o funil inteiro).
    { icon: IconTarget, label: 'Conversão geral (compra ÷ clique)',
      today: adClicksToday > 0 ? (salesToday / adClicksToday) * 100 : NaN,
      yest:  adClicksYest  > 0 ? (salesYesterday / adClicksYest) * 100 : NaN,
      month: adClicksMonth > 0 ? (salesMonth / adClicksMonth) * 100 : NaN,
      convToday: null, convYest: null, convMonth: null, source: 'conv', highlight: false },
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
      <main className="dash-main" style={{
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

        {/* Alerta: planos travados na geração (quase sempre OpenRouter sem crédito) */}
        {stuckPlans > 0 && (
          <a href="https://openrouter.ai/settings/credits" target="_blank" rel="noopener noreferrer" style={{
            display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none',
            background: '#FFF4E5', border: '1px solid #F0C36D', borderRadius: 14,
            padding: '16px 20px', color: '#7A5B10',
          }}>
            <span style={{ fontSize: 26 }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: '#8A5A00' }}>
                {stuckPlans} {stuckPlans === 1 ? 'plano travado' : 'planos travados'} na geração pela IA
              </div>
              <div style={{ fontSize: 12.5, marginTop: 3, lineHeight: 1.5 }}>
                Quase sempre é <strong>falta de crédito no OpenRouter</strong>. Toque aqui para adicionar crédito
                em <strong>openrouter.ai/settings/credits</strong>. Assim que houver saldo, o sistema regenera esses
                planos <strong>sozinho</strong> (a cada 10 min) — você não precisa avisar.
              </div>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#8A5A00', whiteSpace: 'nowrap' }}>Adicionar crédito →</span>
          </a>
        )}

        {/* ════════════════════════════════════════════════════════ */}
        {/* SEÇÃO 1: PLANO CAPILAR                                    */}
        {/* ════════════════════════════════════════════════════════ */}
        <SectionHeader
          icon={IconMegaphone}
          title="Plano Capilar — Anúncios com 'Plano' no nome"
          subtitle={`Receita = soma real dos pagamentos (Pagar.me), já com descontos e sem cortesias. Investimento já inclui o imposto da Meta (${(META_TAX_RATE * 100).toFixed(2).replace('.', ',')}%). Lucro = receita − investimento.`}
          accent={T.pinkDeep}
        />

        {/* KPIs Plano — hoje */}
        <div className="dash-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          <StatCard
            icon={IconMoney} label="Investimento hoje" value={brl(planoSpendToday)}
            accent={T.blue} accentSoft={T.blueSoft} valueColor={T.blue}
            sub={`ontem ${brl(planoSpendYesterday)}`}
          />
          <StatCard
            icon={IconReceipt} label="Receita hoje" value={brl(revenueToday)}
            accent={T.green} accentSoft={T.greenSoft} valueColor={T.green}
            sub={`ontem ${brl(revenueYesterday)}`}
          />
          <StatCard
            icon={IconChart} label="ROAS hoje"
            value={roasToday !== null ? `${roasToday.toFixed(2)}x` : '—'}
            accent={T.pink} accentSoft={T.pinkSoft}
            valueColor={roasToday !== null && roasToday >= 1 ? T.green : roasToday !== null ? T.danger : T.inkMuted}
            sub={`ontem ${roasYesterday !== null ? `${roasYesterday.toFixed(2)}x` : '—'}`}
          />
          <StatCard
            icon={profitToday >= 0 ? IconTrendUp : IconTrendDown} label="Lucro hoje"
            value={brl(profitToday)}
            accent={profitToday >= 0 ? T.green : T.danger}
            accentSoft={profitToday >= 0 ? T.greenSoft : T.dangerSoft}
            valueColor={profitToday >= 0 ? T.green : T.danger}
            sub={`ontem ${brl(profitYesterday)}`}
          />
        </div>

        {/* KPIs Plano — mês */}
        <div className="dash-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
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
          <RevenueDailyChart data={realSales.byDay} />
          <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 14, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ color: T.green, flexShrink: 0, marginTop: 1 }}><IconReceipt size={14} /></span>
            <span>Faturamento = <strong>soma real dos pagamentos</strong> confirmados no dia (Pagar.me), sem cortesias e já com descontos.</span>
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
                const isConv = row.source === 'conv';
                const valueColor = isConv ? T.goldDeep : isMeta ? T.blue : isSale ? T.green : T.pinkDeep;
                // Linha de conversão geral mostra % (não contagem).
                const fmt = (v: number) => isConv ? (Number.isFinite(v) ? `${v.toFixed(1).replace('.', ',')}%` : '—') : v.toLocaleString('pt-BR');
                return (
                  <tr key={i} style={{
                    borderBottom: `1px solid ${T.borderSoft}`,
                    borderTop: isConv ? `2px solid ${T.border}` : undefined,
                    background: isConv ? T.goldSoft : row.highlight ? T.pinkSoft : 'transparent',
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
                      {fmt(row.today)}
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: 12, color: row.convToday === null || row.convToday === '—' ? T.inkMuted : T.green, fontWeight: 600 }}>
                      {row.convToday ?? '—'}
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: 14, fontWeight: 700, color: isConv ? valueColor : T.ink }}>
                      {fmt(row.yest)}
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: 12, color: row.convYest === null || row.convYest === '—' ? T.inkMuted : T.green, fontWeight: 600 }}>
                      {row.convYest ?? '—'}
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: 13, color: isConv ? valueColor : T.ink, fontWeight: isConv ? 700 : 600 }}>
                      {fmt(row.month)}
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
          subtitle={`Cruzamento: investimento (Meta, já com imposto ${(META_TAX_RATE * 100).toFixed(2).replace('.', ',')}%) × vendas Ybera × comissão (${(YBERA_COMMISSION_RATE * 100).toFixed(0)}%). Comissão é o que recebemos.`}
          accent={T.blue}
        />

        {/* KPIs Grupos — linha 1 */}
        <div className="dash-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
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
            <div className="dash-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
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

            <div className="dash-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
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
            <div style={{ ...card, padding: '20px 24px' }}>
              <YberaDailyChart data={yberaByDay} />
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
          <div className="dash-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
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
        {/* CONVERSÃO DOS PRODUTOS INDICADOS (alunas → Ybera)         */}
        {/* ════════════════════════════════════════════════════════ */}
        <SectionHeader
          icon={IconBag}
          title="Conversão dos produtos indicados → Ybera"
          subtitle="A meta nº1: fazer as alunas do plano comprarem os produtos que a Ju indica. Clicaram × compraram (por dia) e a evolução da conversão mês a mês."
          accent={T.gold}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ ...card, padding: '22px 24px' }}>
            <PlanClickFunnel
              data={yberaDash.funnel} buyRate={yberaDash.buyRate}
              totalClickers={yberaDash.totalClickers} totalBuyers={yberaDash.totalBuyers}
            />
          </div>
          <div style={{ ...card, padding: '22px 24px' }}>
            <YberaConversionTrend data={yberaDash.trend} activeCount={yberaDash.activeCount} />
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
            {realSales.byDay.map((d, i) => {
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

        <div className="dash-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
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
          <div className="dash-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
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

        {/* Foto inicial (onboarding) das últimas 15 clientes */}
        <InitialHairFeed />

        {/* ── Conversão de PIX (movido para o rodapé) ── */}
        <div style={{ ...card, padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>💸 Conversão de PIX</div>
            <div style={{ fontSize: 12, color: T.inkMuted }}>Total · (7 dias)</div>
          </div>
          <div className="dash-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
            {[
              { label: 'PIX gerados',       value: pixStats.generated.toLocaleString('pt-BR'), sub: `${pixStats.generated7} em 7d`, color: T.blue },
              { label: 'PIX pagos',         value: pixStats.paid.toLocaleString('pt-BR'),      sub: `${pixStats.paid7} em 7d`,      color: T.green },
              { label: 'Taxa de conversão', value: `${pixStats.rate}%`,                        sub: `${pixStats.rate7}% em 7d`,     color: T.pinkDeep },
            ].map(({ label, value, sub, color }) => (
              <div key={label} style={{ textAlign: 'center', padding: 16, background: T.cream, borderRadius: 10 }}>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: fonts.display, color }}>{value}</div>
                <div style={{ fontSize: 12, color: T.inkMuted, marginTop: 4 }}>{label}</div>
                <div style={{ fontSize: 10.5, color: T.inkMuted, marginTop: 2 }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════ */}
        {/* AVALIAÇÕES DOS PLANOS ENTREGUES (plan_feedback)            */}
        {/* ════════════════════════════════════════════════════════ */}
        <SectionHeader
          icon={IconReceipt}
          title="Avaliações dos planos entregues"
          subtitle={`Notas de 1 a 5 que as clientes dão ao plano no app. ${planRatings.total.toLocaleString('pt-BR')} avaliações de ${planRatings.delivered.toLocaleString('pt-BR')} planos entregues.`}
          accent={T.gold}
        />
        <div className="dash-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          <StatCard
            icon={IconChart} label="Nota média"
            value={planRatings.avg != null ? `${planRatings.avg.toFixed(2)} ★` : '—'}
            accent={T.gold} accentSoft={T.goldSoft} valueColor={T.gold}
            sub={`${planRatings.total.toLocaleString('pt-BR')} avaliações no total`}
          />
          <StatCard
            icon={IconReceipt} label="Avaliações no mês"
            value={planRatings.month.toLocaleString('pt-BR')}
            accent={T.pink} accentSoft={T.pinkSoft}
            sub={`${planRatings.today.toLocaleString('pt-BR')} hoje`}
          />
          <StatCard
            icon={IconTarget} label="Taxa de avaliação"
            value={planRatings.rate != null ? `${(planRatings.rate * 100).toFixed(1)}%` : '—'}
            accent={T.blue} accentSoft={T.blueSoft} valueColor={T.blue}
            sub={`${planRatings.total.toLocaleString('pt-BR')} de ${planRatings.delivered.toLocaleString('pt-BR')} entregues avaliaram`}
          />
          <StatCard
            icon={IconTrendUp} label="Deram nota máxima (5★)"
            value={planRatings.fiveStarPct != null ? `${planRatings.fiveStarPct.toFixed(0)}%` : '—'}
            accent={T.green} accentSoft={T.greenSoft} valueColor={T.green}
            sub={planRatings.lowPct != null ? `insatisfeitas (1–2★): ${planRatings.lowPct.toFixed(0)}%` : '—'}
          />
        </div>

        {/* ════════════════════════════════════════════════════════ */}
        {/* CUSTOS DE IA (OpenRouter) — último item do dashboard       */}
        {/* ════════════════════════════════════════════════════════ */}
        <SectionHeader
          icon={IconChart}
          title="Custos de IA (OpenRouter)"
          subtitle={aiCosts.ok
            ? `Geração dos planos · cotação ${aiCosts.rateLabel}: US$ 1 = ${brl(aiCosts.rate)}`
            : 'Não foi possível ler os custos do OpenRouter agora.'}
          accent={T.pinkDeep}
        />
        <div className="dash-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          <StatCard
            icon={IconMoney} label="IA hoje" value={brl(aiCosts.dailyUsd * aiCosts.rate)}
            accent={T.blue} accentSoft={T.blueSoft} valueColor={T.blue}
            sub={aiCosts.limitUsd != null
              ? `limite ${aiCosts.limitReset === 'daily' ? 'diário' : aiCosts.limitReset === 'monthly' ? 'mensal' : ''} ${brl(aiCosts.limitUsd * aiCosts.rate)} · resta ${brl((aiCosts.limitRemainingUsd ?? 0) * aiCosts.rate)}`
              : `US$ ${aiCosts.dailyUsd.toFixed(2)}`}
          />
          <StatCard
            icon={IconMoney} label="Custo médio / plano gerado"
            value={aiCostPerPlanToday != null ? brl(aiCostPerPlanToday) : '—'}
            accent={T.gold} accentSoft={T.goldSoft}
            sub={aiCostPerPlanToday != null
              ? `${(plansGeneratedToday ?? 0).toLocaleString('pt-BR')} planos hoje · custo IA do dia ÷ planos`
              : `${(plansGeneratedToday ?? 0).toLocaleString('pt-BR')} planos gerados hoje`}
          />
          <StatCard
            icon={IconReceipt} label="IA no mês" value={brl(aiCosts.monthlyUsd * aiCosts.rate)}
            accent={T.pink} accentSoft={T.pinkSoft}
            sub={`US$ ${aiCosts.monthlyUsd.toFixed(2)}`}
          />
          <StatCard
            icon={IconChart} label="IA total (chave)" value={brl(aiCosts.totalUsd * aiCosts.rate)}
            sub={`US$ ${aiCosts.totalUsd.toFixed(2)}`}
          />
          <StatCard
            icon={IconCreditCard} label="Saldo OpenRouter"
            value={aiCosts.balanceUsd != null ? brl(aiCosts.balanceUsd * aiCosts.rate) : '—'}
            accent={T.green} accentSoft={T.greenSoft}
            valueColor={aiCosts.balanceUsd != null && aiCosts.balanceUsd < 5 ? T.danger : T.green}
            sub={aiCosts.balanceUsd != null ? `US$ ${aiCosts.balanceUsd.toFixed(2)} disponível` : 'indisponível'}
          />
        </div>

        {/* ════════════════════════════════════════════════════════ */}
        {/* SMS (Zenvia) — recuperação de PIX                          */}
        {/* ════════════════════════════════════════════════════════ */}
        <SectionHeader
          icon={IconChart}
          title="SMS (Zenvia) — recuperação de PIX"
          subtitle={`Aviso por SMS pra quem gerou PIX e não pagou · custo estimado ${brl(SMS_COST_BRL)}/SMS`}
          accent={T.blue}
        />
        <div className="dash-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          <StatCard
            icon={IconChart} label="SMS hoje" value={smsToday.toLocaleString('pt-BR')}
            accent={T.blue} accentSoft={T.blueSoft} valueColor={T.blue}
            sub={`${brl(smsToday * SMS_COST_BRL)} estimado`}
          />
          <StatCard
            icon={IconReceipt} label="SMS no mês" value={smsMonth.toLocaleString('pt-BR')}
            accent={T.pink} accentSoft={T.pinkSoft}
            sub={`${brl(smsMonth * SMS_COST_BRL)} estimado`}
          />
          <StatCard
            icon={IconMoney} label="Custo SMS no mês" value={brl(smsMonth * SMS_COST_BRL)}
            accent={T.gold} accentSoft={T.goldSoft}
            sub={`${smsMonth.toLocaleString('pt-BR')} SMS × ${brl(SMS_COST_BRL)}`}
          />
          <StatCard
            icon={IconChart} label="SMS total (histórico)" value={smsTotal.toLocaleString('pt-BR')}
            sub={`${brl(smsTotal * SMS_COST_BRL)} estimado`}
          />
        </div>
      </main>
    </div>
  );
}
