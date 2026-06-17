'use client'

import { useMemo, useState } from 'react'

const accent = '#BE185D'
const gold   = '#c9a45c'
const green  = '#22A06B'
const gray   = '#7C6B7E'
const ink    = '#2A1E2C'

const brl = (v: number) => `R$ ${(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const pct = (v: number) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
const dt  = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('pt-BR') : '—'

type Prod = { name: string; qty: number }
type Data = {
  hasOrders: boolean
  overview: { totalOrders: number; totalRevenue: number; commission: number; totalBuyers: number; studentBuyers: number; nonStudentBuyers: number; repeatOverall: number }
  plano: { activeCount: number; buyers: number; conversion: number; revenue: number; avgTicket: number; avgOrdersPerBuyer: number; avgDaysToFirst: number | null; repeatRate: number; topProducts: { name: string; qty: number; revenue: number }[]; cohorts: { ym: string; active: number; buyers: number; conv: number }[] }
  grupos: { buyers: number; revenue: number; avgTicket: number; avgOrdersPerBuyer: number; repeatRate: number; dist: Record<string, number>; topProducts: { name: string; qty: number; revenue: number }[]; fgMatched: number; monthly: { ym: string; orders: number; revenue: number }[] }
  studentRows: { id: string; name: string; email: string; bought: boolean; orders: number; totalSpent: number; lastPurchase: string | null; matchType: 'email' | 'phone' | null; products: Prod[] }[]
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

function TopProducts({ items }: { items: { name: string; qty: number; revenue: number }[] }) {
  const max = Math.max(...items.map(i => i.revenue), 1)
  return (
    <Card>
      <div style={{ fontSize: 13, fontWeight: 700, color: ink, marginBottom: 12 }}>Produtos mais comprados</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {items.length === 0 && <div style={{ fontSize: 13, color: gray }}>Sem dados ainda.</div>}
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
  const [filter, setFilter] = useState<'all' | 'buyers' | 'non'>('buyers')
  const [q, setQ] = useState('')

  const rows = useMemo(() => {
    let r = data.studentRows
    if (filter === 'buyers') r = r.filter(x => x.bought)
    else if (filter === 'non') r = r.filter(x => !x.bought)
    const term = q.trim().toLowerCase()
    if (term) r = r.filter(x => x.name.toLowerCase().includes(term) || x.email.toLowerCase().includes(term))
    return r
  }, [data.studentRows, filter, q])

  if (!data.hasOrders) {
    return (
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: ink }}>Conversão Ybera</h1>
        <Card style={{ marginTop: 16 }}>
          <div style={{ fontSize: 14, color: ink, fontWeight: 600, marginBottom: 6 }}>Ainda não há pedidos Ybera importados.</div>
          <div style={{ fontSize: 13, color: gray }}>Rode o backfill (<code>/api/ybera/backfill</code>) pra puxar o histórico de pedidos. Depois esta página passa a cruzar tudo automaticamente.</div>
        </Card>
      </div>
    )
  }

  const o = data.overview, P = data.plano, G = data.grupos
  const cohortMax = Math.max(...P.cohorts.map(c => c.active), 1)
  const monMax = Math.max(...G.monthly.map(m => m.revenue), 1)

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: ink, margin: 0 }}>Conversão Ybera</h1>
        <div style={{ fontSize: 13, color: gray, marginTop: 4 }}>
          Cruzamento dos pedidos Ybera com a base, por email/telefone. Atualizado diariamente.
        </div>
      </div>

      {/* Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginTop: 18 }}>
        <Stat label="Receita Ybera (total)" value={brl(o.totalRevenue)} sub={`${o.totalOrders} pedidos`} />
        <Stat label="Comissão estimada (20%)" value={brl(o.commission)} color={green} />
        <Stat label="Compradores únicos" value={String(o.totalBuyers)} sub={`${o.studentBuyers} alunas · ${o.nonStudentBuyers} grupos/outros`} />
        <Stat label="Recompra (geral)" value={pct(o.repeatOverall)} sub="clientes com 2+ pedidos" />
      </div>

      {/* ── Bloco A: Plano → Ybera ── */}
      <SectionTitle emoji="🎯">Alunas do plano → Ybera (meta principal)</SectionTitle>
      <div style={{ fontSize: 12, color: gray, margin: '-6px 0 12px', lineHeight: 1.5 }}>
        Considera pedidos Ybera atribuídos ao nosso link de afiliado, cruzados por email/telefone das alunas ativas.
        Se a base de alunas for recente, a conversão tende a crescer com o tempo (quem acabou de entrar ainda não comprou).
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        <Card style={{ background: `linear-gradient(135deg, ${accent}, #9d1457)`, border: 'none' }}>
          <div style={{ fontSize: 11, color: '#ffffffcc', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>Taxa de conversão</div>
          <div style={{ fontSize: 34, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{pct(P.conversion)}</div>
          <div style={{ fontSize: 12, color: '#ffffffcc', marginTop: 6 }}>{P.buyers} de {P.activeCount} alunas ativas compraram</div>
        </Card>
        <Stat label="Receita das alunas" value={brl(P.revenue)} />
        <Stat label="Ticket médio" value={brl(P.avgTicket)} sub={`${P.avgOrdersPerBuyer.toFixed(1)} pedidos/compradora`} />
        <Stat label="Tempo até 1ª compra" value={P.avgDaysToFirst == null ? '—' : `${P.avgDaysToFirst} dias`} sub="após entrar no plano (aprox.)" />
        <Stat label="Recompra das alunas" value={pct(P.repeatRate)} sub="compradoras com 2+ pedidos" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
        {/* Cohort */}
        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: ink, marginBottom: 12 }}>Conversão por safra (mês de entrada)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {P.cohorts.length === 0 && <div style={{ fontSize: 13, color: gray }}>Sem dados.</div>}
            {P.cohorts.slice(-8).map(c => (
              <div key={c.ym} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: gray, width: 56 }}>{c.ym}</span>
                <div style={{ flex: 1, height: 16, background: '#F0EAF0', borderRadius: 4, position: 'relative' }}>
                  <div style={{ height: '100%', width: `${c.conv * 100}%`, background: accent, borderRadius: 4, minWidth: c.buyers ? 2 : 0 }} />
                </div>
                <span style={{ fontSize: 11, color: ink, width: 92, textAlign: 'right' }}>{pct(c.conv)} ({c.buyers}/{c.active})</span>
              </div>
            ))}
          </div>
        </Card>
        <TopProducts items={P.topProducts} />
      </div>

      {/* Tabela de alunas */}
      <Card style={{ marginTop: 14, padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid #F0EAF0', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: ink, marginRight: 'auto' }}>Alunas ativas · {rows.length}</div>
          {(['buyers', 'non', 'all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
              border: `1px solid ${filter === f ? accent : '#E5DCE5'}`,
              background: filter === f ? accent : '#fff', color: filter === f ? '#fff' : gray,
            }}>{f === 'buyers' ? 'Compraram' : f === 'non' ? 'Não compraram' : 'Todas'}</button>
          ))}
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar nome/email…" style={{
            fontSize: 12, padding: '7px 12px', borderRadius: 8, border: '1px solid #E5DCE5', minWidth: 180,
          }} />
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
                  <td style={{ padding: '10px 8px' }}>
                    {r.bought
                      ? <span style={{ fontSize: 11, fontWeight: 700, color: green }}>✓ sim</span>
                      : <span style={{ fontSize: 11, color: gray }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', color: ink }}>{r.orders || ''}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', color: ink, fontWeight: r.bought ? 600 : 400 }}>{r.bought ? brl(r.totalSpent) : ''}</td>
                  <td style={{ padding: '10px 8px', color: gray }}>{r.bought ? dt(r.lastPurchase) : ''}</td>
                  <td style={{ padding: '10px 20px', color: gray, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.products.map(p => `${p.name} (${p.qty})`).join(', ')}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: gray }}>Nenhuma aluna nesse filtro.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Bloco B: Grupos / outros ── */}
      <SectionTitle emoji="🛍️">Grupos / outros → Ybera (não-alunas)</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        <Stat label="Compradores (não-alunas)" value={String(G.buyers)} sub={`${G.fgMatched} vindos do quiz fashion-gold`} />
        <Stat label="Receita do canal" value={brl(G.revenue)} />
        <Stat label="Ticket médio" value={brl(G.avgTicket)} sub={`${G.avgOrdersPerBuyer.toFixed(1)} pedidos/cliente`} />
        <Stat label="Recompra" value={pct(G.repeatRate)} sub="clientes com 2+ pedidos" color={green} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
        {/* Recorrência */}
        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: ink, marginBottom: 12 }}>Recorrência (nº de pedidos por cliente)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(['1', '2', '3', '4+'] as const).map(b => {
              const total = Math.max(G.buyers, 1)
              const v = G.dist[b] ?? 0
              return (
                <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, color: gray, width: 28 }}>{b}x</span>
                  <div style={{ flex: 1, height: 16, background: '#F0EAF0', borderRadius: 4 }}>
                    <div style={{ height: '100%', width: `${(v / total) * 100}%`, background: b === '1' ? gray : green, borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: 11, color: ink, width: 80, textAlign: 'right' }}>{v} ({pct(v / total)})</span>
                </div>
              )
            })}
          </div>
        </Card>
        <TopProducts items={G.topProducts} />
      </div>

      {/* Tendência mensal */}
      <Card style={{ marginTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: ink, marginBottom: 14 }}>Receita mensal — grupos/outros</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 90 }}>
          {G.monthly.length === 0 && <div style={{ fontSize: 13, color: gray }}>Sem dados.</div>}
          {G.monthly.map(m => (
            <div key={m.ym} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }} title={`${m.ym}: ${brl(m.revenue)} · ${m.orders} pedidos`}>
              <div style={{ width: '100%', height: `${Math.max((m.revenue / monMax) * 84, m.revenue > 0 ? 3 : 0)}px`, background: gold, borderRadius: '3px 3px 0 0' }} />
              <div style={{ fontSize: 8.5, color: gray, marginTop: 4 }}>{m.ym.slice(5)}/{m.ym.slice(2, 4)}</div>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ height: 40 }} />
    </div>
  )
}
