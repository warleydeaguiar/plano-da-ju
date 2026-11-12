import { COMISSAO_YBERA, type DiarioYbera, type ComoCasou, type LinhaDia } from '@/lib/ybera-diario'

/**
 * Painel /ybera — visão DIA A DIA (investimento × leads × vendas) e
 * "os leads que chegam são os que compram?". Dados em lib/ybera-diario.ts.
 */
const accent = '#BE185D'
const green = '#22A06B'
const gray = '#7C6B7E'
const ink = '#2A1E2C'
const amber = '#B45309'
const linha = '1px solid rgba(0,0,0,0.06)'

const brl = (v: number | null | undefined, casas = 0) =>
  v == null ? '—' : `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}`
const num = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString('pt-BR'))
const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '—')
const div = (a: number | null, b: number) => (a == null || b <= 0 ? null : a / b)
const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const diaCurto = (d: string) => {
  const t = new Date(`${d}T12:00:00Z`)
  return `${DIAS_SEMANA[t.getUTCDay()]} ${d.slice(8, 10)}/${d.slice(5, 7)}`
}
const dataBR = (iso: string) => {
  const t = new Date(new Date(iso).getTime() - 3 * 3600_000)
  return `${String(t.getUTCDate()).padStart(2, '0')}/${String(t.getUTCMonth() + 1).padStart(2, '0')}`
}
const COMO: Record<ComoCasou, string> = { email: 'e-mail', telefone: 'telefone', nome: 'pelo nome' }

function Card({ rotulo, valor, sub, cor }: { rotulo: string; valor: string; sub?: string; cor?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', border: linha }}>
      <div style={{ fontSize: 11, color: gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{rotulo}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: cor ?? ink, marginTop: 6, lineHeight: 1.1 }}>{valor}</div>
      {sub && <div style={{ fontSize: 11.5, color: gray, marginTop: 5, lineHeight: 1.4 }}>{sub}</div>}
    </div>
  )
}

