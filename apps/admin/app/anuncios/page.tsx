import Sidebar from '../components/Sidebar';
import { getCreativeAnalysis, type CreativePeriod, type CreativeRow } from '../../lib/meta-ads-creatives';
import { getCapiHealth, type CapiHealth } from '../../lib/capi-health';
import { T, fonts, shadow, gradient } from '../theme';
import {
  IconMegaphone, IconMoney, IconBag, IconTarget, IconWarning,
  IconCursor, IconArrowRight, IconUsers, IconBolt,
} from '../icons';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Anúncios — Admin Plano da Ju' };

type SortKey = 'spend' | 'roas' | 'cpp' | 'hook' | 'purchases';
type IconType = React.ComponentType<{ size?: number; color?: string }>;

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

const cardStyle: React.CSSProperties = {
  background: T.surface, borderRadius: 18, border: `1px solid ${T.borderSoft}`,
  boxShadow: shadow.card, overflow: 'hidden',
};

export default async function AnunciosPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const period: CreativePeriod = (['7d', '30d', '90d'].includes(sp.period ?? '') ? sp.period : '30d') as CreativePeriod;
  const sort: SortKey = (['spend', 'roas', 'cpp', 'hook', 'purchases'].includes(sp.sort ?? '') ? sp.sort : 'spend') as SortKey;

  const data = await getCreativeAnalysis(period);
  const capi = await getCapiHealth();
  const compras = sortCreatives(data.creatives.filter(c => c.campaign_type === 'compras'), sort);
  const leads   = sortCreatives(data.creatives.filter(c => c.campaign_type === 'leads'), sort);

  const pill = (active: boolean): React.CSSProperties => ({
    padding: '7px 16px', borderRadius: 99, fontSize: 13, fontWeight: 600,
    textDecoration: 'none', transition: 'all 0.15s',
    background: active ? gradient.heroSoft : T.surface,
    color: active ? '#fff' : T.inkSoft,
    border: active ? 'none' : `1px solid ${T.borderSoft}`,
    boxShadow: active ? '0 3px 10px rgba(190,24,93,0.22)' : 'none',
  });

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: T.bg, fontFamily: fonts.ui, color: T.ink }}>
      <Sidebar />
      <main style={{ marginLeft: 234, flex: 1, height: '100vh', overflowY: 'auto', padding: 32, display: 'flex', flexDirection: 'column', gap: 22 }}>
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
          <div style={{ display: 'flex', gap: 8 }}>
            {PERIODS.map(p => (
              <a key={p.key} href={`/anuncios?period=${p.key}&sort=${sort}`} style={pill(p.key === period)}>{p.label}</a>
            ))}
          </div>
        </div>

        {/* ── Sinal de Compra (Pixel + CAPI) ── */}
        {!('error' in capi) && <CapiHealthCard h={capi} />}

        {data.status === 'not_configured' && (
          <div style={{ ...cardStyle, padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'center', borderLeft: `4px solid ${T.alert}` }}>
            <IconWarning size={22} color={T.alert} />
            <div style={{ fontSize: 13, color: T.inkSoft }}>Meta Ads não configurado — defina <code>META_ADS_QUIZ_TOKEN</code> no Vercel.</div>
          </div>
        )}
        {data.status === 'error' && (
          <div style={{ ...cardStyle, padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'center', borderLeft: `4px solid ${T.danger}` }}>
            <IconWarning size={22} color={T.danger} />
            <div style={{ fontSize: 13, color: T.inkSoft }}>Erro ao buscar dados do Meta: {data.error}</div>
          </div>
        )}

        {/* Ordenar (global) */}
        {data.status === 'ok' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: T.inkMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Ordenar por</span>
            {SORTS.map(s => (
              <a key={s.key} href={`/anuncios?period=${period}&sort=${s.key}`} style={{ ...pill(s.key === sort), padding: '5px 13px', fontSize: 12.5 }}>{s.label}</a>
            ))}
          </div>
        )}

        {/* ── SEÇÃO 1: COMPRAS (campanhas 'plano') ── */}
        <Section
          icon={IconBag} accent={T.pink} accentSoft={T.pinkSoft}
          title="Anúncios de Compras" subtitle="Campanhas de venda do plano (com 'plano' no nome)"
          mode="compras" creatives={compras} show={data.status === 'ok'}
        />

        {/* ── SEÇÃO 2: LEADS (campanhas 'grupos') ── */}
        <Section
          icon={IconUsers} accent={T.blue} accentSoft={T.blueSoft}
          title="Anúncios de Leads" subtitle="Campanhas de cadastro nos grupos (com 'grupos' no nome)"
          mode="leads" creatives={leads} show={data.status === 'ok'}
        />
        <div style={{ height: 12 }} />
      </main>
    </div>
  );
}

