import Sidebar from './components/Sidebar';
import {
  getDashboardStats,
  getPendingPlans,
  getRecentCheckIns,
  getNewPlansByDay,
} from '../lib/queries';

export const dynamic = 'force-dynamic';

const ACCENT = '#C4607A';

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

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#C4607A,#9B4560)',
  'linear-gradient(135deg,#34C759,#28A745)',
  'linear-gradient(135deg,#007AFF,#0056CC)',
  'linear-gradient(135deg,#AF52DE,#8B3DB8)',
  'linear-gradient(135deg,#FF9500,#CC7700)',
];

function gradientForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
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

  const today = new Date();
  const todayLabel = today.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const maxCount = Math.max(1, ...byDay.map(d => d.count));

  const s = {
    page: {
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      background: '#F5F5F7',
      fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
      color: '#2D1B2E',
    } as React.CSSProperties,
    main: {
      marginLeft: 220,
      flex: 1,
      height: '100vh',
      overflowY: 'auto',
      padding: 32,
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
    } as React.CSSProperties,
  };

  return (
    <div style={s.page}>
      <Sidebar />
      <main style={s.main}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.4, margin: 0 }}>
              Bom dia, Juliane 👋
            </h1>
            <div style={{ fontSize: 13, color: '#8A8A8E', marginTop: 3, textTransform: 'capitalize' }}>
              {todayLabel}
            </div>
          </div>
          {stats.pendingPlans > 0 && (
            <a
              href="/planos"
              style={{
                background: '#fff',
                border: '1px solid #E5E5EA',
                color: '#2D1B2E',
                fontSize: 13,
                fontWeight: 500,
                padding: '8px 16px',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                textDecoration: 'none',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  background: '#FF9500',
                  borderRadius: '50%',
                  display: 'inline-block',
                }}
              />
              {stats.pendingPlans}{' '}
              {stats.pendingPlans === 1 ? 'plano' : 'planos'} para revisar
            </a>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {[
            {
              icon: '👥',
              label: 'Assinantes Ativas',
              value: stats.activeSubscribers.toLocaleString('pt-BR'),
              sub:
                stats.newSubscribersThisWeek > 0
                  ? `↑ +${stats.newSubscribersThisWeek} esta semana`
                  : 'Sem novas esta semana',
              subGreen: stats.newSubscribersThisWeek > 0,
            },
            {
              icon: '📝',
              label: 'Planos para Revisar',
              value: stats.pendingPlans.toString(),
              valueOrange: stats.pendingPlans > 0,
              sub:
                stats.pendingPlans > 0
                  ? 'Aguardando sua aprovação'
                  : 'Tudo em dia ✓',
            },
            {
              icon: '💰',
              label: 'Receita Mensal',
              value: `R$ ${stats.monthlyRevenueBrl.toLocaleString('pt-BR')}`,
              sub:
                stats.activeSubscribers > 0
                  ? `${stats.activeSubscribers} assinantes ativos`
                  : 'Sem assinaturas ativas',
            },
            {
              icon: '📊',
              label: 'Check-ins Hoje',
              value: stats.todayCheckIns.toString(),
              sub: `de ${stats.activeSubscribers.toLocaleString('pt-BR')} ativas`,
            },
          ].map((stat, i) => (
            <div
              key={i}
              style={{
                background: '#fff',
                borderRadius: 12,
                padding: 20,
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#8A8A8E',
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>{stat.icon}</span>
                {stat.label}
              </div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: stat.valueOrange ? '#FF9500' : '#2D1B2E',
                  margin: '8px 0 4px',
                  letterSpacing: -0.8,
                }}
              >
                {stat.value}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: stat.subGreen ? '#34C759' : '#8A8A8E',
                  fontWeight: stat.subGreen ? 500 : 400,
                }}
              >
                {stat.sub}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '60fr 40fr',
            gap: 16,
            alignItems: 'start',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '18px 20px 14px',
                borderBottom: '1px solid #F2F2F7',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                Planos Aguardando Revisão
              </span>
              <a
                href="/planos"
                style={{
                  fontSize: 12.5,
                  color: ACCENT,
                  textDecoration: 'none',
                  fontWeight: 500,
                }}
              >
                Ver todos →
              </a>
            </div>
            {plans.length === 0 ? (
              <div
                style={{
                  padding: 40,
                  textAlign: 'center',
                  color: '#8A8A8E',
                  fontSize: 13,
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>🎉</div>
                Nenhum plano aguardando revisão!
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Usuária', 'Tipo', 'Criado', 'Status', 'Ação'].map(h => (
                      <th
                        key={h}
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#8A8A8E',
                          textTransform: 'uppercase',
                          letterSpacing: 0.4,
                          padding: '10px 20px',
                          textAlign: 'left',
                          background: '#FAFAFA',
                          borderBottom: '1px solid #F2F2F7',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {plans.map((p, i) => (
                    <tr
                      key={p.user_id}
                      style={{ background: i % 2 === 1 ? '#FAFAFA' : 'white' }}
                    >
                      <td
                        style={{
                          padding: '11px 20px',
                          fontSize: 13,
                          fontWeight: 600,
                          borderBottom: '1px solid #F2F2F7',
                        }}
                      >
                        {p.full_name ?? p.email.split('@')[0]}
                      </td>
                      <td
                        style={{
                          padding: '11px 20px',
                          fontSize: 13,
                          borderBottom: '1px solid #F2F2F7',
                        }}
                      >
                        {p.hair_type
                          ? HAIR_TYPE_LABEL[p.hair_type] ?? p.hair_type
                          : '—'}
                      </td>
                      <td
                        style={{
                          padding: '11px 20px',
                          fontSize: 13,
                          color: '#8A8A8E',
                          borderBottom: '1px solid #F2F2F7',
                        }}
                      >
                        {formatRelativeTime(p.created_at)}
                      </td>
                      <td
                        style={{
                          padding: '11px 20px',
                          fontSize: 13,
                          borderBottom: '1px solid #F2F2F7',
                        }}
                      >
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 11.5,
                            fontWeight: 500,
                            padding: '3px 8px',
                            borderRadius: 20,
                            background: !p.approved_by_juliane
                              ? 'rgba(255,149,0,0.1)'
                              : 'rgba(52,199,89,0.1)',
                            color: !p.approved_by_juliane ? '#FF9500' : '#34C759',
                          }}
                        >
                          {!p.approved_by_juliane ? '🟡 Pendente' : '✅ Aprovado'}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: '11px 20px',
                          fontSize: 13,
                          borderBottom: '1px solid #F2F2F7',
                        }}
                      >
                        <a
                          href={`/planos?user=${p.user_id}`}
                          style={{
                            display: 'inline-block',
                            fontSize: 12,
                            fontWeight: 600,
                            padding: '5px 12px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            border: 'none',
                            textDecoration: 'none',
                            background: !p.approved_by_juliane ? ACCENT : '#F2F2F7',
                            color: !p.approved_by_juliane ? '#fff' : '#2D1B2E',
                          }}
                        >
                          {!p.approved_by_juliane ? 'Revisar' : 'Ver'}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              style={{
                background: '#fff',
                borderRadius: 12,
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '18px 20px 14px',
                  borderBottom: '1px solid #F2F2F7',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 6,
                    height: 6,
                    background: '#34C759',
                    borderRadius: '50%',
                  }}
                />
                <span style={{ fontSize: 14, fontWeight: 600 }}>
                  Check-ins Recentes
                </span>
              </div>
              {checkIns.length === 0 ? (
                <div
                  style={{
                    padding: 30,
                    textAlign: 'center',
                    color: '#8A8A8E',
                    fontSize: 13,
                  }}
                >
                  Sem check-ins recentes
                </div>
              ) : (
                checkIns.map((c, i) => (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 20px',
                      borderBottom:
                        i < checkIns.length - 1 ? '1px solid #F2F2F7' : 'none',
                    }}
                  >
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: '50%',
                        background: gradientForId(c.user_id),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#fff',
                        flexShrink: 0,
                      }}
                    >
                      {initialsFor(c.full_name).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {c.full_name ?? 'Anônima'}
                      </div>
                      <div style={{ fontSize: 11.5, color: '#8A8A8E', marginTop: 1 }}>
                        {formatRelativeTime(c.checked_at)}
                      </div>
                    </div>
                    <span style={{ fontSize: 18 }}>
                      {c.hair_feel ? HAIR_FEEL_EMOJI[c.hair_feel] ?? '✨' : '✨'}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div
              style={{
                background: '#fff',
                borderRadius: 12,
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '18px 20px 14px',
                  borderBottom: '1px solid #F2F2F7',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600 }}>
                  Cancelamentos esta semana
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '20px',
                }}
              >
                <span
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color:
                      stats.cancellationsThisWeek > 0 ? '#FF3B30' : '#34C759',
                    letterSpacing: -0.5,
                  }}
                >
                  {stats.cancellationsThisWeek}
                </span>
                <span style={{ fontSize: 13, color: '#8A8A8E' }}>
                  {stats.cancellationsThisWeek === 0
                    ? 'Tudo certo nesta semana 🎉'
                    : stats.cancellationsThisWeek === 1
                      ? 'cancelamento'
                      : 'cancelamentos'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            padding: 20,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>
            Novos planos por dia
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 12,
              height: 100,
            }}
          >
            {byDay.map((d, i) => {
              const h = d.count > 0 ? Math.max(8, (d.count / maxCount) * 80) : 4;
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: d.isToday ? ACCENT : '#2D1B2E',
                    }}
                  >
                    {d.count}
                  </div>
                  <div
                    style={{
                      width: '100%',
                      height: h,
                      background: d.count === 0 ? '#F2F2F7' : d.isToday ? 'rgba(196,96,122,0.4)' : ACCENT,
                      borderRadius: '4px 4px 0 0',
                      opacity: d.count === 0 ? 0.5 : 0.85,
                      transition: 'all 0.2s',
                    }}
                  />
                  <div
                    style={{
                      fontSize: 11,
                      color: d.isToday ? ACCENT : '#8A8A8E',
                      fontWeight: d.isToday ? 700 : 400,
                    }}
                  >
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
