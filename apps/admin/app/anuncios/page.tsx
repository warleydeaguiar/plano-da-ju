import Sidebar from '../components/Sidebar';
import { getCreativeAnalysis, type CreativePeriod, type CreativeRow } from '../../lib/meta-ads-creatives';
import { T, fonts, shadow, gradient } from '../theme';
import {
  IconMegaphone, IconMoney, IconBag, IconTarget, IconChart, IconWarning,
  IconCursor, IconArrowRight,
} from '../icons';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Anúncios — Admin Plano da Ju' };

type SortKey = 'spend' | 'roas' | 'cpp' | 'hook' | 'purchases';

function brl(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function intStr(v: number) { return v.toLocaleString('pt-BR'); }
function kStr(v: number) {
  return v >= 1000 ? `${(v / 1000).toFixed(1).replace('.', ',')}k` : String(v);
}

const PERIODS: { key: CreativePeriod; label: string }[] = [
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
  { key: '90d', label: '90 dias' },
];
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'spend', label: 'Investimento' },
  { key: 'roas', label: 'ROAS' },
  { key: 'cpp', label: 'Custo/compra' },
  { key: 'purchases', label: 'Compras' },
  { key: 'hook', label: 'Hook rate' },
];

function sortCreatives(list: CreativeRow[], key: SortKey): CreativeRow[] {
  const arr = [...list];
  switch (key) {
    case 'roas':      return arr.sort((a, b) => (b.roas ?? -1) - (a.roas ?? -1));
    case 'cpp':       return arr.sort((a, b) => (a.cost_per_purchase ?? Infinity) - (b.cost_per_purchase ?? Infinity));
    case 'purchases': return arr.sort((a, b) => b.purchases - a.purchases);
    case 'hook':      return arr.sort((a, b) => (b.hook_rate ?? -1) - (a.hook_rate ?? -1));
    case 'spend':
    default:          return arr.sort((a, b) => b.spend - a.spend);
  }
}

export default async function AnunciosPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const period: CreativePeriod = (['7d', '30d', '90d'].includes(sp.period ?? '') ? sp.period : '30d') as CreativePeriod;
  const sort: SortKey = (['spend', 'roas', 'cpp', 'hook', 'purchases'].includes(sp.sort ?? '') ? sp.sort : 'spend') as SortKey;

  const data = await getCreativeAnalysis(period);
  const creatives = sortCreatives(data.creatives, sort);

  const card: React.CSSProperties = {
    background: T.surface, borderRadius: 18, border: `1px solid ${T.borderSoft}`,
    boxShadow: shadow.card, overflow: 'hidden',
  };
  const pill = (active: boolean): React.CSSProperties => ({
    padding: '7px 16px', borderRadius: 99, fontSize: 13, fontWeight: 600,
    textDecoration: 'none', transition: 'all 0.15s',
    background: active ? gradient.heroSoft : T.surface,
    color: active ? '#fff' : T.inkSoft,
    border: active ? 'none' : `1px solid ${T.borderSoft}`,
    boxShadow: active ? '0 3px 10px rgba(190,24,93,0.22)' : 'none',
  });

  const statCards = [
    { icon: IconMegaphone, label: 'Criativos ativos', value: intStr(data.activeCount), sub: 'com investimento', accent: T.pink, accentSoft: T.pinkSoft },
    { icon: IconTarget, label: 'Melhor custo/compra', value: data.bestCpp !== null ? brl(data.bestCpp) : '—', sub: 'menor CPP', accent: T.green, accentSoft: T.greenSoft, valueColor: T.green },
    { icon: IconBag, label: 'Total de compras', value: intStr(data.totalPurchases), sub: 'no período', accent: T.gold, accentSoft: T.goldSoft },
    { icon: IconMoney, label: 'Total investido', value: brl(data.totalSpend), sub: 'no período', accent: T.blue, accentSoft: T.blueSoft },
  ];

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: T.bg, fontFamily: fonts.ui, color: T.ink }}>
      <Sidebar />
      <main style={{ marginLeft: 234, flex: 1, height: '100vh', overflowY: 'auto', padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 600, fontFamily: fonts.display, letterSpacing: -0.5, display: 'flex', alignItems: 'center', gap: 10 }}>
              <IconMegaphone size={26} color={T.pinkDeep} /> Análise de Criativos
            </div>
            <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 4 }}>
              Performance por criativo · Meta Ads
              {data.status === 'ok' && (
                <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: T.greenSoft, color: T.green }}>● ao vivo</span>
              )}
            </div>
          </div>
          {/* Período */}
          <div style={{ display: 'flex', gap: 8 }}>
            {PERIODS.map(p => (
              <a key={p.key} href={`/anuncios?period=${p.key}&sort=${sort}`} style={pill(p.key === period)}>{p.label}</a>
            ))}
          </div>
        </div>

        {data.status === 'not_configured' && (
          <div style={{ ...card, padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'center', borderLeft: `4px solid ${T.alert}` }}>
            <IconWarning size={22} color={T.alert} />
            <div style={{ fontSize: 13, color: T.inkSoft }}>Meta Ads não configurado — defina <code>META_ADS_QUIZ_TOKEN</code> no Vercel.</div>
          </div>
        )}
        {data.status === 'error' && (
          <div style={{ ...card, padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'center', borderLeft: `4px solid ${T.danger}` }}>
            <IconWarning size={22} color={T.danger} />
            <div style={{ fontSize: 13, color: T.inkSoft }}>Erro ao buscar dados do Meta: {data.error}</div>
          </div>
        )}

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {statCards.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} style={{ ...card, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: s.accentSoft, color: s.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={20} />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.inkMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>{s.label}</div>
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: fonts.display, color: s.valueColor ?? T.ink, letterSpacing: -1, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 12, color: T.inkMuted, marginTop: 6 }}>{s.sub}</div>
              </div>
            );
          })}
        </div>

        {/* Ordenar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: T.inkMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Ordenar por</span>
          {SORTS.map(s => (
            <a key={s.key} href={`/anuncios?period=${period}&sort=${s.key}`} style={{
              ...pill(s.key === sort), padding: '5px 13px', fontSize: 12.5,
            }}>{s.label}</a>
          ))}
        </div>

        {/* Cards de criativos */}
        {data.status === 'ok' && creatives.length === 0 ? (
          <div style={{ ...card, padding: 44, textAlign: 'center', color: T.inkMuted, fontSize: 14 }}>
            Nenhum criativo com investimento nesse período.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
            {creatives.map((c, i) => (
              <CreativeCard key={c.ad_id} c={c} rank={i + 1} card={card} />
            ))}
          </div>
        )}
        <div style={{ height: 20 }} />
      </main>
    </div>
  );
}

