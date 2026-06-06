import Sidebar from '../components/Sidebar';
import { T, fonts } from '../theme';
import { isConnected, gaConfigured, fetchSummary, disconnect, GA_PROPERTY_ID, type GaSummary } from '../../lib/analytics';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const card: React.CSSProperties = {
  background: T.surface, borderRadius: 16, border: `1px solid ${T.borderSoft}`,
  boxShadow: '0 1px 3px rgba(42,30,44,0.06)', flexShrink: 0,
};

function fmt(n: number) { return n.toLocaleString('pt-BR'); }

// Server action: desconectar
async function doDisconnect() {
  'use server';
  await disconnect();
  redirect('/analytics');
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const configured = gaConfigured();
  const connected = configured && (await isConnected());
  let summary: GaSummary | null = null;
  let fetchErr = '';
  if (connected) {
    try { summary = await fetchSummary(28); }
    catch (e) { fetchErr = String(e).slice(0, 300); }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: T.bg, fontFamily: fonts.ui, color: T.ink }}>
      <Sidebar />
      <main className="dash-main" style={{ marginLeft: 234, flex: 1, height: '100vh', overflowY: 'auto', padding: 32, display: 'flex', flexDirection: 'column', gap: 22 }}>
        {/* Header */}
        <div>
          <div style={{ fontSize: 26, fontWeight: 800, fontFamily: fonts.display, color: T.ink }}>📈 Google Analytics</div>
          <div style={{ fontSize: 13.5, color: T.inkSoft, marginTop: 4 }}>
            Métricas de tráfego do site (GA4 · propriedade {GA_PROPERTY_ID}) — últimos 28 dias.
          </div>
        </div>

        {sp.conectado === '1' && (
          <div style={{ ...card, padding: 14, background: T.greenSoft, color: T.green, fontWeight: 600 }}>✓ Conectado ao Google Analytics com sucesso!</div>
        )}
        {sp.erro && (
          <div style={{ ...card, padding: 14, background: '#FDECEC', color: T.danger, fontWeight: 600 }}>
            Não foi possível conectar ({sp.erro}). Tente novamente.
          </div>
        )}

        {!configured && (
          <div style={{ ...card, padding: 22 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Integração não configurada</div>
            <div style={{ fontSize: 13.5, color: T.inkSoft }}>Faltam as credenciais OAuth do Google no servidor (GOOGLE_ANALYTICS_CLIENT_ID/SECRET).</div>
          </div>
        )}

        {/* Desconectado → botão Integrar */}
        {configured && !connected && (
          <div style={{ ...card, padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📊</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: fonts.display }}>Conecte o Google Analytics</div>
            <div style={{ fontSize: 13.5, color: T.inkSoft, margin: '8px auto 20px', maxWidth: 420, lineHeight: 1.5 }}>
              Clique em integrar, faça login na sua conta Google e autorize o acesso de leitura.
              As métricas do site aparecem aqui automaticamente.
            </div>
            <a href="/api/analytics/auth" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none',
              background: T.pinkDeep, color: '#fff', fontWeight: 700, fontSize: 14.5,
              padding: '12px 24px', borderRadius: 12,
            }}>
              🔗 Integrar com Google Analytics
            </a>
          </div>
        )}

        {/* Conectado → métricas */}
        {connected && fetchErr && (
          <div style={{ ...card, padding: 18, background: '#FDECEC', color: T.danger }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Erro ao buscar métricas</div>
            <div style={{ fontSize: 12.5, fontFamily: 'monospace', wordBreak: 'break-all' }}>{fetchErr}</div>
          </div>
        )}

        {connected && summary && (
          <>
            {/* Totais */}
            <div className="dash-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
              {[
                { label: 'Usuários ativos', value: summary.totals.activeUsers, color: T.pinkDeep },
                { label: 'Sessões', value: summary.totals.sessions, color: T.blue },
                { label: 'Visualizações', value: summary.totals.pageViews, color: T.ink },
                { label: 'Conversões', value: summary.totals.conversions, color: T.green },
              ].map(m => (
                <div key={m.label} style={{ ...card, padding: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.inkMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>{m.label}</div>
                  <div style={{ fontSize: 30, fontWeight: 800, fontFamily: fonts.display, color: m.color, marginTop: 6 }}>{fmt(m.value)}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Canais */}
              <div style={{ ...card, padding: 22 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Sessões por canal</div>
                {summary.channels.length === 0 && <div style={{ fontSize: 13, color: T.inkMuted }}>Sem dados.</div>}
                {summary.channels.map(c => (
                  <div key={c.channel} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${T.borderSoft}`, fontSize: 13.5 }}>
                    <span style={{ color: T.ink }}>{c.channel}</span>
                    <span style={{ color: T.inkSoft }}><strong style={{ color: T.ink }}>{fmt(c.sessions)}</strong> sessões · {fmt(c.users)} usuários</span>
                  </div>
                ))}
              </div>

              {/* Top páginas */}
              <div style={{ ...card, padding: 22 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Páginas mais vistas</div>
                {summary.topPages.length === 0 && <div style={{ fontSize: 13, color: T.inkMuted }}>Sem dados.</div>}
                {summary.topPages.map(p => (
                  <div key={p.path} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: `1px solid ${T.borderSoft}`, fontSize: 13 }}>
                    <span style={{ color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.path}</span>
                    <strong style={{ color: T.pinkDeep, flexShrink: 0 }}>{fmt(p.views)}</strong>
                  </div>
                ))}
              </div>
            </div>

            {/* Rodapé: status + desconectar */}
            <form action={doDisconnect}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...card, padding: '12px 18px' }}>
                <span style={{ fontSize: 12.5, color: T.green, fontWeight: 600 }}>✓ Conectado ao Google Analytics</span>
                <button type="submit" style={{ background: 'transparent', border: `1px solid ${T.border}`, color: T.inkSoft, fontSize: 12.5, padding: '6px 14px', borderRadius: 8, cursor: 'pointer' }}>
                  Desconectar
                </button>
              </div>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
