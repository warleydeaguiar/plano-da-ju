import Sidebar from './components/Sidebar';
import {
  getDashboardStats,
  getPendingPlans,
  getRecentCheckIns,
  getNewPlansByDay,
} from '../lib/queries';
import { T, fonts, shadow, gradient, gradientForId } from './theme';

export const dynamic = 'force-dynamic';

const HAIR_FEEL_EMOJI: Record<string, string> = {
  muito_seco: '😣',
  seco: '🌫️',
  normal: '😊',
  oleoso: '💦',
  otimo: '✨',
};

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

export default async function DashboardPage() {
  const [stats, plans, checkIns, byDay] = await Promise.all([
    getDashboardStats(),
    getPendingPlans(8),
    getRecentCheckIns(6),
    getNewPlansByDay(),
  ]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const todayLabel = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });

  const maxCount = Math.max(1, ...byDay.map(d => d.count));

  // ── Estilos compartilhados ──────────────────────────────────────
  const card: React.CSSProperties = {
    background: T.surface,
    borderRadius: 18,
    border: `1px solid ${T.borderSoft}`,
    boxShadow: shadow.card,
    overflow: 'hidden',
  };
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

  const statCards = [
    {
      icon: '👥',
      label: 'Assinantes Ativas',
      value: stats.activeSubscribers.toLocaleString('pt-BR'),
      accent: T.pink,
      accentSoft: T.pinkSoft,
      sub: stats.newSubscribersThisWeek > 0
        ? `↑ +${stats.newSubscribersThisWeek} esta semana`
        : 'Sem novas esta semana',
      subColor: stats.newSubscribersThisWeek > 0 ? T.green : T.inkMuted,
    },
    {
      icon: '📝',
      label: 'Planos p/ Revisar',
      value: stats.pendingPlans.toString(),
      accent: T.alert,
      accentSoft: T.alertSoft,
      valueColor: stats.pendingPlans > 0 ? T.alert : T.ink,
      sub: stats.pendingPlans > 0 ? 'Aguardando aprovação' : 'Tudo em dia ✓',
      subColor: T.inkMuted,
    },
    {
      icon: '💰',
      label: 'Receita do Mês',
      value: `R$ ${stats.monthlyRevenueBrl.toLocaleString('pt-BR')}`,
      accent: T.gold,
      accentSoft: T.goldSoft,
      sub: stats.monthlyRevenueBrl > 0 ? 'confirmados neste mês' : 'sem pagamentos',
      subColor: T.inkMuted,
    },
    {
      icon: '📊',
      label: 'Check-ins Hoje',
      value: stats.todayCheckIns.toString(),
      accent: T.blue,
      accentSoft: T.blueSoft,
      sub: `de ${stats.activeSubscribers.toLocaleString('pt-BR')} ativas`,
      subColor: T.inkMuted,
    },
  ];

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
          {/* círculos decorativos */}
          <div style={{ position: 'absolute', right: -40, top: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.10)' }} />
          <div style={{ position: 'absolute', right: 60, bottom: -60, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ position: 'relative' }}>
            <h1 style={{
              fontSize: 28, fontWeight: 600, margin: 0, color: '#fff',
              fontFamily: fonts.display, letterSpacing: -0.5,
            }}>
              {greeting}, <em style={{ fontStyle: 'italic' }}>Juliane</em> 👋
            </h1>
            <div style={{
              fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 4,
              textTransform: 'capitalize', fontWeight: 500,
            }}>
              {todayLabel}
            </div>
          </div>
          {stats.pendingPlans > 0 && (
            <a href="/planos" style={{
              position: 'relative',
              background: 'rgba(255,255,255,0.18)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.25)',
              color: '#fff', fontSize: 13, fontWeight: 600,
              padding: '10px 18px', borderRadius: 99, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none',
            }}>
              <span style={{ width: 8, height: 8, background: '#fff', borderRadius: '50%', display: 'inline-block' }} />
              {stats.pendingPlans} {stats.pendingPlans === 1 ? 'plano' : 'planos'} p/ revisar →
            </a>
          )}
        </div>

        {/* ── Stat cards ──────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {statCards.map((stat, i) => (
            <div key={i} style={{ ...card, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                  background: stat.accentSoft,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18,
                }}>{stat.icon}</div>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: T.inkMuted,
                  textTransform: 'uppercase', letterSpacing: 0.6, lineHeight: 1.3,
                }}>{stat.label}</div>
              </div>
              <div style={{
                fontSize: 30, fontWeight: 700, fontFamily: fonts.display,
                color: stat.valueColor ?? T.ink, letterSpacing: -1,
                lineHeight: 1,
              }}>{stat.value}</div>
              <div style={{ fontSize: 12, color: stat.subColor, fontWeight: 500, marginTop: 6 }}>
                {stat.sub}
              </div>
            </div>
          ))}
        </div>

        {/* ── Main grid ───────────────────────────────────────────── */}
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
                <div style={{ fontSize: 30, marginBottom: 8 }}>🎉</div>
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
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99,
                          background: !p.approved_by_juliane ? T.alertSoft : T.greenSoft,
                          color: !p.approved_by_juliane ? T.alert : T.green,
                        }}>
                          {!p.approved_by_juliane ? '🟡 Pendente' : '✅ Aprovado'}
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
                checkIns.map((c, i) => (
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
                    <span style={{ fontSize: 18 }}>
                      {c.hair_feel ? HAIR_FEEL_EMOJI[c.hair_feel] ?? '✨' : '✨'}
                    </span>
                  </div>
                ))
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
                    ? 'Tudo certo nesta semana 🎉'
                    : stats.cancellationsThisWeek === 1 ? 'cancelamento' : 'cancelamentos'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Gráfico de vendas ───────────────────────────────────── */}
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
      </main>
    </div>
  );
}
