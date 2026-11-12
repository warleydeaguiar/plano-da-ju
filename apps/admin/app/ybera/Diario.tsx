import type { DiarioYbera, ComoCasou } from '@/lib/ybera-diario'

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