/** Investimento × comissão por dia (SVG puro, sem biblioteca). */
function GraficoRetorno({ dias, hoje }: { dias: LinhaDia[]; hoje: string }) {
  const serie = [...dias].sort((a, b) => a.dia.localeCompare(b.dia))
  const W = 1000, H = 230, topo = 14, base = 26, esq = 46
  const alto = H - topo - base
  const max = Math.max(1, ...serie.map((l) => Math.max(l.investido ?? 0, l.vendas * COMISSAO_YBERA)))
  const passo = (W - esq - 8) / serie.length
  const larg = Math.max(2, Math.min(16, passo / 2 - 2))
  const y = (v: number) => topo + alto - (v / max) * alto
  const marcas = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max)
  const cadaRotulo = Math.ceil(serie.length / 12)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img"
      aria-label="Investimento e comissão por dia">
      {marcas.map((m, i) => (
        <g key={i}>
          <line x1={esq} x2={W - 4} y1={y(m)} y2={y(m)} stroke="rgba(0,0,0,0.06)" />
          <text x={esq - 6} y={y(m) + 4} fontSize="11" fill={gray} textAnchor="end">{m >= 1000 ? `${(m / 1000).toFixed(1)}k` : Math.round(m)}</text>
        </g>
      ))}
      {serie.map((l, i) => {
        const x0 = esq + i * passo + passo / 2
        const inv = l.investido ?? 0
        const com = l.vendas * COMISSAO_YBERA
        const comLead = l.vendasDeLead * COMISSAO_YBERA
        const eHoje = l.dia === hoje
        return (
          <g key={l.dia} opacity={eHoje ? 0.45 : 1}>
            <title>{`${diaCurto(l.dia)} · investido ${brl(inv)} · comissão ${brl(com)} (de leads ${brl(comLead)})`}</title>
            <rect x={x0 - larg - 1} y={y(inv)} width={larg} height={topo + alto - y(inv)} rx="2" fill="#E4A3A3" />
            <rect x={x0 + 1} y={y(com)} width={larg} height={topo + alto - y(com)} rx="2" fill="#A8DCC3" />
            <rect x={x0 + 1} y={y(comLead)} width={larg} height={topo + alto - y(comLead)} rx="2" fill={green} />
            {i % cadaRotulo === 0 && (
              <text x={x0} y={H - 8} fontSize="11" fill={gray} textAnchor="middle">{l.dia.slice(8, 10)}/{l.dia.slice(5, 7)}</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

function LinhaRoi({ titulo, sub, comissao, investido }: { titulo: string; sub: string; comissao: number; investido: number | null }) {
  const lucro = investido == null ? null : comissao - investido
  const roi = investido ? (comissao - investido) / investido : null
  const cor = lucro == null ? ink : lucro >= 0 ? green : '#DC2626'
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.6fr) repeat(3, minmax(110px, 1fr))', gap: 12, alignItems: 'center', padding: '12px 0', borderTop: linha }}>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: ink }}>{titulo}</div>
        <div style={{ fontSize: 11.5, color: gray, marginTop: 2, lineHeight: 1.4 }}>{sub}</div>
      </div>
      <div><div style={{ fontSize: 10.5, color: gray, textTransform: 'uppercase', fontWeight: 600 }}>Comissão</div><div style={{ fontSize: 16, fontWeight: 700, color: ink }}>{brl(comissao)}</div></div>
      <div><div style={{ fontSize: 10.5, color: gray, textTransform: 'uppercase', fontWeight: 600 }}>Lucro</div><div style={{ fontSize: 16, fontWeight: 700, color: cor }}>{brl(lucro)}</div></div>
      <div><div style={{ fontSize: 10.5, color: gray, textTransform: 'uppercase', fontWeight: 600 }}>ROI</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: cor }}>{roi == null ? '—' : `${roi >= 0 ? '+' : ''}${(roi * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`}</div></div>
    </div>
  )
}

export default function Diario({ d, nDias }: { d: DiarioYbera; nDias: number }) {
  const t = d.totais
  const c = d.coorte
  const cpl = div(t.investido, t.leads)
  const roas = div(t.vendas, t.investido ?? 0)
  const custoCompradora = div(t.investido, c.compraram)
  const th: React.CSSProperties = { padding: '9px 10px', fontSize: 11, color: gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'right', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '9px 10px', fontSize: 13, color: ink, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }

  return (
    <section style={{ marginBottom: 36 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: ink }}>Dia a dia: anúncio → lead → venda</div>
          <div style={{ fontSize: 12.5, color: gray, marginTop: 3 }}>
            Campanhas &ldquo;Grupo&rdquo; na Meta (com imposto) · quiz /quiz/fashion-gold · pedidos da Ybera ({d.desde.slice(8, 10)}/{d.desde.slice(5, 7)} a hoje)
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[7, 30, 90].map((n) => (
            <a key={n} href={`/ybera?dias=${n}`} style={{
              padding: '6px 14px', borderRadius: 99, fontSize: 12.5, fontWeight: 700, textDecoration: 'none',
              background: n === nDias ? ink : '#fff', color: n === nDias ? '#fff' : gray, border: n === nDias ? 'none' : linha,
            }}>{n} dias</a>
          ))}
        </div>
      </div>

      {d.metaStatus !== 'ok' && (
        <div style={{ background: '#FEF3C7', color: amber, borderRadius: 10, padding: '9px 14px', fontSize: 12.5, marginBottom: 12 }}>
          A Meta não respondeu agora ({d.metaErro ?? d.metaStatus}) — investimento e custo por lead ficam em branco.
        </div>
      )}

      {/* ── O período ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 12 }}>
        <Card rotulo="Investido" valor={brl(t.investido)} sub={t.investido != null ? `${brl(t.investido / nDias)} por dia · ${num(t.cliques)} cliques` : undefined} />
        <Card rotulo="Leads do quiz" valor={num(t.leads)} sub={`${pct(t.leads, t.visitas)} das ${num(t.visitas)} visitas`} />
        <Card rotulo="Custo por lead" valor={brl(cpl, 2)} />
        <Card rotulo="Entraram no grupo" valor={num(t.entradasGrupo)} sub="cliques no convite do grupo" />
        <Card rotulo="Vendas Ybera" valor={brl(t.vendas)} sub={`${num(t.pedidos)} pedidos`} cor={green} />
        <Card rotulo="Vendas ÷ investido" valor={roas == null ? '—' : `${roas.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}×`}
          sub="sobre o valor vendido (não a comissão)" />
      </div>

      {/* ── Retorno: comissão de 20% × investimento ── */}
      {(() => {
        // Sem HOJE: o investimento de hoje já existe, mas os pedidos de hoje a Ybera só publica amanhã.
        const fechados = d.dias.filter((l) => l.dia !== d.ate)
        const inv = t.investido == null ? null : fechados.reduce((s, l) => s + (l.investido ?? 0), 0)
        const vendas = fechados.reduce((s, l) => s + l.vendas, 0)
        const vendasLead = fechados.reduce((s, l) => s + l.vendasDeLead, 0)
        const pc = `${Math.round(COMISSAO_YBERA * 100)}%`
        return (
          <div style={{ background: '#fff', borderRadius: 14, border: linha, padding: '18px 20px', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: ink }}>Retorno: comissão de {pc} × investimento em anúncio</div>
              <div style={{ fontSize: 11.5, color: gray }}>Período fechado, sem hoje · investido {brl(inv)}</div>
            </div>
            <div style={{ marginTop: 10 }}>
              <LinhaRoi titulo="Vendas que vieram do anúncio" comissao={vendasLead * COMISSAO_YBERA} investido={inv}
                sub={`${pc} de ${brl(vendasLead)} — pedidos de quem virou lead no quiz antes de comprar. O número mais justo.`} />
              <LinhaRoi titulo={`Leads destes ${nDias} dias, até agora`} comissao={c.valor * COMISSAO_YBERA} investido={inv}
                sub={`${pc} do que os ${num(c.compraram)} leads do período já compraram. Sobe nos próximos dias (compram em ~${c.diasMedios == null ? '?' : Math.round(c.diasMedios)} dias).`} />
              <LinhaRoi titulo="Todas as vendas da Ybera" comissao={vendas * COMISSAO_YBERA} investido={inv}
                sub={`${pc} de ${brl(vendas)} — inclui quem compra sem passar pelo quiz (grupos antigos, indicação). Teto otimista.`} />
            </div>
            <div style={{ marginTop: 14 }}>
              <GraficoRetorno dias={d.dias} hoje={d.ate} />
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11.5, color: gray, marginTop: 6 }}>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#E4A3A3', marginRight: 5 }} />Investido</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: green, marginRight: 5 }} />Comissão das vendas de leads</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#A8DCC3', marginRight: 5 }} />Comissão do resto das vendas</span>
                <span>· hoje aparece apagado (vendas ainda não publicadas)</span>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Os leads compram? ── */}
      <div style={{ background: '#fff', borderRadius: 14, border: linha, padding: '18px 20px', marginBottom: 12 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: ink }}>Os leads que chegam são os que compram?</div>
        <div style={{ fontSize: 12, color: gray, margin: '3px 0 14px', lineHeight: 1.5 }}>
          Cada pedido da Ybera é comparado com os leads do quiz por e-mail, telefone (DDD + 8 dígitos) e, por último, nome completo.
          Conta como &ldquo;de lead&rdquo; quando ela virou lead <strong>antes</strong> de comprar.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
          <Card rotulo="Pedidos de quem era lead" valor={pct(t.pedidosDeLead, t.pedidos)}
            sub={`${num(t.pedidosDeLead)} de ${num(t.pedidos)} pedidos · ${brl(t.vendasDeLead)}`} cor={accent} />
          <Card rotulo={`Leads destes ${nDias} dias que compraram`} valor={num(c.compraram)}
            sub={`${pct(c.compraram, c.leads)} dos ${num(c.leads)} leads · ${num(c.novasClientes)} clientes novas`} cor={accent} />
          <Card rotulo="Quanto eles compraram" valor={brl(c.valor)} sub={c.compraram ? `${brl(c.valor / c.compraram)} por compradora` : undefined} />
          <Card rotulo="Dias até comprar" valor={c.diasMedios == null ? '—' : c.diasMedios.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
            sub="média entre virar lead e a 1ª compra" />
          <Card rotulo="Custo por compradora" valor={brl(custoCompradora)} sub="investido ÷ leads do período que compraram" />
        </div>
        <div style={{ fontSize: 11.5, color: gray, marginTop: 10 }}>
          Como casou: {c.porComo.email} por e-mail · {c.porComo.telefone} por telefone · {c.porComo.nome} pelo nome.
          {' '}Leads recentes ainda têm tempo para comprar: o número cresce nos próximos dias.
        </div>
      </div>

      {/* ── Tabela dia a dia ── */}
      <div style={{ background: '#fff', borderRadius: 14, border: linha, overflowX: 'auto', marginBottom: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: linha }}>
              <th style={{ ...th, textAlign: 'left' }}>Dia</th>
              <th style={th}>Investido</th><th style={th}>Cliques</th><th style={th}>Visitas</th><th style={th}>Leads</th>
              <th style={th}>Custo/lead</th><th style={th}>Grupo</th><th style={th}>Pedidos</th><th style={th}>Vendas</th>
              <th style={th}>De lead</th>
            </tr>
          </thead>
          <tbody>
            {d.dias.map((l) => {
              const c2 = div(l.investido, l.leads)
              const hoje = l.dia === d.ate
              return (
                <tr key={l.dia} style={{ borderBottom: linha, background: hoje ? '#FFFBF5' : undefined }}>
                  <td style={{ ...td, textAlign: 'left', fontWeight: 600 }}>{diaCurto(l.dia)}{hoje ? ' · hoje' : ''}</td>
                  <td style={td}>{brl(l.investido)}</td>
                  <td style={td}>{num(l.cliques)}</td>
                  <td style={td}>{num(l.visitas)}</td>
                  <td style={td}>{num(l.leads)}</td>
                  <td style={td}>{brl(c2, 2)}</td>
                  <td style={td}>{num(l.entradasGrupo)}</td>
                  <td style={td}>{hoje && l.pedidos === 0 ? <span style={{ color: gray }}>—</span> : num(l.pedidos)}</td>
                  <td style={{ ...td, color: green, fontWeight: 600 }}>{hoje && l.pedidos === 0 ? '' : brl(l.vendas)}</td>
                  <td style={{ ...td, color: accent }}>{l.pedidosDeLead ? `${l.pedidosDeLead} · ${brl(l.vendasDeLead)}` : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div style={{ fontSize: 11, color: gray, padding: '9px 12px' }}>
          Os pedidos de hoje aparecem quando a Ybera os publica (costuma ser no dia seguinte).
          {d.ultimaSincronizacao && <> Última sincronização: {dataBR(d.ultimaSincronizacao)}.</>}
        </div>
      </div>

      {/* ── Quem comprou ── */}
      {c.lista.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2.2fr) minmax(240px, 1fr)', gap: 12, alignItems: 'start' }}>
          <div style={{ background: '#fff', borderRadius: 14, border: linha, overflowX: 'auto' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: ink, padding: '14px 16px 6px' }}>Leads destes {nDias} dias que compraram</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: linha }}>
                  <th style={{ ...th, textAlign: 'left' }}>Cliente</th><th style={th}>Virou lead</th><th style={th}>Comprou</th>
                  <th style={th}>Dias</th><th style={th}>Valor</th><th style={{ ...th, textAlign: 'left' }}>Produtos</th>
                </tr>
              </thead>
              <tbody>
                {c.lista.map((x, i) => (
                  <tr key={i} style={{ borderBottom: linha, verticalAlign: 'top' }}>
                    <td style={{ ...td, textAlign: 'left', whiteSpace: 'normal', minWidth: 150 }}>
                      <div style={{ fontWeight: 600 }}>{x.nome}</div>
                      <div style={{ fontSize: 11, color: x.como === 'nome' ? amber : gray }}>
                        {COMO[x.como]}{x.como === 'nome' ? ' (confira)' : ''}{x.pedidos > 1 ? ` · ${x.pedidos} pedidos` : ''}{x.novaCliente ? '' : ' · já era cliente'}
                      </div>
                    </td>
                    <td style={td}>{dataBR(x.entrouEm)}</td>
                    <td style={td}>{dataBR(x.primeiraCompra)}</td>
                    <td style={td}>{x.dias}</td>
                    <td style={{ ...td, color: green, fontWeight: 600 }}>{brl(x.valor)}</td>
                    <td style={{ ...td, textAlign: 'left', whiteSpace: 'normal', fontSize: 12, color: gray, minWidth: 220 }}>{x.produtos.join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ background: '#fff', borderRadius: 14, border: linha, padding: '14px 16px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: ink, marginBottom: 10 }}>O que os leads compram</div>
            {c.produtos.map((p) => (
              <div key={p.nome} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5, padding: '6px 0', borderBottom: linha }}>
                <span style={{ color: ink }}>{p.nome}</span>
                <span style={{ color: gray, fontWeight: 700, whiteSpace: 'nowrap' }}>{p.qtd}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
