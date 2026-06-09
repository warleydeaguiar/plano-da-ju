import Sidebar from '../components/Sidebar';
import { T, fonts } from '../theme';
import { createAdminClient } from '../../lib/supabase';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Erros do Sistema — Admin Plano da Ju' };

const card: React.CSSProperties = {
  background: T.surface, borderRadius: 14, border: `1px solid ${T.borderSoft}`, flexShrink: 0,
};

const sevColor: Record<string, string> = { critical: '#B91C1C', error: '#BE185D', warning: '#B45309' };

function ago(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default async function ErrosPage() {
  const sb = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb.from('app_errors') as any)
    .select('id, route, severity, message, email, context, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const errs = (data ?? []) as any[];

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: T.bg, fontFamily: fonts.ui, color: T.ink }}>
      <Sidebar />
      <main className="dash-main" style={{ marginLeft: 234, flex: 1, height: '100vh', overflowY: 'auto', padding: 32 }}>
        <div style={{ marginBottom: 6, fontSize: 26, fontWeight: 800, fontFamily: fonts.display }}>🐞 Erros do Sistema</div>
        <div style={{ fontSize: 13.5, color: T.inkSoft, marginBottom: 22 }}>
          Erros de servidor capturados (geração de plano, fotos, perfil…). Os 100 mais recentes.
          {' '}Para erros de pagamento/checkout, veja <strong>Checkout → Erros</strong>.
        </div>

        {errs.length === 0 && (
          <div style={{ ...card, padding: 28, textAlign: 'center', color: T.inkSoft }}>
            🎉 Nenhum erro registrado. (Se algo falhar no servidor, aparece aqui com rota, mensagem e contexto.)
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {errs.map((e) => (
            <div key={e.id} style={{ ...card, padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: '#fff', background: sevColor[e.severity] ?? T.pinkDeep, padding: '2px 8px', borderRadius: 6 }}>
                  {e.severity}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.ink, fontFamily: 'monospace' }}>{e.route}</span>
                {e.email && <span style={{ fontSize: 12, color: T.inkSoft }}>· {e.email}</span>}
                <span style={{ marginLeft: 'auto', fontSize: 11.5, color: T.inkMuted }}>{ago(e.created_at)} atrás</span>
              </div>
              <div style={{ fontSize: 13, color: T.ink, marginTop: 8, fontFamily: 'monospace', wordBreak: 'break-word' }}>{e.message ?? '(sem mensagem)'}</div>
              {e.context?.impact && (
                <div style={{ fontSize: 12, color: '#B91C1C', marginTop: 6 }}>⚠️ {e.context.impact}</div>
              )}
              {e.context && Object.keys(e.context).filter(k => !['impact', 'at'].includes(k)).length > 0 && (
                <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 6, fontFamily: 'monospace' }}>
                  {Object.entries(e.context).filter(([k]) => !['impact', 'at'].includes(k)).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ')}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
