import { createAdminClient } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'
import Link from 'next/link'

export const revalidate = 60
export const metadata = { title: 'Assinaturas — Admin Plano da Ju' }

const accent  = '#C4607A'
const green   = '#34C759'
const orange  = '#FF9500'
const red     = '#FF3B30'
const gray    = '#8A8A8E'

const SUB_STATUS: Record<string, { label: string; color: string }> = {
  active:    { label: 'Ativa',     color: green },
  cancelled: { label: 'Cancelada', color: red },
  expired:   { label: 'Expirada',  color: orange },
  pending:   { label: 'Pendente',  color: gray },
}

const SUB_TYPE: Record<string, string> = {
  annual_card: 'Anual — Cartão',
  annual_pix:  'Anual — PIX',
  none:        '—',
}

// Pricing
const PRICE: Record<string, number> = {
  annual_card: 34.90,
  annual_pix:  49.90,
  none:        0,
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: 12, color: gray, fontWeight: 500, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color ?? '#2D1B2E', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: gray, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

export default async function AssinaturasPage() {
  const sb = createAdminClient()

  const { data: subs } = await (sb.from('profiles') as any)
    .select('id,full_name,email,subscription_type,subscription_status,subscription_expires_at,pagarme_subscription_id,created_at')
    .not('subscription_type', 'eq', 'none')
    .order('created_at', { ascending: false })
    .limit(200)

  const list = (subs ?? []) as any[]

  const active    = list.filter((s: any) => s.subscription_status === 'active')
  const cancelled = list.filter((s: any) => s.subscription_status === 'cancelled')
  const pending   = list.filter((s: any) => s.subscription_status === 'pending')
  const expired   = list.filter((s: any) => s.subscription_status === 'expired')

  const annualCard = active.filter((s: any) => s.subscription_type === 'annual_card')
  const annualPix  = active.filter((s: any) => s.subscription_type === 'annual_pix')

  // Total revenue (lifetime): somar todos os pagamentos (por tipo)
  const totalRevenue = list.reduce((sum: number, s: any) => {
    return sum + (PRICE[s.subscription_type] ?? 0)
  }, 0)

  // Expirations in the next 30 days
  const now = Date.now()
  const in30 = now + 30 * 86400000
  const expiringSoon = active.filter((s: any) => {
    if (!s.subscription_expires_at) return false
    const exp = new Date(s.subscription_expires_at).getTime()
    return exp >= now && exp <= in30
  })

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: '#F5F5F7', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
    }}>
      <Sidebar />
      <main style={{ marginLeft: 220, flex: 1, height: '100vh', overflowY: 'auto', padding: '32px 40px' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#2D1B2E' }}>Assinaturas</div>
          <div style={{ fontSize: 13, color: gray, marginTop: 4 }}>Plano anual — R$ 34,90 (cartão) ou R$ 49,90 (PIX)</div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          <StatCard label="Ativas" value={active.length} sub="assinaturas vigentes" color={green} />
          <StatCard
            label="Receita total"
            value={`R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            sub={`${list.length} vendas total`}
            color={accent}
          />
          <StatCard label="Vencendo em 30d" value={expiringSoon.length} sub="renovação necessária" color={expiringSoon.length > 0 ? orange : '#2D1B2E'} />
          <StatCard label="Canceladas" value={cancelled.length} sub={`${pending.length} pendentes`} color={cancelled.length > 0 ? red : '#2D1B2E'} />
        </div>

        {/* Breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
          {/* Tipo de plano */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 24px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#2D1B2E', marginBottom: 16 }}>Distribuição por tipo</div>
            {[
              { label: 'Anual — Cartão', count: annualCard.length, color: accent },
              { label: 'Anual — PIX',   count: annualPix.length,  color: '#007AFF' },
            ].map(({ label, count, color }) => {
              const pct = active.length > 0 ? Math.round((count / active.length) * 100) : 0
              return (
                <div key={label} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#2D1B2E' }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ height: 6, background: '#F0F0F5', borderRadius: 3 }}>
                    <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: color }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Vencendo em breve */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 24px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#2D1B2E', marginBottom: 16 }}>
              Vencendo em 30 dias
              {expiringSoon.length > 0 && (
                <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: orange + '20', color: orange }}>
                  {expiringSoon.length}
                </span>
              )}
            </div>
            {expiringSoon.length === 0 ? (
              <div style={{ fontSize: 13, color: gray, textAlign: 'center', padding: '16px 0' }}>Nenhuma assinatura vencendo em breve 🎉</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {expiringSoon.slice(0, 5).map((s: any) => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#2D1B2E' }}>
                      {s.full_name ?? s.email.split('@')[0]}
                    </div>
                    <div style={{ fontSize: 12, color: orange, fontWeight: 600 }}>
                      {new Date(s.subscription_expires_at).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                ))}
                {expiringSoon.length > 5 && (
                  <div style={{ fontSize: 12, color: gray, textAlign: 'center', marginTop: 4 }}>
                    +{expiringSoon.length - 5} mais…
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Full list */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid #F0F0F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#2D1B2E' }}>Todas as assinaturas</div>
            <Link href="/usuarios" style={{ fontSize: 13, color: accent, fontWeight: 600, textDecoration: 'none' }}>
              Ver usuárias →
            </Link>
          </div>

          {list.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: gray, fontSize: 14 }}>
              Nenhuma assinatura encontrada
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F0F0F5', background: '#FAFAFA' }}>
                  {['Usuária', 'Plano', 'Status', 'PagarMe ID', 'Expira em', 'Cadastro'].map(h => (
                    <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, color: gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((s: any) => {
                  const st = SUB_STATUS[s.subscription_status] ?? { label: s.subscription_status, color: gray }
                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid #F9F9FC' }}>
                      <td style={{ padding: '12px 20px' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#2D1B2E' }}>
                          {s.full_name ?? s.email.split('@')[0]}
                        </div>
                        <div style={{ fontSize: 11, color: gray }}>{s.email}</div>
                      </td>
                      <td style={{ padding: '12px 20px', fontSize: 13, color: '#2D1B2E' }}>
                        {SUB_TYPE[s.subscription_type] ?? s.subscription_type}
                      </td>
                      <td style={{ padding: '12px 20px' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                          background: st.color + '18', color: st.color,
                        }}>{st.label}</span>
                      </td>
                      <td style={{ padding: '12px 20px', fontSize: 12, color: gray, fontFamily: 'monospace' }}>
                        {s.pagarme_subscription_id ?? '—'}
                      </td>
                      <td style={{ padding: '12px 20px', fontSize: 12, color: s.subscription_expires_at ? '#2D1B2E' : gray }}>
                        {s.subscription_expires_at
                          ? new Date(s.subscription_expires_at).toLocaleDateString('pt-BR')
                          : '—'}
                      </td>
                      <td style={{ padding: '12px 20px', fontSize: 12, color: gray }}>
                        {new Date(s.created_at).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

      </main>
    </div>
  )
}
