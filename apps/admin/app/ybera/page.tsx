import { createAdminClient } from '@/lib/supabase'
import { getGrupoAdSpend } from '@/lib/meta-ads'
import Sidebar from '../components/Sidebar'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Ybera — Admin Plano da Ju' }

// ─── Cores ───────────────────────────────────────────────────────────────────
const accent  = '#C4607A'
const green   = '#34C759'
const orange  = '#FF9500'
const red     = '#FF3B30'
const blue    = '#007AFF'
const gray    = '#8A8A8E'
const purple  = '#AF52DE'

// ─── Formatadores ─────────────────────────────────────────────────────────────
const brl = (v: number | null | undefined) =>
  v == null ? '—' : `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const num = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR')

// ─── Componentes ──────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, color, icon, small,
}: {
  label: string; value: string; sub?: string; color?: string; icon?: string; small?: boolean
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid rgba(0,0,0,0.06)' }}>
      {icon && <div style={{ fontSize: 20, marginBottom: 8 }}>{icon}</div>}
      <div style={{ fontSize: 11, color: gray, fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: small ? 20 : 26, fontWeight: 700, color: color ?? '#2D1B2E', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: gray, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

// ─── Data ─────────────────────────────────────────────────────────────────────
async function getYberaData() {
  const supabase = createAdminClient()

  const { data: rows } = await (supabase.from('ybera_monthly_data') as any)
    .select('*')
    .order('year_month', { ascending: false })

  const all = (rows ?? []) as any[]
  return all
}

async function getCurrentMonthLeads(): Promise<number> {
  const supabase = createAdminClient()
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // Leads = cliques únicos nos links dos grupos no mês atual
  const { count } = await (supabase.from('wg_redirect_clicks') as any)
    .select('*', { count: 'exact', head: true })
    .gte('created_at', start)

  return count ?? 0
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function YberaPage() {
  const [rows, adsResult, liveLeads] = await Promise.all([
    getYberaData(),
    getGrupoAdSpend('this_month'),
    getCurrentMonthLeads(),
  ])

  const currentYM = new Date().toISOString().slice(0, 7) // '2026-05'
  const current   = rows.find((r: any) => r.year_month === currentYM)
  const history   = rows.filter((r: any) => r.year_month !== currentYM)

  // Mês atual: se não existe no banco ainda, monta com dados ao vivo
  const cur = current ?? { year_month: currentYM, month_name: 'Mês atual', vendas: 0, vendas_afiliadas: 0, anuncios: 0, leads: 0, meta: null }

  // Leads do mês: prefere wg_redirect_clicks se > 0, senão usa banco
  const curLeads   = liveLeads > 0 ? liveLeads : (cur.leads ?? 0)
  // Anúncios do mês: prefere Meta API se configurado
  const curAnuncios = adsResult.status === 'ok' ? adsResult.totalSpend : (cur.anuncios ?? 0)
  const curCPL      = curLeads > 0 && curAnuncios > 0 ? curAnuncios / curLeads : (cur.custo_por_lead ?? 0)

  // Totais históricos (excluindo mês atual)
  const totalVendas    = rows.reduce((s: number, r: any) => s + (r.vendas ?? 0), 0)
  const totalAnuncios  = rows.reduce((s: number, r: any) => s + (r.anuncios ?? 0), 0)
  const totalLeads     = rows.reduce((s: number, r: any) => s + (r.leads ?? 0), 0)
  const totalAfiliadas = rows.reduce((s: number, r: any) => s + (r.vendas_afiliadas ?? 0), 0)

  // Melhor mês por vendas
  const best = rows.reduce((best: any, r: any) => (!best || (r.vendas ?? 0) > (best.vendas ?? 0)) ? r : best, null)

  // ROI médio (últimos 6 meses com dados)
  const last6 = rows.filter((r: any) => r.anuncios > 0 && r.vendas > 0).slice(0, 6)
  const avgROI = last6.length > 0
    ? last6.reduce((s: number, r: any) => s + (r.vendas / r.anuncios), 0) / last6.length
    : 0

  // Últimos 12 meses para gráfico
  const chart12 = [...rows].reverse().slice(-12)
  const maxVendas = Math.max(1, ...chart12.map((r: any) => r.vendas ?? 0))
  const maxAnuncios = Math.max(1, ...chart12.map((r: any) => r.anuncios ?? 0))

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: '#F5F5F7', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
    }}>
      <Sidebar />
      <main style={{ marginLeft: 220, flex: 1, height: '100vh', overflowY: 'auto', padding: '32px 40px' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#2D1B2E' }}>Ybera — Afiliação</div>
              {adsResult.status === 'ok' && (
                <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: green + '18', color: green }}>
                  📡 Meta Ads conectado
                </span>
              )}
              {adsResult.status === 'not_configured' && (
                <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: orange + '18', color: orange }}>
                  ⚠️ Meta Ads não configurado
                </span>
              )}
              {adsResult.status === 'error' && (
                <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: red + '18', color: red }} title={adsResult.error}>
                  ❌ Erro Meta Ads
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: gray, marginTop: 4 }}>
              Grupos de promoção · Comissão sobre vendas de produtos indicados
            </div>
          </div>
        </div>

        {/* ── Banner de setup Meta Ads (quando não configurado) ── */}
        {adsResult.status !== 'ok' && (
          <div style={{
            background: '#fff', borderRadius: 14, border: `1px solid ${orange}30`,
            padding: '16px 24px', marginBottom: 24,
            display: 'flex', alignItems: 'flex-start', gap: 14,
          }}>
            <div style={{ fontSize: 28, flexShrink: 0 }}>📱</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#2D1B2E', marginBottom: 4 }}>
                Conectar Meta Ads (campanha &quot;Grupo&quot;)
              </div>
              <div style={{ fontSize: 12, color: gray, lineHeight: 1.6 }}>
                Para puxar os gastos automaticamente, adicione as variáveis de ambiente:
                <br />
                <code style={{ background: '#F5F5F7', padding: '1px 6px', borderRadius: 4 }}>META_ADS_ACCESS_TOKEN</code>
                {' '}e{' '}
                <code style={{ background: '#F5F5F7', padding: '1px 6px', borderRadius: 4 }}>META_ADS_ACCOUNT_ID</code>
                {' '}no Vercel.
              </div>
              <div style={{ fontSize: 11, color: gray, marginTop: 6 }}>
                Para obter: Business Manager → Configurações → Usuários do Sistema → Gerar Token (permissão: ads_read).
                O ID da conta está no Gerenciador de Anúncios (formato: act_XXXXXXXXXX).
                {adsResult.error && <span style={{ color: red }}> Erro: {adsResult.error}</span>}
              </div>
            </div>
          </div>
        )}

        {/* ── KPIs Mês Atual ── */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: gray, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 12 }}>
            {cur.month_name} — atual
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 28 }}>
          <StatCard icon="📢" label="Investimento Grupos" value={brl(curAnuncios)}
            sub={adsResult.status === 'ok' ? 'Meta Ads ao vivo' : 'valor manual'} color={accent} small />
          <StatCard icon="👥" label="Leads do mês" value={num(curLeads)}
            sub={liveLeads > 0 ? 'via grupos de promoção' : 'valor histórico'} color={blue} />
          <StatCard icon="💸" label="Custo por lead" value={curCPL > 0 ? `R$ ${curCPL.toFixed(2).replace('.', ',')}` : '—'}
            color={curCPL > 2 ? red : curCPL > 1.5 ? orange : green} />
          <StatCard icon="🛒" label="Vendas do mês" value={brl(cur.vendas)} small
            sub={cur.meta ? `meta: ${brl(cur.meta)}` : undefined}
            color={cur.meta && cur.vendas >= cur.meta ? green : undefined} />
          <StatCard icon="🤝" label="Vendas afiliadas" value={brl(cur.vendas_afiliadas > 0 ? cur.vendas_afiliadas : null)}
            color={purple} small />
        </div>

        {/* ── Totais históricos ── */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: gray, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 12 }}>
            Histórico total ({rows.length} meses)
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
          <StatCard icon="💰" label="Receita total" value={brl(totalVendas)} sub="desde jan/2024" small />
          <StatCard icon="📢" label="Investimento total" value={brl(totalAnuncios)} color={accent} small />
          <StatCard icon="👥" label="Total de leads" value={num(totalLeads)} color={blue} />
          <StatCard icon="🏆" label="ROI médio (6m)" value={avgROI > 0 ? `${avgROI.toFixed(1)}x` : '—'}
            color={avgROI >= 10 ? green : avgROI >= 5 ? orange : gray} />
        </div>

        {/* ── Gráfico 12 meses ── */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 24px', marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#2D1B2E', marginBottom: 6 }}>
            Vendas vs. Investimento — últimos 12 meses
          </div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: gray }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: accent }} /> Vendas
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: gray }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: orange }} /> Investimento
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 100 }}>
            {chart12.map((r: any, i: number) => {
              const hVendas   = r.vendas   > 0 ? Math.max(4, (r.vendas   / maxVendas)   * 88) : 0
              const hAnuncios = r.anuncios > 0 ? Math.max(4, (r.anuncios / maxVendas)   * 88) : 0
              const isLast = i === chart12.length - 1
              const label = r.month_name.split(' ').map((w: string) => w.slice(0, 3)).join(' ')
              return (
                <div key={r.year_month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 92 }}>
                    <div style={{
                      width: '45%', height: hVendas, borderRadius: '3px 3px 0 0',
                      background: isLast ? 'rgba(196,96,122,0.4)' : accent,
                      opacity: 0.9, alignSelf: 'flex-end',
                    }} />
                    <div style={{
                      width: '45%', height: hAnuncios, borderRadius: '3px 3px 0 0',
                      background: isLast ? 'rgba(255,149,0,0.4)' : orange,
                      opacity: 0.9, alignSelf: 'flex-end',
                    }} />
                  </div>
                  <div style={{ fontSize: 8, color: isLast ? accent : gray, fontWeight: isLast ? 700 : 400, textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {label}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Campanhas Meta Ads ativas ── */}
        {adsResult.status === 'ok' && adsResult.campaigns.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 24px', marginBottom: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#2D1B2E', marginBottom: 16 }}>
              📡 Campanhas "Grupo" — {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F0F0F5' }}>
                  {['Campanha', 'Investimento'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Investimento' ? 'right' : 'left', fontSize: 11, color: gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {adsResult.campaigns.sort((a, b) => b.spend - a.spend).map(c => (
                  <tr key={c.campaign_id} style={{ borderBottom: '1px solid #F9F9FC' }}>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: '#2D1B2E' }}>{c.campaign_name}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: accent, textAlign: 'right' }}>{brl(c.spend)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid #F0F0F5' }}>
                  <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: '#2D1B2E' }}>Total</td>
                  <td style={{ padding: '10px 12px', fontSize: 14, fontWeight: 700, color: accent, textAlign: 'right' }}>{brl(adsResult.totalSpend)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* ── Tabela histórica completa ── */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid #F0F0F5' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#2D1B2E' }}>Histórico mensal completo</div>
            <div style={{ fontSize: 12, color: gray, marginTop: 2 }}>
              Anúncios: {adsResult.status === 'ok' ? 'mês atual via Meta API, histórico manual' : 'dados históricos manuais'}
              {' · '}Leads: mês atual via grupos de promoção, histórico manual
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
              <thead>
                <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #F0F0F5' }}>
                  {['Mês', 'Vendas do mês', 'Vendas afiliadas', 'Anúncios', 'Leads', 'CPL', 'ROI', 'Meta'].map(h => (
                    <th key={h} style={{
                      padding: '10px 16px', textAlign: h === 'Mês' ? 'left' : 'right',
                      fontSize: 11, color: gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4,
                      whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => {
                  const roi = r.anuncios > 0 ? (r.vendas / r.anuncios) : null
                  const metaPct = r.meta && r.vendas ? (r.vendas / r.meta) * 100 : null
                  const isCur  = r.year_month === currentYM
                  const cpl    = r.custo_por_lead ?? (r.anuncios > 0 && r.leads > 0 ? r.anuncios / r.leads : null)
                  return (
                    <tr key={r.year_month} style={{
                      borderBottom: '1px solid #F9F9FC',
                      background: isCur ? accent + '08' : 'transparent',
                    }}>
                      <td style={{ padding: '11px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: 13, fontWeight: isCur ? 700 : 600, color: isCur ? accent : '#2D1B2E' }}>
                          {r.month_name}
                        </div>
                        {isCur && <div style={{ fontSize: 10, color: accent }}>mês atual</div>}
                      </td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#2D1B2E' }}>
                        {brl(r.vendas)}
                      </td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', fontSize: 13, color: r.vendas_afiliadas > 0 ? purple : gray }}>
                        {r.vendas_afiliadas > 0 ? brl(r.vendas_afiliadas) : '—'}
                      </td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', fontSize: 13, color: accent }}>
                        {brl(r.anuncios)}
                      </td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', fontSize: 13, color: '#2D1B2E' }}>
                        {r.leads ? num(r.leads) : '—'}
                      </td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', fontSize: 13 }}>
                        {cpl ? (
                          <span style={{ color: cpl > 2 ? red : cpl > 1.5 ? orange : green, fontWeight: 600 }}>
                            R$ {cpl.toFixed(2).replace('.', ',')}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', fontSize: 13 }}>
                        {roi ? (
                          <span style={{ color: roi >= 10 ? green : roi >= 5 ? orange : gray, fontWeight: 600 }}>
                            {roi.toFixed(1)}x
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', fontSize: 12, color: gray }}>
                        {r.meta ? (
                          <span>
                            {brl(r.meta)}
                            {metaPct != null && (
                              <span style={{ marginLeft: 4, color: metaPct >= 100 ? green : metaPct >= 80 ? orange : red, fontWeight: 600 }}>
                                ({Math.round(metaPct)}%)
                              </span>
                            )}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid #F0F0F5', background: '#FAFAFA' }}>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#2D1B2E' }}>Total</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#2D1B2E' }}>{brl(totalVendas)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: purple }}>{brl(totalAfiliadas)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: accent }}>{brl(totalAnuncios)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#2D1B2E' }}>{num(totalLeads)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

      </main>
    </div>
  )
}
