'use client'

import { useMemo, useState } from 'react'
import { T, fonts } from '../../theme'

type Day = {
  date: string; clicks: number
  sales: number; revenue: number
  salesOutras: number; salesSemOrigem: number
  salesTotal: number; revenueTotal: number
}
type View = 'dia' | 'semana' | 'mes'
type Periodo = 30 | 90 | 0 // 0 = tudo
type Bucket = {
  key: string; label: string; titulo: string
  clicks: number; sales: number; revenue: number
  outras: number; semOrigem: number; total: number
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const brl = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const brlCurto = (v: number) => (v >= 1000 ? `R$ ${(v / 1000).toFixed(1).replace('.', ',')}k` : `R$ ${Math.round(v)}`)
const num = (v: number) => v.toLocaleString('pt-BR')
const pct = (s: number, c: number) => (c > 0 ? (s / c) * 100 : null)
const pctStr = (v: number | null) => (v != null ? `${v.toFixed(2).replace('.', ',')}%` : '—')
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

function mondayOf(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z')
  const dow = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow))
  return d.toISOString().slice(0, 10)
}

function bucketize(days: Day[], view: View): Bucket[] {
  const map = new Map<string, Bucket & { ini: string; fim: string }>()
  for (const d of days) {
    let key: string, label: string
    if (view === 'dia') { key = d.date; label = dm(d.date) }
    else if (view === 'semana') { key = mondayOf(d.date); label = dm(key) }
    else { key = d.date.slice(0, 7); label = `${MESES[Number(key.slice(5, 7)) - 1]}/${key.slice(2, 4)}` }
    const b = map.get(key) ?? {
      key, label, titulo: '', ini: d.date, fim: d.date,
      clicks: 0, sales: 0, revenue: 0, outras: 0, semOrigem: 0, total: 0,
    }
    b.clicks += d.clicks; b.sales += d.sales; b.revenue += d.revenue
    b.outras += d.salesOutras; b.semOrigem += d.salesSemOrigem; b.total += d.salesTotal
    if (d.date < b.ini) b.ini = d.date
    if (d.date > b.fim) b.fim = d.date
    map.set(key, b)
  }
  return [...map.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(b => ({
      ...b,
      titulo: view === 'dia' ? dm(b.key)
        : view === 'semana' ? `Semana de ${dm(b.ini)} a ${dm(b.fim)}`
        : `${MESES[Number(b.key.slice(5, 7)) - 1]} de ${b.key.slice(0, 4)}`,
    }))
}

export default function ConversaoClient({
  days, metaOk, campanhas,
}: {
  days: Day[]
  metaOk: boolean
  campanhas: Array<{ id: string; nome: string; clicks: number }>
}) {
  const [view, setView] = useState<View>('semana')
  const [periodo, setPeriodo] = useState<Periodo>(90)
  const [sel, setSel] = useState<string | null>(null)

  const janela = useMemo(() => (periodo === 0 ? days : days.slice(-periodo)), [days, periodo])
  const buckets = useMemo(() => bucketize(janela, view), [janela, view])

  const tot = janela.reduce(
    (a, d) => ({
      clicks: a.clicks + d.clicks, sales: a.sales + d.sales, revenue: a.revenue + d.revenue,
      outras: a.outras + d.salesOutras, semOrigem: a.semOrigem + d.salesSemOrigem,
      total: a.total + d.salesTotal, revenueTotal: a.revenueTotal + d.revenueTotal,
    }),
    { clicks: 0, sales: 0, revenue: 0, outras: 0, semOrigem: 0, total: 0, revenueTotal: 0 },
  )
  const conv = pct(tot.sales, tot.clicks)
  const ticket = tot.sales > 0 ? tot.revenue / tot.sales : 0
  const selecionado = buckets.find(b => b.key === sel) ?? null

  return (
    <div style={{ maxWidth: 1180 }}>
      {/* ── Cabeçalho ───────────────────────────────────────────────── */}
      <div style={{ marginBottom: 26 }}>
        <div style={{ fontSize: 27, fontWeight: 600, fontFamily: fonts.display, letterSpacing: -0.6 }}>
          Conversão dos anúncios
        </div>
        <div style={{ fontSize: 13.5, color: T.inkSoft, marginTop: 6, lineHeight: 1.55, maxWidth: 620 }}>
          De cada 100 cliques nos anúncios do Plano, quantos viraram venda paga.
          Só entram as vendas que vieram <strong style={{ color: T.ink }}>dessas mesmas campanhas</strong> —
          as outras aparecem à parte, logo abaixo.
        </div>
      </div>

      {!metaOk && (
        <Aviso>
          Sem dados do Meta Ads agora (token não configurado ou API fora do ar). Sem a lista de campanhas não dá
          para dizer qual venda veio de anúncio: os cliques e a conversão ficam zerados, e todas as
          <strong> {num(tot.total)} vendas</strong> do período aparecem como &ldquo;sem origem registrada&rdquo; no bloco
          abaixo — o total de vendas continua certo, a atribuição é que está indisponível.
        </Aviso>
      )}

      {/* ── Controles ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 20 }}>
        <Grupo
          opcoes={[{ v: 30, t: '30 dias' }, { v: 90, t: '90 dias' }, { v: 0, t: 'Tudo' }]}
          valor={periodo}
          onChange={(v) => { setPeriodo(v as Periodo); setSel(null) }}
        />
        <Grupo
          opcoes={[{ v: 'dia', t: 'Dia' }, { v: 'semana', t: 'Semana' }, { v: 'mes', t: 'Mês' }]}
          valor={view}
          onChange={(v) => { setView(v as View); setSel(null) }}
        />
      </div>

      {/* ── Resumo ──────────────────────────────────────────────────── */}
      <div
        className="dash-grid-4"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 14 }}
      >
        <Stat label="Cliques no anúncio" value={num(tot.clicks)} nota="cliques no link, campanhas do Plano" />
        <Stat label="Vendas desses anúncios" value={num(tot.sales)} cor={T.pinkDeep} nota={`ticket médio ${brl(ticket)}`} />
        <Stat
          label="Conversão"
          value={pctStr(conv)}
          cor={T.green}
          nota={
            tot.clicks === 0 ? 'sem cliques no período'
              : tot.sales === 0 ? 'nenhuma venda atribuída a esses cliques'
              : `1 venda a cada ${Math.round(tot.clicks / tot.sales)} cliques`
          }
          destaque
        />
        <Stat label="Receita desses anúncios" value={brl(tot.revenue)} nota={`de ${brl(tot.revenueTotal)} no total`} />
      </div>

      {/* ── Vendas que não vieram desses anúncios ───────────────────── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center',
        background: T.cream, border: `1px solid ${T.borderSoft}`, borderRadius: 14,
        padding: '14px 18px', marginBottom: 26, fontSize: 13, color: T.inkSoft,
      }}>
        <span style={{ fontWeight: 700, color: T.ink }}>Fora dessa conta:</span>
        <span><strong style={{ color: T.ink }}>{num(tot.semOrigem)}</strong> venda(s) sem origem registrada</span>
        {tot.outras > 0 && <span><strong style={{ color: T.ink }}>{num(tot.outras)}</strong> de outras campanhas</span>}
        <span style={{ color: T.inkMuted }}>
          — total de {num(tot.total)} vendas no período. Cortesias da parceria não entram (não têm pagamento).
        </span>
      </div>

      {/* ── Gráfico ─────────────────────────────────────────────────── */}
      <Card titulo="Cliques e conversão ao longo do tempo" acao={
        <Legenda />
      }>
        <Grafico buckets={buckets} sel={sel} onSel={setSel} />
        <Detalhe b={selecionado} />
      </Card>

      {/* ── Tabela ──────────────────────────────────────────────────── */}
      <Card titulo="Detalhe por período" espacoInterno={false}>
        <div className="tabela-rolavel" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
            <thead>
              <tr style={{ background: T.cream }}>
                {['Período', 'Cliques', 'Vendas', 'Conversão', 'Receita', 'Outras vendas'].map((h, i) => (
                  <th key={h} style={{
                    padding: '11px 16px', textAlign: i === 0 ? 'left' : 'right',
                    fontSize: 11, color: T.inkSoft, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: 0.4, whiteSpace: 'nowrap', borderBottom: `1px solid ${T.borderSoft}`,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...buckets].reverse().map(b => {
                const c = pct(b.sales, b.clicks)
                const ativo = b.key === sel
                return (
                  <tr
                    key={b.key}
                    onMouseEnter={() => setSel(b.key)}
                    style={{ borderBottom: `1px solid ${T.borderSoft}55`, background: ativo ? T.pinkSoft + '66' : 'transparent' }}
                  >
                    <td style={{ padding: '11px 16px', fontSize: 13, fontWeight: 600 }}>{b.label}</td>
                    <td style={{ ...td, color: T.inkSoft }}>{num(b.clicks)}</td>
                    <td style={{ ...td, color: T.pinkDeep, fontWeight: 700 }}>{num(b.sales)}</td>
                    <td style={{ ...td, fontWeight: 700, color: c == null ? T.inkMuted : c >= 3 ? T.green : T.ink }}>{pctStr(c)}</td>
                    <td style={{ ...td, color: T.inkSoft }}>{brl(b.revenue)}</td>
                    <td style={{ ...td, color: T.inkMuted }}>{num(b.outras + b.semOrigem)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Como o número é calculado ───────────────────────────────── */}
      <details style={{
        marginTop: 20, background: T.surface, border: `1px solid ${T.borderSoft}`,
        borderRadius: 14, padding: '14px 18px', fontSize: 12.5, color: T.inkSoft, lineHeight: 1.7,
      }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700, color: T.ink, fontSize: 13 }}>
          Como estes números são calculados
        </summary>
        <ul style={{ margin: '12px 0 0', paddingLeft: 18 }}>
          <li><strong>Cliques</strong>: cliques no link (o que o Meta chama de &ldquo;cliques no link&rdquo;) das campanhas com &ldquo;plano&rdquo; no nome.</li>
          <li><strong>Vendas desses anúncios</strong>: pagamento confirmado cujo lead entrou por uma dessas campanhas (o funil grava o id da campanha no lead).</li>
          <li><strong>Uma venda</strong> = um cliente por dia, pelo menor valor do grupo — mesma regra do painel inicial (o webhook grava o pagamento duas vezes, e o menor valor é o preço sem os juros da parcela).</li>
          <li><strong>Cortesia da parceria não entra</strong> em lugar nenhum desta página: não há pagamento.</li>
          <li>Clique e venda são contados no dia em que aconteceram. Quem clica hoje e compra amanhã aparece em dias diferentes — por isso a visão por semana é mais estável que a por dia.</li>
        </ul>
        {campanhas.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <strong style={{ color: T.ink }}>Campanhas consideradas:</strong>{' '}
            {campanhas.map(c => `${c.nome} (${num(c.clicks)})`).join(' · ')}
          </div>
        )}
      </details>
    </div>
  )
}

const td: React.CSSProperties = { padding: '11px 16px', textAlign: 'right', fontSize: 13 }

/* ── Gráfico: barras de cliques + linha de conversão ─────────────────── */
function Grafico({ buckets, sel, onSel }: { buckets: Bucket[]; sel: string | null; onSel: (k: string | null) => void }) {
  const W = 1000, H = 260, PL = 52, PR = 46, PT = 14, PB = 30
  const iw = W - PL - PR, ih = H - PT - PB
  if (!buckets.length) return <div style={{ padding: 30, textAlign: 'center', color: T.inkMuted, fontSize: 13 }}>Sem dados no período.</div>

  const maxClicks = Math.max(1, ...buckets.map(b => b.clicks))
  const maxConv = Math.max(1, ...buckets.map(b => pct(b.sales, b.clicks) ?? 0))
  const passo = iw / buckets.length
  const larguraBarra = Math.max(2, Math.min(38, passo * 0.62))
  const x = (i: number) => PL + passo * i + passo / 2
  const yClick = (v: number) => PT + ih - (v / maxClicks) * ih
  const yConv = (v: number) => PT + ih - (v / maxConv) * ih

  const pontos = buckets
    .map((b, i) => ({ i, c: pct(b.sales, b.clicks) }))
    .filter(p => p.c != null) as Array<{ i: number; c: number }>
  const linha = pontos.map((p, k) => `${k === 0 ? 'M' : 'L'} ${x(p.i).toFixed(1)} ${yConv(p.c).toFixed(1)}`).join(' ')

  // Rótulos do eixo X sem sobrepor
  const cada = Math.ceil(buckets.length / 14)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }} onMouseLeave={() => onSel(null)}>
      {[0, 0.25, 0.5, 0.75, 1].map(f => {
        const y = PT + ih - f * ih
        return (
          <g key={f}>
            <line x1={PL} x2={W - PR} y1={y} y2={y} stroke={T.borderSoft} strokeWidth={1} />
            <text x={PL - 10} y={y + 4} textAnchor="end" fontSize={10.5} fill={T.inkMuted}>{num(Math.round(maxClicks * f))}</text>
            <text x={W - PR + 10} y={y + 4} textAnchor="start" fontSize={10.5} fill={T.pinkDeep}>
              {(maxConv * f).toFixed(1).replace('.', ',')}%
            </text>
          </g>
        )
      })}

      {buckets.map((b, i) => {
        const ativo = b.key === sel
        const h = (b.clicks / maxClicks) * ih
        return (
          <rect
            key={b.key}
            x={x(i) - larguraBarra / 2} y={yClick(b.clicks)}
            width={larguraBarra} height={Math.max(h, b.clicks > 0 ? 2 : 0)}
            rx={Math.min(4, larguraBarra / 2)}
            fill={ativo ? T.blue : T.blueSoft}
          />
        )
      })}

      {linha && <path d={linha} fill="none" stroke={T.pinkDeep} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />}
      {pontos.map(p => (
        <circle key={p.i} cx={x(p.i)} cy={yConv(p.c)} r={buckets[p.i].key === sel ? 5 : 3} fill={T.pinkDeep} stroke="#fff" strokeWidth={1.5} />
      ))}

      {buckets.map((b, i) => (
        i % cada === 0 ? (
          <text key={b.key} x={x(i)} y={H - 8} textAnchor="middle" fontSize={10.5} fill={T.inkMuted}>{b.label}</text>
        ) : null
      ))}

      {/* Faixas invisíveis para hover/toque */}
      {buckets.map((b, i) => (
        <rect
          key={`h-${b.key}`} x={PL + passo * i} y={PT} width={passo} height={ih}
          fill="transparent" style={{ cursor: 'pointer' }}
          onMouseEnter={() => onSel(b.key)} onClick={() => onSel(b.key)}
        />
      ))}
    </svg>
  )
}

function Detalhe({ b }: { b: Bucket | null }) {
  const c = b ? pct(b.sales, b.clicks) : null
  return (
    <div style={{
      marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.borderSoft}`,
      display: 'flex', flexWrap: 'wrap', gap: 22, alignItems: 'baseline',
      fontSize: 13, color: T.inkSoft, minHeight: 22,
    }}>
      {b ? (
        <>
          <strong style={{ color: T.ink, fontSize: 14 }}>{b.titulo}</strong>
          <span>{num(b.clicks)} cliques</span>
          <span style={{ color: T.pinkDeep, fontWeight: 700 }}>{num(b.sales)} vendas</span>
          <span style={{ color: T.green, fontWeight: 700 }}>{pctStr(c)}</span>
          <span>{brlCurto(b.revenue)}</span>
          {(b.outras + b.semOrigem) > 0 && <span style={{ color: T.inkMuted }}>+{num(b.outras + b.semOrigem)} de outras origens</span>}
        </>
      ) : (
        <span style={{ color: T.inkMuted }}>Passe o mouse (ou toque) no gráfico para ver os números de cada período.</span>
      )}
    </div>
  )
}

function Legenda() {
  return (
    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: T.inkSoft, alignItems: 'center' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 12, height: 12, borderRadius: 3, background: T.blueSoft, display: 'inline-block' }} /> cliques
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 14, height: 3, borderRadius: 2, background: T.pinkDeep, display: 'inline-block' }} /> conversão
      </span>
    </div>
  )
}

/* ── Blocos de UI ────────────────────────────────────────────────────── */
function Card({ titulo, children, acao, espacoInterno = true }: {
  titulo: string; children: React.ReactNode; acao?: React.ReactNode; espacoInterno?: boolean
}) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.borderSoft}`, borderRadius: 16,
      padding: espacoInterno ? '20px 22px 18px' : 0, marginBottom: 22, overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        padding: espacoInterno ? 0 : '16px 20px 14px', marginBottom: espacoInterno ? 16 : 0,
      }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: 0.5 }}>{titulo}</div>
        {acao}
      </div>
      {children}
    </div>
  )
}

