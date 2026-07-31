import { createAdminClient } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'
import Link from 'next/link'

export const revalidate = 60
export const metadata = { title: 'Assinaturas — Admin Plano da Ju' }

const accent  = '#BE185D'
const green   = '#22A06B'
const orange  = '#D97706'
const red     = '#DC2626'
const gray    = '#7C6B7E'

const SUB_STATUS: Record<string, { label: string; color: string }> = {
  active:    { label: 'Ativa',     color: green },
  cancelled: { label: 'Cancelada', color: red },
  expired:   { label: 'Expirada',  color: orange },
  pending:   { label: 'Pendente',  color: gray },
}

const SUB_TYPE: Record<string, string> = {
  annual_card:    '90 dias — Cartão',
  annual_pix:     '90 dias — PIX',
  quarterly_card: '90 dias — Cartão',
  quarterly_pix:  '90 dias — PIX',
  none:           '—',
}

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

const brl = (v: number) => 'R$ ' + v.toFixed(2).replace('.', ',')

export default async function AssinaturasPage(
  { searchParams }: { searchParams: Promise<{ page?: string; paid?: string }> }
) {
  const sb = createAdminClient()
  const sp = await searchParams
  const paidOnly = sp?.paid === '1'
  const pageSize = 50
  const page = Math.max(1, parseInt(sp?.page ?? '1', 10) || 1)
  const offset = (page - 1) * pageSize

  // Stats agregados (todas as assinaturas — não só a página exibida)
  const { data: allSubs } = await (sb.from('profiles') as any)
    .select('subscription_type,subscription_status,subscription_expires_at')
    .not('subscription_type', 'eq', 'none')
    .order('created_at', { ascending: false })
    .limit(3000)
  const all = (allSubs ?? []) as any[]

  // Tabela paginada (50/página). Sem count exato (era scan pesado → timeout):
  // busca 51 e usa a linha extra pra saber se há próxima página.
  let q = (sb.from('profiles') as any)
    .select('id,full_name,email,subscription_type,subscription_status,subscription_expires_at,pagarme_subscription_id,created_at')
    .not('subscription_type', 'eq', 'none')
  if (paidOnly) q = q.neq('subscription_type', 'parceria')
  const { data: subs } = await q
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize)
  const rowsRaw = (subs ?? []) as any[]
  const hasNext = rowsRaw.length > pageSize
  const list = rowsRaw.slice(0, pageSize)
  const pageHref = (p: number) => `/assinaturas?page=${p}${paidOnly ? '&paid=1' : ''}`

  // Valor REAL pago — busca só os e-mails DESTA página (leve; sem varrer tudo).
  const pageEmails = list.map((s: any) => s.email).filter(Boolean)
  const paidMap = new Map<string, number>()
  if (pageEmails.length) {
    const { data: payRows } = await (sb.from('checkout_events') as any)
      .select('email,amount_cents')
      .eq('event_type', 'payment_confirmed')
      .in('email', pageEmails)
    for (const r of ((payRows ?? []) as any[])) {
      const e = String(r.email ?? '').toLowerCase().trim()
      if (!e) continue
      const c = r.amount_cents ?? 0
      if (c > (paidMap.get(e) ?? 0)) paidMap.set(e, c)
    }
  }

  const active    = all.filter((s: any) => s.subscription_status === 'active')
  const cancelled = all.filter((s: any) => s.subscription_status === 'cancelled')
  const pending   = all.filter((s: any) => s.subscription_status === 'pending')
  const expired   = all.filter((s: any) => s.subscription_status === 'expired')

  const annualCard = active.filter((s: any) => s.subscription_type === 'annual_card')
  const annualPix  = active.filter((s: any) => s.subscription_type === 'annual_pix')

  // Receita estimada (rápida): soma o preço por tipo das assinaturas pagas.
  const totalRevenue = Math.round(all.reduce((s: number, x: any) => s + (PRICE[x.subscription_type] ?? 0), 0))

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

        {/* Full list */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid #F0F0F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#2A1E2C' }}>
              {paidOnly ? 'Vendas pagas' : 'Todas as assinaturas'}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Link href={paidOnly ? '/assinaturas' : '/assinaturas?paid=1'} style={{
                fontSize: 12.5, fontWeight: 600, textDecoration: 'none', padding: '6px 12px', borderRadius: 20,
                border: `1px solid ${paidOnly ? green : '#E5E0E8'}`, color: paidOnly ? green : gray,
                background: paidOnly ? green + '14' : '#fff',
              }}>
                {paidOnly ? '✓ Só vendas pagas' : 'Só vendas pagas'}
              </Link>
              <Link href="/usuarios" style={{ fontSize: 13, color: accent, fontWeight: 600, textDecoration: 'none' }}>
                Ver usuárias →
              </Link>
            </div>
          </div>

          {list.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: gray, fontSize: 14 }}>
              Nenhuma assinatura encontrada
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F0F0F5', background: '#FFF7EE' }}>
                  {['Usuária', 'Plano', 'Valor pago', 'Status', 'PagarMe ID', 'Expira em', 'Cadastro'].map(h => (
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
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#2A1E2C' }}>
                          {s.full_name ?? s.email.split('@')[0]}
                        </div>
                        <div style={{ fontSize: 11, color: gray }}>{s.email}</div>
                      </td>
                      <td style={{ padding: '12px 20px', fontSize: 13, color: '#2A1E2C' }}>
                        {SUB_TYPE[s.subscription_type] ?? s.subscription_type}
                      </td>
                      <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 700, color: '#2A1E2C' }}>
                        {s.subscription_type === 'parceria'
                          ? <span style={{ color: gray, fontWeight: 500 }}>grátis (parceria)</span>
                          : (paidMap.get(String(s.email ?? '').toLowerCase().trim())
                              ? brl((paidMap.get(String(s.email ?? '').toLowerCase().trim()) ?? 0) / 100)
                              : <span style={{ color: gray, fontWeight: 500 }}>—</span>)}
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
                      <td style={{ padding: '12px 20px', fontSize: 12, color: s.subscription_expires_at ? '#2A1E2C' : gray }}>
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
          {(page > 1 || hasNext) && (
            <div style={{ padding: '14px 24px', borderTop: '1px solid #F0F0F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ fontSize: 12.5, color: gray }}>Página {page} · {list.length} nesta página</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {page > 1
                  ? <Link href={pageHref(page - 1)} style={{ fontSize: 12.5, fontWeight: 600, textDecoration: 'none', padding: '7px 14px', borderRadius: 8, border: '1px solid #E5E0E8', color: accent, background: '#fff' }}>← Anterior</Link>
                  : <span style={{ fontSize: 12.5, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '1px solid #F3F0F5', color: '#C9C2CE' }}>← Anterior</span>}
                {hasNext
                  ? <Link href={pageHref(page + 1)} style={{ fontSize: 12.5, fontWeight: 600, textDecoration: 'none', padding: '7px 14px', borderRadius: 8, border: '1px solid #E5E0E8', color: accent, background: '#fff' }}>Próxima →</Link>
                  : <span style={{ fontSize: 12.5, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '1px solid #F3F0F5', color: '#C9C2CE' }}>Próxima →</span>}
              </div>
            </div>
          )}
        </div>

      </main>
    </div>
  )
}
