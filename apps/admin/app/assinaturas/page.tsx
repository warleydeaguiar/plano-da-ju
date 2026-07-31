import { createAdminClient } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'
import SubsTable from './SubsTable'

export const revalidate = 60
export const metadata = { title: 'Assinaturas — Admin Plano da Ju' }

const accent  = '#BE185D'
const green   = '#22A06B'
const orange  = '#D97706'
const red     = '#DC2626'
const gray    = '#7C6B7E'

// Pricing
const PRICE: Record<string, number> = {
  annual_card:    47,
  annual_pix:     47,
  quarterly_card: 47,
  quarterly_pix:  47,
  none:           0,
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: 12, color: gray, fontWeight: 500, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color ?? '#2A1E2C', lineHeight: 1 }}>{value}</div>
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
      background: '#FFFAF5', fontFamily: 'Plus Jakarta Sans, -apple-system, system-ui, sans-serif',
    }}>
      <Sidebar />
      <main style={{ marginLeft: 234, flex: 1, height: '100vh', overflowY: 'auto', padding: '32px 40px' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#2A1E2C' }}>Assinaturas</div>
          <div style={{ fontSize: 13, color: gray, marginTop: 4 }}>Plano capilar — R$ 47 · pagamento único</div>
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
          <StatCard label="Vencendo em 30d" value={expiringSoon.length} sub="renovação necessária" color={expiringSoon.length > 0 ? orange : '#2A1E2C'} />
          <StatCard label="Canceladas" value={cancelled.length} sub={`${pending.length} pendentes`} color={cancelled.length > 0 ? red : '#2A1E2C'} />
        </div>

        {/* Breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
          {/* Tipo de plano */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 24px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#2A1E2C', marginBottom: 16 }}>Distribuição por tipo</div>
            {[
              { label: 'Cartão', count: annualCard.length, color: accent },
              { label: 'PIX',    count: annualPix.length,  color: '#2563EB' },
            ].map(({ label, count, color }) => {
              const pct = active.length > 0 ? Math.round((count / active.length) * 100) : 0
              return (
                <div key={label} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#2A1E2C' }}>{label}</span>
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
            <div style={{ fontSize: 14, fontWeight: 700, color: '#2A1E2C', marginBottom: 16 }}>
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
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#2A1E2C' }}>
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

        {/* Full list — paginada (50/página) */}
        <SubsTable list={list} />

      </main>
    </div>
  )
}