// ─── Sinal de Compra (Pixel + CAPI) ─────────────────────────────────
function CapiHealthCard({ h }: { h: CapiHealth }) {
  const cfg = {
    ok:      { color: T.green,  bg: T.greenSoft, label: 'Sinal ativo',  dot: '● ao vivo' },
    warn:    { color: T.gold,   bg: '#FBF3E2',   label: 'Atenção',      dot: '● atrasado' },
    down:    { color: T.danger, bg: '#FBE9EC',   label: 'Sem sinal',    dot: '● parado' },
    unknown: { color: T.inkMuted, bg: T.cream,   label: 'Sem dados',    dot: '○' },
  }[h.status];

  const lastTxt = h.hoursSinceLastPurchase === null
    ? 'nenhuma compra registrada ainda'
    : h.hoursSinceLastPurchase < 1 ? 'há menos de 1h'
    : h.hoursSinceLastPurchase < 48 ? `há ${h.hoursSinceLastPurchase}h`
    : `há ${Math.floor(h.hoursSinceLastPurchase / 24)} dias`;

  const total30 = h.sent30d + h.error30d;
  const successRate = total30 > 0 ? Math.round((h.sent30d / total30) * 100) : null;
  const maxBar = Math.max(1, ...h.daily14d.map(d => d.purchases));
  const gradeColor = h.matchGrade === 'Ótima' ? T.green : h.matchGrade === 'Boa' ? T.gold : T.danger;

  const tile = (label: string, value: string, sub: string, color?: string): React.ReactNode => (
    <div style={{ ...cardStyle, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: T.inkMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color ?? T.ink, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>{sub}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ ...cardStyle, padding: '14px 18px', borderLeft: `4px solid ${cfg.color}`, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: cfg.color + '15', color: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <IconBolt size={22} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.ink, display: 'flex', alignItems: 'center', gap: 10 }}>
            Sinal de Compra · Pixel + CAPI
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: cfg.bg, color: cfg.color }}>{cfg.dot} {cfg.label}</span>
          </div>
          <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 3 }}>
            Compra server-side enviada à Meta · última {lastTxt}
          </div>
        </div>
      </div>

      {/* Alerta quando sem sinal */}
      {h.status !== 'ok' && (
        <div style={{ ...cardStyle, padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'flex-start', borderLeft: `4px solid ${cfg.color}` }}>
          <IconWarning size={20} color={cfg.color} />
          <div style={{ fontSize: 12.5, color: T.inkSoft, lineHeight: 1.5 }}>
            {!h.configured
              ? 'Nenhum evento de Compra foi enviado pelo servidor ainda (token do CAPI ausente ou nunca disparou). Sem isso, a Meta não otimiza a campanha para quem compra.'
              : h.status === 'down'
                ? 'Faz mais de 3 dias sem nenhuma Compra pelo servidor. Pode ser queda de vendas OU o sinal quebrou — verifique vendas reais e o token META_CAPI_ACCESS_TOKEN.'
                : 'Última Compra pelo servidor há mais de 24h. Se está vendendo normalmente, o sinal pode estar falhando.'}
          </div>
        </div>
      )}

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        {tile('Compras hoje', intStr(h.purchasesToday), 'enviadas à Meta', h.purchasesToday > 0 ? T.green : T.inkMuted)}
        {tile('Últimos 7 dias', intStr(h.purchases7d), 'compras server-side')}
        {tile('Últimos 30 dias', intStr(h.purchases30d), 'compras server-side')}
        {tile('Taxa de sucesso', successRate !== null ? `${successRate}%` : '—',
          `${intStr(h.sent30d)} ok · ${intStr(h.error30d)} erro${h.skipped30d ? ` · ${intStr(h.skipped30d)} skip` : ''}`,
          successRate !== null && successRate < 95 ? T.danger : T.ink)}
      </div>

      {/* Qualidade da correspondência + gráfico 14d */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Match quality */}
        <div style={{ ...cardStyle, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>Qualidade da correspondência</div>
            <span style={{ fontSize: 11, color: T.inkMuted }}>proxy da EMQ · Compras 30d</span>
          </div>
          {h.matchScore === null ? (
            <div style={{ fontSize: 12.5, color: T.inkSoft }}>Sem compras enviadas nos últimos 30 dias para medir.</div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontSize: 34, fontWeight: 800, color: gradeColor, fontFamily: fonts.display }}>{h.matchScore}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: gradeColor }}>{h.matchGrade}</span>
                <span style={{ fontSize: 12, color: T.inkSoft, marginLeft: 'auto' }}>~{(h.avgFields ?? 0).toFixed(1)} dados/evento</span>
              </div>
              <div style={{ height: 8, borderRadius: 99, background: T.cream, marginTop: 10, overflow: 'hidden' }}>
                <div style={{ width: `${h.matchScore}%`, height: '100%', background: gradeColor, borderRadius: 99 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '6px 16px', marginTop: 14, fontSize: 12 }}>
                {[
                  ['E-mail', h.pctEmail], ['Telefone', h.pctPhone],
                  ['Clique do anúncio (fbc)', h.pctFbc], ['Cookie Pixel (fbp)', h.pctFbp],
                ].map(([lab, v]) => (
                  <div key={lab as string} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ color: T.inkSoft }}>{lab as string}</span>
                    <span style={{ fontWeight: 700, color: (v as number) >= 0.8 ? T.green : (v as number) >= 0.4 ? T.gold : T.danger }}>
                      {Math.round((v as number) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Gráfico 14d */}
        <div style={{ ...cardStyle, padding: '16px 18px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 14 }}>Compras pelo servidor · 14 dias</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 92 }}>
            {h.daily14d.map((d, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: 9.5, color: T.inkMuted, fontWeight: 600 }}>{d.purchases || ''}</div>
                <div style={{
                  width: '100%', borderRadius: 4,
                  height: `${Math.max(d.purchases > 0 ? 6 : 2, (d.purchases / maxBar) * 70)}px`,
                  background: d.purchases > 0 ? T.pink : T.borderSoft,
                }} />
                <div style={{ fontSize: 9, color: T.inkMuted }}>{d.day.slice(8)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Seção (compras ou leads) ───────────────────────────────────────
function Section({ icon: Icon, accent, accentSoft, title, subtitle, mode, creatives, show }: {
  icon: IconType; accent: string; accentSoft: string; title: string; subtitle: string;
  mode: 'compras' | 'leads'; creatives: CreativeRow[]; show: boolean;
}) {
  if (!show) return null;

  const totalSpend = creatives.reduce((s, c) => s + c.spend, 0);

  // Stat cards específicos por modo
  let stats: { icon: IconType; label: string; value: string; sub: string; color?: string }[];
  if (mode === 'compras') {
    const totalPurchases = creatives.reduce((s, c) => s + c.purchases, 0);
    const cpps = creatives.map(c => c.cost_per_purchase).filter((v): v is number => v !== null);
    const bestCpp = cpps.length ? Math.min(...cpps) : null;
    stats = [
      { icon: IconMegaphone, label: 'Criativos', value: intStr(creatives.length), sub: 'com investimento' },
      { icon: IconBag, label: 'Compras', value: intStr(totalPurchases), sub: 'no período', color: T.green },
      { icon: IconTarget, label: 'Melhor custo/compra', value: bestCpp !== null ? brl(bestCpp) : '—', sub: 'menor CPP', color: T.green },
      { icon: IconMoney, label: 'Investido', value: brl(totalSpend), sub: 'no período' },
    ];
  } else {
    const totalClicks = creatives.reduce((s, c) => s + c.link_clicks, 0);
    const cpcs = creatives.map(c => c.cost_per_link_click).filter((v): v is number => v !== null);
    const bestCpc = cpcs.length ? Math.min(...cpcs) : null;
    stats = [
      { icon: IconMegaphone, label: 'Criativos', value: intStr(creatives.length), sub: 'com investimento' },
      { icon: IconCursor, label: 'Cliques no link', value: intStr(totalClicks), sub: 'no período', color: T.blue },
      { icon: IconTarget, label: 'Melhor custo/clique', value: bestCpc !== null ? brl(bestCpc) : '—', sub: 'menor CPC' },
      { icon: IconMoney, label: 'Investido', value: brl(totalSpend), sub: 'no período' },
    ];
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Section header */}
      <div style={{ ...cardStyle, padding: '14px 18px', borderLeft: `4px solid ${accent}`, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: accent + '15', color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={22} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.ink }}>{title}</div>
          <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>{subtitle}</div>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        {stats.map((s, i) => {
          const SIcon = s.icon;
          return (
            <div key={i} style={{ ...cardStyle, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: accentSoft, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <SIcon size={18} />
                </div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: T.inkMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: fonts.display, color: s.color ?? T.ink, letterSpacing: -0.8, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11.5, color: T.inkMuted, marginTop: 5 }}>{s.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Cards de criativos */}
      {creatives.length === 0 ? (
        <div style={{ ...cardStyle, padding: 36, textAlign: 'center', color: T.inkMuted, fontSize: 14 }}>
          Nenhum criativo com investimento nesse período.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {creatives.map((c, i) => <CreativeCard key={c.ad_id} c={c} rank={i + 1} mode={mode} accent={accent} />)}
        </div>
      )}
    </div>
  );
}

function CreativeCard({ c, rank, mode, accent }: { c: CreativeRow; rank: number; mode: 'compras' | 'leads'; accent: string }) {
  const hasConv = c.purchases > 0;
  return (
    <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column' }}>
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

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, lineHeight: 1.3, minHeight: 36, overflow: 'hidden' }}>{c.ad_name}</div>
        {c.campaign_name && (
          <div style={{ fontSize: 10.5, fontWeight: 600, color: accent, background: accent + '15', padding: '3px 8px', borderRadius: 6, alignSelf: 'flex-start', maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {c.campaign_name}
          </div>
        )}

        {/* Métricas principais — diferem por modo */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Metric label="Investimento" value={brl(c.spend)} />
          {mode === 'compras' ? (
            <>
              {hasConv
                ? <Metric label="Custo/compra" value={c.cost_per_purchase !== null ? brl(c.cost_per_purchase) : '—'} color={T.green} />
                : <Metric label="Conversões" value="—" sub="sem compras" />}
              <Metric label="Compras" value={intStr(c.purchases)} />
              <Metric label="ROAS" value={c.roas !== null ? `${c.roas.toFixed(2)}x` : '—'} color={c.roas !== null && c.roas >= 1 ? T.green : c.roas !== null ? T.danger : undefined} />
            </>
          ) : (
            <>
              <Metric label="Custo/clique" value={c.cost_per_link_click !== null ? brl(c.cost_per_link_click) : '—'} color={T.blue} />
              <Metric label="Cliques no link" value={intStr(c.link_clicks)} />
              <Metric label="Visitas à página" value={intStr(c.landing_page_views)} />
            </>
          )}
        </div>

        {/* Barras */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 2 }}>
          <Bar label="Impressões" valueText={kStr(c.impressions)} />
          <Bar label="CTR" valueText={c.ctr !== null ? `${c.ctr.toFixed(2)}%` : '—'} pct={c.ctr ? Math.min(100, c.ctr * 25) : 0} good />
          {c.hook_rate !== null && (
            <Bar label="Hook rate" valueText={`${c.hook_rate.toFixed(1)}%`} pct={Math.min(100, c.hook_rate)} good />
          )}
          <Bar label="CPM" valueText={c.cpm !== null ? brl(c.cpm) : '—'} warn />
        </div>

        {c.instagram_url && (
          <a href={c.instagram_url} target="_blank" rel="noopener noreferrer" style={{ marginTop: 'auto', fontSize: 12, fontWeight: 600, color: T.pinkDeep, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
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

function Bar({ label, valueText, pct, good, warn }: { label: string; valueText: string; pct?: number; good?: boolean; warn?: boolean }) {
  const barColor = good ? T.green : warn ? T.gold : T.pink;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
      <span style={{ color: T.inkMuted, width: 84, flexShrink: 0 }}>{label}</span>
      {pct !== undefined ? (
        <div style={{ flex: 1, height: 5, borderRadius: 99, background: T.borderSoft, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 99 }} />
        </div>
      ) : <div style={{ flex: 1 }} />}
      <span style={{ fontWeight: 700, color: warn ? T.goldDeep : good ? T.green : T.ink, flexShrink: 0 }}>{valueText}</span>
    </div>
  );
}