function CreativeCard({ c, rank, card }: { c: CreativeRow; rank: number; card: React.CSSProperties }) {
  const hasConv = c.purchases > 0;
  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column' }}>
      {/* Thumbnail */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '1.4', background: T.cream, overflow: 'hidden' }}>
        {c.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.thumbnail_url} alt={c.ad_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.inkMuted }}>
            <IconMegaphone size={32} />
          </div>
        )}
        <div style={{
          position: 'absolute', top: 10, left: 10,
          background: rank <= 3 ? gradient.hero : 'rgba(42,30,44,0.7)',
          color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: fonts.display,
          width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>#{rank}</div>
      </div>

      {/* Body */}
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, lineHeight: 1.3, minHeight: 36, overflow: 'hidden' }}>
          {c.ad_name}
        </div>
        {c.campaign_name && (
          <div style={{ fontSize: 10.5, fontWeight: 600, color: T.pinkDeep, background: T.pinkSoft, padding: '3px 8px', borderRadius: 6, alignSelf: 'flex-start', maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {c.campaign_name}
          </div>
        )}

        {/* Métricas principais: investimento + compras/CPP/ROAS */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Metric label="Investimento" value={brl(c.spend)} />
          {hasConv ? (
            <Metric label="Custo/compra" value={c.cost_per_purchase !== null ? brl(c.cost_per_purchase) : '—'} color={T.green} />
          ) : (
            <Metric label="Conversões" value="—" sub="sem compras" />
          )}
          <Metric label="Compras" value={intStr(c.purchases)} />
          <Metric label="ROAS" value={c.roas !== null ? `${c.roas.toFixed(2)}x` : '—'} color={c.roas !== null && c.roas >= 1 ? T.green : c.roas !== null ? T.danger : undefined} />
        </div>

        {/* Barras: CPM / CTR / Hook */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 2 }}>
          <Bar label="Impressões" valueText={kStr(c.impressions)} icon={IconChart} />
          <Bar label="CTR" valueText={c.ctr !== null ? `${c.ctr.toFixed(2)}%` : '—'} icon={IconCursor} pct={c.ctr ? Math.min(100, c.ctr * 25) : 0} good />
          {c.hook_rate !== null && (
            <Bar label="Hook rate" valueText={`${c.hook_rate.toFixed(1)}%`} pct={Math.min(100, c.hook_rate)} good />
          )}
          <Bar label="CPM" valueText={c.cpm !== null ? brl(c.cpm) : '—'} warn />
        </div>

        {c.instagram_url && (
          <a href={c.instagram_url} target="_blank" rel="noopener noreferrer" style={{
            marginTop: 'auto', fontSize: 12, fontWeight: 600, color: T.pinkDeep,
            textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>
            Ver no Instagram <IconArrowRight size={13} />
          </a>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: T.inkMuted, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, fontFamily: fonts.display, color: color ?? T.ink, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: T.inkMuted }}>{sub}</div>}
    </div>
  );
}

function Bar({ label, valueText, pct, good, warn }: {
  label: string; valueText: string; pct?: number; good?: boolean; warn?: boolean;
  icon?: React.ComponentType<{ size?: number; color?: string }>;
}) {
  const barColor = good ? T.green : warn ? T.gold : T.pink;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
      <span style={{ color: T.inkMuted, width: 78, flexShrink: 0 }}>{label}</span>
      {pct !== undefined ? (
        <div style={{ flex: 1, height: 5, borderRadius: 99, background: T.borderSoft, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 99 }} />
        </div>
      ) : <div style={{ flex: 1 }} />}
      <span style={{ fontWeight: 700, color: warn ? T.goldDeep : good ? T.green : T.ink, flexShrink: 0 }}>{valueText}</span>
    </div>
  );
}
