'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { T } from '../theme'
import type { MetricasBioPro, PedidoBioPro } from './page'
import { rotuloEtapa, rotuloProfissao } from './rotulos'

const fmtData = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'
const fmtDataHora = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'
const brl = (c: number) => `R$ ${(c / 100).toFixed(2).replace('.', ',')}`
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '—')

const STATUS_LABEL: Record<string, string> = { pendente: 'Pendente', em_producao: 'Em produção', entregue: 'Entregue' }
const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  pendente: { bg: T.alertSoft, fg: T.alert },
  em_producao: { bg: T.blueSoft, fg: T.blue },
  entregue: { bg: T.greenSoft, fg: T.green },
}

function Badge({ status }: { status: string }) {
  const c = STATUS_COLOR[status] ?? STATUS_COLOR.pendente
  return (
    <span style={{ background: c.bg, color: c.fg, fontWeight: 700, fontSize: '0.78rem', padding: '0.25rem 0.65rem', borderRadius: 999, whiteSpace: 'nowrap' }}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

const cartao: React.CSSProperties = { background: T.surface, border: `1px solid ${T.champagne}`, borderRadius: 14 }
const th: React.CSSProperties = { padding: '0.8rem 1rem', fontSize: '0.75rem', color: T.inkMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'left' }
const td: React.CSSProperties = { padding: '0.75rem 1rem', color: T.inkSoft, fontSize: '0.9rem' }

function linkWhats(tel: string | null, nome: string | null) {
  const d = (tel ?? '').replace(/\D/g, '')
  if (d.length < 10) return null
  const n = (nome ?? '').trim().split(/\s+/)[0] || ''
  const msg = `Oi${n ? `, ${n}` : ''}! Aqui é a Juliane 💛 Vi que você começou a montar seu Link na Bio PRO e não finalizou. Posso te ajudar com alguma dúvida?`
  return `https://wa.me/${d.startsWith('55') ? d : `55${d}`}?text=${encodeURIComponent(msg)}`
}

type Aba = 'pedidos' | 'abandonos' | 'metricas'

export default function LinkBioProClient({ pedidos, abandonos, metricas }: { pedidos: PedidoBioPro[]; abandonos: PedidoBioPro[]; metricas: MetricasBioPro }) {
  const [aba, setAba] = useState<Aba>('pedidos')
  const [filtro, setFiltro] = useState<'todos' | 'pendente' | 'em_producao' | 'entregue'>('todos')

  const contagem = useMemo(() => ({
    pendente: pedidos.filter((p) => p.status_entrega === 'pendente').length,
    em_producao: pedidos.filter((p) => p.status_entrega === 'em_producao').length,
    entregue: pedidos.filter((p) => p.status_entrega === 'entregue').length,
  }), [pedidos])
  const filtrados = useMemo(() => (filtro === 'todos' ? pedidos : pedidos.filter((p) => p.status_entrega === filtro)), [pedidos, filtro])

  const pill = (ativo: boolean): React.CSSProperties => ({
    padding: '0.45rem 0.9rem', borderRadius: 999, fontSize: '0.85rem', fontWeight: 600, border: `1px solid ${T.champagne}`,
    cursor: 'pointer', background: ativo ? T.pink : T.surface, color: ativo ? '#fff' : T.inkSoft,
  })
  const topoFunil = metricas.funil[0]?.qtd ?? 0

  return (
    <main className="dash-main" style={{ marginLeft: 234, flex: 1, overflowY: 'auto', padding: '2rem 2.5rem 4rem' }}>
      <header>
        <h1 style={{ fontSize: '1.7rem', fontWeight: 800, color: T.ink }}>Link na Bio PRO</h1>
        <p style={{ color: T.inkSoft, marginTop: '0.35rem' }}>
          Bio personalizada feita pela Juliane · R$ 19,90 · quiz em planodaju.julianecost.com/link-bio-pro
        </p>
      </header>

      <nav style={{ display: 'flex', gap: '0.5rem', marginTop: '1.4rem', flexWrap: 'wrap' }}>
        <button onClick={() => setAba('pedidos')} style={pill(aba === 'pedidos')}>Pedidos pagos ({pedidos.length})</button>
        <button onClick={() => setAba('abandonos')} style={pill(aba === 'abandonos')}>Abandonos com contato ({abandonos.length})</button>
        <button onClick={() => setAba('metricas')} style={pill(aba === 'metricas')}>Funil e métricas</button>
      </nav>

      {aba === 'pedidos' && (
        <>
          <p style={{ marginTop: '1.25rem', color: T.inkSoft, fontSize: '0.92rem', fontWeight: 600 }}>
            {contagem.pendente} pendentes · {contagem.em_producao} em produção · {contagem.entregue} entregues
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem', flexWrap: 'wrap' }}>
            {(['todos', 'pendente', 'em_producao', 'entregue'] as const).map((f) => (
              <button key={f} onClick={() => setFiltro(f)} style={{ ...pill(filtro === f), fontSize: '0.8rem', padding: '0.35rem 0.8rem' }}>
                {f === 'todos' ? 'Todos' : STATUS_LABEL[f]}
              </button>
            ))}
          </div>
          <section style={{ ...cartao, marginTop: '1rem', overflow: 'hidden' }}>
            {filtrados.length === 0 ? (
              <p style={{ padding: '2rem', textAlign: 'center', color: T.inkMuted }}>Nenhum pedido aqui.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: `1px solid ${T.champagne}` }}>
                  {['Nome', 'Profissão', 'Estilo', 'Data', 'Status', ''].map((h) => <th key={h} style={th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {filtrados.map((p) => (
                    <tr key={p.id} style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                      <td style={{ ...td, fontWeight: 600, color: T.ink }}>{p.nome || '—'}<div style={{ fontSize: '0.78rem', color: T.inkMuted, fontWeight: 400 }}>{p.email}</div></td>
                      <td style={td}>{rotuloProfissao(p.profissao)}</td>
                      <td style={td}>{p.estilo || '—'}</td>
                      <td style={td}>{fmtData(p.criado_em)}</td>
                      <td style={td}><Badge status={p.status_entrega} /></td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <Link href={`/link-bio-pro/${p.id}`} style={{ color: T.pink, fontWeight: 600, fontSize: '0.85rem' }}>Abrir →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

      {aba === 'abandonos' && (
        <>
          <p style={{ marginTop: '1.25rem', color: T.inkSoft, fontSize: '0.9rem', maxWidth: '44rem' }}>
            Deixaram nome e WhatsApp mas não pagaram (últimos {metricas.dias} dias). O botão abre o WhatsApp com uma
            mensagem pronta — vale chamar no mesmo dia.
          </p>
          <section style={{ ...cartao, marginTop: '1rem', overflow: 'hidden' }}>
            {abandonos.length === 0 ? (
              <p style={{ padding: '2rem', textAlign: 'center', color: T.inkMuted }}>Ninguém abandonou com contato nesse período.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: `1px solid ${T.champagne}` }}>
                  {['Nome', 'Profissão', 'Parou em', 'Última atividade', '', ''].map((h, i) => <th key={i} style={th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {abandonos.map((p) => {
                    const wa = linkWhats(p.telefone, p.nome)
                    return (
                      <tr key={p.id} style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                        <td style={{ ...td, fontWeight: 600, color: T.ink }}>{p.nome || '—'}<div style={{ fontSize: '0.78rem', color: T.inkMuted, fontWeight: 400 }}>{p.email}</div></td>
                        <td style={td}>{rotuloProfissao(p.profissao)}</td>
                        <td style={td}>{rotuloEtapa(p.etapa_id)}</td>
                        <td style={td}>{fmtDataHora(p.atualizado_em)}</td>
                        <td style={td}>{wa && <a href={wa} target="_blank" rel="noopener noreferrer" style={{ background: '#25D366', color: '#fff', fontWeight: 700, fontSize: '0.8rem', padding: '0.4rem 0.75rem', borderRadius: 8, textDecoration: 'none', whiteSpace: 'nowrap' }}>WhatsApp</a>}</td>
                        <td style={{ ...td, textAlign: 'right' }}><Link href={`/link-bio-pro/${p.id}`} style={{ color: T.pink, fontWeight: 600, fontSize: '0.85rem' }}>Ver →</Link></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

      {aba === 'metricas' && (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
            {[7, 30, 90].map((d) => (
              <a key={d} href={`?dias=${d}`} style={{ ...pill(metricas.dias === d), textDecoration: 'none', fontSize: '0.8rem', padding: '0.35rem 0.8rem' }}>{d} dias</a>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
            {[
              ['Visitas', String(topoFunil)],
              ['Vendas', String(metricas.pagos)],
              ['Conversão', pct(metricas.pagos, topoFunil)],
              ['Faturamento', brl(metricas.faturamentoCentavos)],
            ].map(([k, v]) => (
              <div key={k} style={{ ...cartao, padding: '1rem 1.1rem' }}>
                <p style={{ fontSize: '0.75rem', color: T.inkMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k}</p>
                <p style={{ fontSize: '1.6rem', fontWeight: 800, color: T.ink, marginTop: '0.2rem' }}>{v}</p>
              </div>
            ))}
          </div>

          <section style={{ ...cartao, padding: '1.25rem', marginTop: '1rem' }}>
            <p style={{ fontWeight: 700, color: T.ink, marginBottom: '0.9rem' }}>Funil por etapa</p>
            {metricas.funil.map((e, i) => {
              const anterior = i > 0 ? metricas.funil[i - 1].qtd : e.qtd
              const largura = topoFunil > 0 ? Math.max(2, (e.qtd / topoFunil) * 100) : 0
              return (
                <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '12rem 1fr 7rem', alignItems: 'center', gap: '0.75rem', marginBottom: '0.45rem' }}>
                  <span style={{ fontSize: '0.86rem', color: T.inkSoft }}>{e.rotulo}</span>
                  <div style={{ background: T.borderSoft, borderRadius: 6, height: 22, overflow: 'hidden' }}>
                    <div style={{ width: `${largura}%`, height: '100%', background: e.id === 'pago' ? T.green : T.pink, borderRadius: 6 }} />
                  </div>
                  <span style={{ fontSize: '0.86rem', color: T.ink, fontWeight: 700 }}>
                    {e.qtd} <span style={{ color: T.inkMuted, fontWeight: 500 }}>{i > 0 ? `(${pct(e.qtd, anterior)})` : ''}</span>
                  </span>
                </div>
              )
            })}
            <p style={{ fontSize: '0.78rem', color: T.inkMuted, marginTop: '0.6rem' }}>
              Entre parênteses: quantos seguiram da etapa anterior. A maior queda é onde vale mexer primeiro.
            </p>
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(20rem, 1fr))', gap: '1rem', marginTop: '1rem' }}>
            <section style={{ ...cartao, overflow: 'hidden' }}>
              <p style={{ fontWeight: 700, color: T.ink, padding: '1rem 1rem 0.25rem' }}>Por profissão</p>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Área', 'Visitas', 'Contatos', 'Vendas'].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {metricas.porProfissao.length === 0 && <tr><td style={td} colSpan={4}>Sem dados ainda.</td></tr>}
                  {metricas.porProfissao.map((p) => (
                    <tr key={p.rotulo} style={{ borderTop: `1px solid ${T.borderSoft}` }}>
                      <td style={{ ...td, color: T.ink, fontWeight: 600 }}>{p.rotulo}</td><td style={td}>{p.visitas}</td><td style={td}>{p.contatos}</td><td style={td}>{p.pagos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section style={{ ...cartao, overflow: 'hidden' }}>
              <p style={{ fontWeight: 700, color: T.ink, padding: '1rem 1rem 0.25rem' }}>Por origem (utm_source)</p>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Origem', 'Visitas', 'Vendas', 'Conversão'].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {metricas.porOrigem.length === 0 && <tr><td style={td} colSpan={4}>Sem dados ainda.</td></tr>}
                  {metricas.porOrigem.map((o) => (
                    <tr key={o.origem} style={{ borderTop: `1px solid ${T.borderSoft}` }}>
                      <td style={{ ...td, color: T.ink, fontWeight: 600 }}>{o.origem}</td><td style={td}>{o.visitas}</td><td style={td}>{o.pagos}</td><td style={td}>{pct(o.pagos, o.visitas)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        </>
      )}
    </main>
  )
}
