import { createAdminClient } from '../../lib/supabase';
import Sidebar from '../components/Sidebar';
import { T, fonts, shadow } from '../theme';
import { IconWarning, IconCreditCard, IconBolt, IconClock } from '../icons';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Erros de Checkout — Admin Plano da Ju' };

type ErrEvent = {
  id: string;
  email: string | null;
  payment_type: string | null;
  created_at: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: any;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

export default async function ErrosPage() {
  const sb = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb.from('checkout_events') as any)
    .select('id, email, payment_type, created_at, metadata')
    .eq('event_type', 'checkout_error')
    .order('created_at', { ascending: false })
    .limit(100);

  const errors = (data ?? []) as ErrEvent[];

  // Contagem nas últimas 24h
  const since = Date.now() - 86400_000;
  const last24 = errors.filter(e => new Date(e.created_at).getTime() > since).length;
  const cardErrs = errors.filter(e => e.payment_type === 'card').length;
  const pixErrs = errors.filter(e => e.payment_type === 'pix').length;

  const card: React.CSSProperties = {
    background: T.surface, borderRadius: 18, border: `1px solid ${T.borderSoft}`,
    boxShadow: shadow.card, overflow: 'hidden',
  };

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: T.bg, fontFamily: fonts.ui, color: T.ink,
    }}>
      <Sidebar />
      <main style={{ marginLeft: 234, flex: 1, height: '100vh', overflowY: 'auto', padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header */}
        <div>
          <div style={{ fontSize: 24, fontWeight: 600, fontFamily: fonts.display, letterSpacing: -0.5, display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconWarning size={26} color={T.alert} /> Erros de Checkout
          </div>
          <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 4 }}>
            Falhas registradas no checkout (cartão e PIX), com o detalhe do erro da PagarMe.
          </div>
        </div>

        {/* Resumo */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {[
            { icon: IconClock, label: 'Últimas 24h', value: last24, accent: T.alert, accentSoft: T.alertSoft },
            { icon: IconCreditCard, label: 'Cartão (100 últimos)', value: cardErrs, accent: T.pink, accentSoft: T.pinkSoft },
            { icon: IconBolt, label: 'PIX (100 últimos)', value: pixErrs, accent: T.blue, accentSoft: T.blueSoft },
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} style={{ ...card, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: s.accentSoft, color: s.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={20} />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.inkMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>{s.label}</div>
                </div>
                <div style={{ fontSize: 30, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -1 }}>{s.value}</div>
              </div>
            );
          })}
        </div>

        {/* Lista */}
        <div style={card}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.borderSoft}`, fontSize: 14, fontWeight: 700 }}>
            Últimos 100 erros
          </div>
          {errors.length === 0 ? (
            <div style={{ padding: 44, textAlign: 'center', color: T.inkMuted, fontSize: 14 }}>
              🎉 Nenhum erro de checkout registrado.
            </div>
          ) : (
            <div>
              {errors.map((e, i) => {
                const m = e.metadata ?? {};
                const pe = m.pagarme_errors;
                let peStr = '';
                if (pe && typeof pe === 'object') {
                  peStr = Object.entries(pe).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · ');
                } else if (typeof pe === 'string') {
                  peStr = pe;
                }
                return (
                  <div key={e.id} style={{
                    padding: '14px 20px',
                    borderBottom: i < errors.length - 1 ? `1px solid ${T.borderSoft}` : 'none',
                    display: 'flex', gap: 14, alignItems: 'flex-start',
                  }}>
                    <div style={{ flexShrink: 0, marginTop: 1, color: e.payment_type === 'pix' ? T.blue : T.pink }}>
                      {e.payment_type === 'pix' ? <IconBolt size={18} /> : <IconCreditCard size={18} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{m.route ?? 'checkout'}</span>
                        {m.status && (
                          <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: T.dangerSoft, color: T.danger }}>
                            HTTP {m.status}
                          </span>
                        )}
                        <span style={{ fontSize: 12, color: T.inkSoft }}>{e.email ?? 'sem email'}</span>
                        {m.context?.installments != null && (
                          <span style={{ fontSize: 11, color: T.inkMuted }}>· {m.context.installments}x</span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, color: T.ink, marginTop: 4, lineHeight: 1.45 }}>
                        {m.message ?? '(sem mensagem)'}
                      </div>
                      {peStr && (
                        <div style={{ fontSize: 11.5, color: T.danger, marginTop: 4, fontFamily: 'ui-monospace, Menlo, monospace', background: T.dangerSoft, padding: '6px 10px', borderRadius: 8 }}>
                          {peStr}
                        </div>
                      )}
                    </div>
                    <div style={{ flexShrink: 0, fontSize: 11.5, color: T.inkMuted, whiteSpace: 'nowrap' }}>
                      {timeAgo(e.created_at)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
