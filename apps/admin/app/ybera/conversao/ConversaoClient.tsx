'use client'

import { useMemo, useState } from 'react'

const accent = '#BE185D'
const gold = '#c9a45c'
const green = '#22A06B'
const gray = '#7C6B7E'
const ink = '#2A1E2C'

const brl = (v: number) => `R$ ${(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const pct = (v: number) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
const dt = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('pt-BR') : '—'

type Prod = { name: string; qty: number }
type TopProd = { name: string; qty: number; revenue: number }
type Row = { id: string; name: string; email: string; bought: boolean; orders: number; totalSpent: number; lastPurchase: string | null; matchType: 'email' | 'phone' | null; products: Prod[] }
type Bundle = {
  overview: { totalOrders: number; totalRevenue: number; commission: number; totalBuyers: number; studentBuyers: number; nonStudentBuyers: number }
  plano: { activeCount: number; buyers: number; conversion: number; revenue: number; avgTicket: number; avgOrdersPerBuyer: number; topProducts: TopProd[] }
  grupos: { buyers: number; revenue: number; avgTicket: number; avgOrdersPerBuyer: number; topProducts: TopProd[] }
  studentRows: Row[]
}
type Trend = { ym: string; label: string; studentBuyers: number; studentRevenue: number; conversion: number; gruposBuyers: number; gruposRevenue: number }
type Lifetime = { avgDaysToFirst: number | null; repeatRate: number; cohorts: { ym: string; label: string; active: number; buyers: number; conv: number }[]; gruposRepeatRate: number }
type GruposSafra = {
  totalLeads: number; buyers: number; conversion: number; revenue: number
  cohorts: { ym: string; label: string; leads: number; buyers: number; conv: number; revenue: number }[]
}
type Data = {
  hasOrders: boolean; activeCount: number
  months: { key: string; label: string }[]
  periods: Record<string, Bundle>
  trend: Trend[]
  lifetime: Lifetime | null
  gruposSafra?: GruposSafra | null
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid rgba(0,0,0,0.06)', ...style }}>{children}</div>
}
function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <Card>
      <div style={{ fontSize: 11, color: gray, fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: color ?? ink, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: gray, marginTop: 6 }}>{sub}</div>}
    </Card>
  )
}
function SectionTitle({ children, emoji }: { children: React.ReactNode; emoji?: string }) {
  return <div style={{ fontSize: 16, fontWeight: 700, color: ink, margin: '34px 0 14px' }}>{emoji} {children}</div>
}
function TopProducts({ items }: { items: TopProd[] }) {
  const max = Math.max(...items.map(i => i.revenue), 1)
  return (
    <Card>
      <div style={{ fontSize: 13, fontWeight: 700, color: ink, marginBottom: 12 }}>Produtos mais comprados</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {items.length === 0 && <div style={{ fontSize: 13, color: gray }}>Sem dados no período.</div>}
        {items.map((p, i) => (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: ink, marginBottom: 3 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{p.name}</span>
              <span style={{ color: gray }}>{p.qty}un · {brl(p.revenue)}</span>
            </div>
            <div style={{ height: 5, background: '#F0EAF0', borderRadius: 3 }}>
              <div style={{ height: '100%', width: `${(p.revenue / max) * 100}%`, background: gold, borderRadius: 3 }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

export default function ConversaoClient({ data }: { data: Data }) {
  const [period, setPeriod] = useState<string>('all')
  const [filter, setFilter] = useState<'all' | 'buyers' | 'non'>('buyers')
  const [q, setQ] = useState('')

  const isAll = period === 'all'
  const b: Bundle | undefined = data.periods?.[period]

  const rows = useMemo(() => {
    let r = b?.studentRows ?? []
    if (isAll) {
      if (filter === 'buyers') r = r.filter(x => x.bought)
      else if (filter === 'non') r = r.filter(x => !x.bought)
    }
    const term = q.trim().toLowerCase()
    if (term) r = r.filter(x => x.name.toLowerCase().includes(term) || x.email.toLowerCase().includes(term))
    return r
  }, [b, isAll, filter, q])

  if (!data.hasOrders || !b) {
    return (
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: ink }}>Conversão Ybera</h1>
        <Card style={{ marginTop: 16 }}>
          <div style={{ fontSize: 14, color: ink, fontWeight: 600, marginBottom: 6 }}>Ainda não há pedidos Ybera importados.</div>
          <div style={{ fontSize: 13, color: gray }}>Rode o backfill (<code>/api/ybera/backfill</code>) pra puxar o histórico.</div>
        </Card>
      </div>
    )
  }

  const o = b.overview, P = b.plano, G = b.grupos, L = data.lifetime
  const periodLabel = isAll ? 'Todo o período' : (data.months.find(m => m.key === period)?.label ?? period)

  // trend (últimos 12) p/ gráficos
  const trend12 = data.trend.slice(-12)
  const convMax = Math.max(...trend12.map(t => t.conversion), 0.0001)
  const stuMax = Math.max(...trend12.map(t => t.studentBuyers), 1)
  const gruMax = Math.max(...trend12.map(t => t.gruposRevenue), 1)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 4 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: ink, margin: 0 }}>Conversão Ybera</h1>
          <div style={{ fontSize: 13, color: gray, marginTop: 4 }}>Cruzamento dos pedidos Ybera com a base, por email/telefone. Atualizado diariamente.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: gray, fontWeight: 600 }}>Período</span>
          <select value={period} onChange={e => setPeriod(e.target.value)} style={{
            fontSize: 13, fontWeight: 600, color: ink, padding: '8px 12px', borderRadius: 10,
            border: `1.5px solid ${accent}33`, background: '#fff', cursor: 'pointer',
          }}>
            <option value="all">Todo o período</option>
            {data.months.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>
      </div>
      <div style={{ fontSize: 12, color: accent, fontWeight: 600, marginBottom: 16 }}>Mostrando: {periodLabel}</div>

      {/* Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        <Stat label={`Receita Ybera (${isAll ? 'total' : periodLabel})`} value={brl(o.totalRevenue)} sub={`${o.totalOrders} pedidos`} />
        <Stat label="Comissão estimada (20%)" value={brl(o.commission)} color={green} />
        <Stat label="Compradores no período" value={String(o.totalBuyers)} sub={`${o.studentBuyers} alunas · ${o.nonStudentBuyers} grupos/outros`} />
      </div>

      {/* ── Evolução mês a mês (sempre visível) ── */}
      <SectionTitle emoji="📈">Evolução mês a mês — a conversão está subindo?</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: ink, marginBottom: 4 }}>Conversão das alunas por mês</div>
          <div style={{ fontSize: 11, color: gray, marginBottom: 14 }}>% da base atual de {data.activeCount} alunas ativas que comprou Ybera no mês</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 110 }}>
            {trend12.map(t => (
              <div key={t.ym} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}
                title={`${t.label}: ${pct(t.conversion)} · ${t.studentBuyers} alunas · ${brl(t.studentRevenue)}`}>
                <div style={{ fontSize: 9, color: accent, fontWeight: 700, marginBottom: 2 }}>{t.studentBuyers || ''}</div>
                <div style={{ width: '100%', height: `${Math.max((t.conversion / convMax) * 80, t.studentBuyers > 0 ? 4 : 0)}px`, background: `linear-gradient(180deg, ${accent}, #d6488a)`, borderRadius: '3px 3px 0 0' }} />
                <div style={{ fontSize: 8.5, color: gray, marginTop: 4 }}>{t.label.slice(0, 3)}/{t.ym.slice(2, 4)}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: ink, marginBottom: 4 }}>Receita grupos/outros por mês</div>
          <div style={{ fontSize: 11, color: gray, marginBottom: 14 }}>vendas Ybera de quem não é aluna do plano</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 110 }}>
            {trend12.map(t => (
              <div key={t.ym} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}
                title={`${t.label}: ${brl(t.gruposRevenue)} · ${t.gruposBuyers} compradores`}>
                <div style={{ width: '100%', height: `${Math.max((t.gruposRevenue / gruMax) * 84, t.gruposRevenue > 0 ? 3 : 0)}px`, background: gold, borderRadius: '3px 3px 0 0' }} />
                <div style={{ fontSize: 8.5, color: gray, marginTop: 4 }}>{t.label.slice(0, 3)}/{t.ym.slice(2, 4)}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Tabela mês a mês */}
      <Card style={{ marginTop: 14, padding: 0, overflow: 'hidden' }}>
        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: gray, background: '#FAF6FA', position: 'sticky', top: 0 }}>
                <th style={{ padding: '10px 20px', fontWeight: 600 }}>Mês</th>
                <th style={{ padding: '10px 8px', fontWeight: 600, textAlign: 'right' }}>Alunas que compraram</th>
                <th style={{ padding: '10px 8px', fontWeight: 600, textAlign: 'right' }}>Conversão</th>
                <th style={{ padding: '10px 8px', fontWeight: 600, textAlign: 'right' }}>Receita alunas</th>
                <th style={{ padding: '10px 8px', fontWeight: 600, textAlign: 'right' }}>Compradores grupos</th>
                <th style={{ padding: '10px 20px', fontWeight: 600, textAlign: 'right' }}>Receita grupos</th>
              </tr>
            </thead>
            <tbody>
              {[...data.trend].reverse().map(t => (
                <tr key={t.ym} style={{ borderTop: '1px solid #F3EEF3', cursor: 'pointer', background: period === t.ym ? '#FCF0F6' : 'transparent' }} onClick={() => setPeriod(t.ym)}>
                  <td style={{ padding: '10px 20px', color: ink, fontWeight: 600 }}>{t.label}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', color: ink }}>{t.studentBuyers}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', color: accent, fontWeight: 700 }}>{pct(t.conversion)}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', color: ink }}>{brl(t.studentRevenue)}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', color: ink }}>{t.gruposBuyers}</td>
                  <td style={{ padding: '10px 20px', textAlign: 'right', color: ink }}>{brl(t.gruposRevenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div style={{ fontSize: 11, color: gray, marginTop: 6 }}>Clique num mês na tabela (ou use o seletor lá em cima) pra ver os detalhes daquele mês abaixo.</div>

      {/* ── Bloco A: Plano → Ybera (escopo = período selecionado) ── */}
      <SectionTitle emoji="🎯">Alunas do plano → Ybera · {periodLabel}</SectionTitle>
      <div style={{ fontSize: 12, color: gray, margin: '-6px 0 12px', lineHeight: 1.5 }}>
        Pedidos atribuídos ao nosso link de afiliado, cruzados por email/telefone das {data.activeCount} alunas ativas.
        {isAll ? ' Quem entrou agora ainda não teve tempo de comprar — acompanhe o trend acima.' : ' Conversão = alunas que compraram neste mês ÷ base atual de ativas.'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        <Card style={{ background: `linear-gradient(135deg, ${accent}, #9d1457)`, border: 'none' }}>
          <div style={{ fontSize: 11, color: '#ffffffcc', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>Taxa de conversão</div>
          <div style={{ fontSize: 34, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{pct(P.conversion)}</div>
          <div style={{ fontSize: 12, color: '#ffffffcc', marginTop: 6 }}>{P.buyers} de {P.activeCount} alunas {isAll ? 'já compraram' : 'compraram no mês'}</div>
        </Card>
        <Stat label="Receita das alunas" value={brl(P.revenue)} />
        <Stat label="Ticket médio" value={brl(P.avgTicket)} sub={`${P.avgOrdersPerBuyer.toFixed(1)} pedidos/compradora`} />
        {isAll && L && <Stat label="Tempo até 1ª compra" value={L.avgDaysToFirst == null ? '—' : `${L.avgDaysToFirst} dias`} sub="após entrar no plano (aprox.)" />}
        {isAll && L && <Stat label="Recompra das alunas" value={pct(L.repeatRate)} sub="compradoras com 2+ pedidos" />}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isAll && L ? '1fr 1fr' : '1fr', gap: 14, marginTop: 14 }}>
        {isAll && L && (
          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, color: ink, marginBottom: 12 }}>Conversão por safra (mês de entrada no plano)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {L.cohorts.length === 0 && <div style={{ fontSize: 13, color: gray }}>Sem dados.</div>}
              {L.cohorts.slice(-8).map(c => (
                <div key={c.ym} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, color: gray, width: 56 }}>{c.label}</span>
                  <div style={{ flex: 1, height: 16, background: '#F0EAF0', borderRadius: 4 }}>
                    <div style={{ height: '100%', width: `${c.conv * 100}%`, background: accent, borderRadius: 4, minWidth: c.buyers ? 2 : 0 }} />
                  </div>
                  <span style={{ fontSize: 11, color: ink, width: 92, textAlign: 'right' }}>{pct(c.conv)} ({c.buyers}/{c.active})</span>
                </div>
              ))}
            </div>
          </Card>
        )}
        <TopProducts items={P.topProducts} />
      </div>

      {/* Tabela de alunas */}
      <Card style={{ marginTop: 14, padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid #F0EAF0', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: ink, marginRight: 'auto' }}>
            {isAll ? `Alunas ativas · ${rows.length}` : `Alunas que compraram em ${periodLabel} · ${rows.length}`}
          </div>
          {isAll && (['buyers', 'non', 'all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
              border: `1px solid ${filter === f ? accent : '#E5DCE5'}`, background: filter === f ? accent : '#fff', color: filter === f ? '#fff' : gray,
            }}>{f === 'buyers' ? 'Compraram' : f === 'non' ? 'Não compraram' : 'Todas'}</button>
          ))}
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar nome/email…" style={{ fontSize: 12, padding: '7px 12px', borderRadius: 8, border: '1px solid #E5DCE5', minWidth: 180 }} />
        </div>
        <div style={{ maxHeight: 460, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: gray, background: '#FAF6FA', position: 'sticky', top: 0 }}>
                <th style={{ padding: '10px 20px', fontWeight: 600 }}>Aluna</th>
                <th style={{ padding: '10px 8px', fontWeight: 600 }}>Ybera?</th>
                <th style={{ padding: '10px 8px', fontWeight: 600, textAlign: 'right' }}>Pedidos</th>
                <th style={{ padding: '10px 8px', fontWeight: 600, textAlign: 'right' }}>Gasto</th>
                <th style={{ padding: '10px 8px', fontWeight: 600 }}>Última</th>
                <th style={{ padding: '10px 20px', fontWeight: 600 }}>Produtos</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{ borderTop: '1px solid #F3EEF3' }}>
                  <td style={{ padding: '10px 20px', maxWidth: 200 }}>
                    <div style={{ color: ink, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                    <div style={{ color: gray, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.email}</div>
                  </td>
                  <td style={{ padding: '10px 8px' }}>{r.bought ? <span style={{ fontSize: 11, fontWeight: 700, color: green }}>✓ sim</span> : <span style={{ fontSize: 11, color: gray }}>—</span>}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', color: ink }}>{r.orders || ''}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', color: ink, fontWeight: r.bought ? 600 : 400 }}>{r.bought ? brl(r.totalSpent) : ''}</td>
                  <td style={{ padding: '10px 8px', color: gray }}>{r.bought ? dt(r.lastPurchase) : ''}</td>
                  <td style={{ padding: '10px 20px', color: gray, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.products.map(p => `${p.name} (${p.qty})`).join(', ')}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: gray }}>Nenhuma aluna nesse filtro.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Bloco B: Grupos / outros (escopo = período) ── */}
      <SectionTitle emoji="🛍️">Grupos / outros → Ybera · {periodLabel}</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        <Stat label="Compradores (não-alunas)" value={String(G.buyers)} />
        <Stat label="Receita do canal" value={brl(G.revenue)} />
        <Stat label="Ticket médio" value={brl(G.avgTicket)} sub={`${G.avgOrdersPerBuyer.toFixed(1)} pedidos/cliente`} />
        {isAll && L && <Stat label="Recompra" value={pct(L.gruposRepeatRate)} sub="clientes com 2+ pedidos" color={green} />}
      </div>
      <div style={{ marginTop: 14 }}><TopProducts items={G.topProducts} /></div>

      {/* ── Safra dos grupos (anúncios) — só no "todo o período" ── */}
      {isAll && data.gruposSafra && (
        <>
          <SectionTitle emoji="📈">Grupos (anúncios) → Ybera · conversão por safra</SectionTitle>
          <div style={{ fontSize: 12, color: gray, margin: '-8px 0 12px', lineHeight: 1.5 }}>
            Quem entrou no funil dos grupos pelo anúncio (lead do quiz fashion-gold), por mês de entrada (safra), e quantos depois compraram Ybera. Mesma lógica da safra do plano — acompanhe ela subir com o tempo.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 14 }}>
            <Stat label="Leads dos grupos (anúncio)" value={String(data.gruposSafra.totalLeads)} />
            <Stat label="Compraram Ybera" value={String(data.gruposSafra.buyers)} />
            <Stat label="Conversão geral" value={pct(data.gruposSafra.conversion)} color={accent} />
            <Stat label="Receita gerada" value={brl(data.gruposSafra.revenue)} color={green} />
          </div>
          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, color: ink, marginBottom: 12 }}>Conversão por safra (mês de entrada no grupo)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.gruposSafra.cohorts.length === 0 && <div style={{ fontSize: 13, color: gray }}>Sem dados ainda.</div>}
              {data.gruposSafra.cohorts.slice(-12).map(c => (
                <div key={c.ym} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, color: gray, width: 56 }}>{c.label}</span>
                  <div style={{ flex: 1, height: 16, background: '#F0EAF0', borderRadius: 4 }}>
                    <div style={{ height: '100%', width: `${c.conv * 100}%`, background: accent, borderRadius: 4, minWidth: c.buyers ? 2 : 0 }} />
                  </div>
                  <span style={{ fontSize: 11, color: ink, width: 120, textAlign: 'right' }}>{pct(c.conv)} ({c.buyers}/{c.leads})</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      <div style={{ height: 40 }} />
    </div>
  )
}