function Stat({ label, value, cor, nota, destaque }: {
  label: string; value: string; cor?: string; nota?: string; destaque?: boolean
}) {
  return (
    <div style={{
      background: destaque ? T.greenSoft : T.surface,
      border: `1px solid ${destaque ? T.green + '44' : T.borderSoft}`,
      borderRadius: 16, padding: '18px 20px',
    }}>
      <div style={{ fontSize: 11, color: T.inkSoft, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: cor ?? T.ink, lineHeight: 1.15, margin: '8px 0 4px', letterSpacing: -0.6 }}>{value}</div>
      {nota && <div style={{ fontSize: 11.5, color: T.inkMuted }}>{nota}</div>}
    </div>
  )
}

function Grupo<V extends string | number>({ opcoes, valor, onChange }: {
  opcoes: Array<{ v: V; t: string }>; valor: V; onChange: (v: V) => void
}) {
  return (
    <div style={{ display: 'inline-flex', gap: 3, background: T.surface, border: `1px solid ${T.borderSoft}`, borderRadius: 12, padding: 4 }}>
      {opcoes.map(o => (
        <button key={String(o.v)} onClick={() => onChange(o.v)} style={{
          border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: fonts.ui,
          padding: '7px 15px', borderRadius: 9,
          background: valor === o.v ? T.ink : 'transparent',
          color: valor === o.v ? '#fff' : T.inkSoft,
        }}>{o.t}</button>
      ))}
    </div>
  )
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: T.alertSoft, border: `1px solid ${T.alert}44`, borderRadius: 12,
      padding: '12px 16px', marginBottom: 18, fontSize: 13, color: T.ink, lineHeight: 1.6,
    }}>⚠️ {children}</div>
  )
}
