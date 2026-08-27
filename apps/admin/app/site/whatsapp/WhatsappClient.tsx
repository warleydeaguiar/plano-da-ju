'use client'

import { useMemo, useState } from 'react'
import { T } from '../../theme'

interface Clique {
  path: string
  produto: string | null
  rotulo: string | null
  dispositivo: string | null
  criado_em: string
}

const PERIODOS = [
  { rotulo: '7 dias', dias: 7 },
  { rotulo: '30 dias', dias: 30 },
  { rotulo: '90 dias', dias: 90 },
] as const

const diaLocal = (iso: string) =>
  new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

export default function WhatsappClient({ cliques }: { cliques: Clique[] }) {
  const [dias, setDias] = useState<number>(30)

  const doPeriodo = useMemo(() => {
    const corte = Date.now() - dias * 24 * 3600 * 1000
    return cliques.filter((c) => new Date(c.criado_em).getTime() >= corte)
  }, [cliques, dias])

  /**
   * Série diária completa, incluindo os dias sem clique.
   *
   * Sem preencher os zeros o gráfico "pula" o dia vazio e a linha some,
   * dando a impressão de continuidade onde houve queda — que é justamente
   * o que a Juliane precisa enxergar.
   */
  const serie = useMemo(() => {
    const porDia = new Map<string, number>()
    for (const c of doPeriodo) {
      const d = diaLocal(c.criado_em)
      porDia.set(d, (porDia.get(d) ?? 0) + 1)
    }
    const saida: { dia: string; total: number }[] = []
    for (let i = dias - 1; i >= 0; i--) {
      const d = diaLocal(new Date(Date.now() - i * 24 * 3600 * 1000).toISOString())
      saida.push({ dia: d, total: porDia.get(d) ?? 0 })
    }
    return saida
  }, [doPeriodo, dias])

  const maximo = Math.max(1, ...serie.map((s) => s.total))
  const total = doPeriodo.length
  const celular = doPeriodo.filter((c) => c.dispositivo === 'celular').length

  const porProduto = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of doPeriodo) {
      const chave = c.produto?.trim() || '(sem produto identificado)'
      m.set(chave, (m.get(chave) ?? 0) + 1)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
  }, [doPeriodo])

  const porPagina = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of doPeriodo) m.set(c.path, (m.get(c.path) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
  }, [doPeriodo])

  return (
    <main style={{ flex: 1, overflowY: 'auto', padding: '2rem 2.5rem 4rem' }}>
      <h1 style={{ fontSize: '1.7rem', fontWeight: 800, color: T.ink }}>Cliques no WhatsApp</h1>
      <p style={{ color: T.inkSoft, marginTop: '0.35rem', maxWidth: '56rem' }}>
        Toda vez que alguém clica num link que leva à sua conversa — o botão do produto ou os
        links dentro dos artigos. É o passo antes da venda, então é o número que mostra se o
        site está entregando gente pra você atender.
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
        {PERIODOS.map((p) => (
          <button
            key={p.dias}
            onClick={() => setDias(p.dias)}
            style={{
              padding: '0.5rem 1.1rem', borderRadius: 999, cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem',
              border: `1px solid ${dias === p.dias ? T.pink : T.champagne}`,
              background: dias === p.dias ? T.pinkSoft : T.surface,
              color: dias === p.dias ? T.pinkDeep : T.inkSoft,
            }}
          >
            {p.rotulo}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))', marginTop: '1.25rem' }}>
        {[
          { rotulo: 'Cliques', valor: total.toLocaleString('pt-BR') },
          { rotulo: 'Média por dia', valor: (total / dias).toFixed(1).replace('.', ',') },
          { rotulo: 'No celular', valor: total ? `${Math.round((celular / total) * 100)}%` : '—' },
          { rotulo: 'Produtos distintos', valor: String(porProduto.filter(([p]) => !p.startsWith('(')).length) },
        ].map((c) => (
          <div key={c.rotulo} style={{ background: T.surface, border: `1px solid ${T.champagne}`, borderRadius: 14, padding: '1rem 1.1rem' }}>
            <p style={{ fontSize: '0.76rem', color: T.inkSoft, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {c.rotulo}
            </p>
            <p style={{ fontSize: '1.6rem', fontWeight: 800, color: T.ink, marginTop: '0.25rem' }}>{c.valor}</p>
          </div>
        ))}
      </div>

      {/* ---------------------------------------------------------- gráfico */}
      <section style={{ background: T.surface, border: `1px solid ${T.champagne}`, borderRadius: 14, padding: '1.4rem', marginTop: '1.5rem' }}>
        <p style={{ fontWeight: 800, color: T.ink, marginBottom: '1.25rem' }}>Cliques por dia</p>

        {total === 0 ? (
          <p style={{ color: T.inkSoft, padding: '2rem 0', textAlign: 'center' }}>
            Nenhum clique ainda neste período. Os números aparecem aqui assim que alguém clicar
            no site.
          </p>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 180 }}>
              {serie.map((s) => (
                <div
                  key={s.dia}
                  title={`${new Date(`${s.dia}T12:00:00`).toLocaleDateString('pt-BR')}: ${s.total} clique(s)`}
                  style={{
                    flex: 1,
                    height: `${Math.max(2, (s.total / maximo) * 100)}%`,
                    background: s.total ? T.pink : T.champagne,
                    borderRadius: '3px 3px 0 0',
                    minWidth: 3,
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.75rem', color: T.inkMuted }}>
              <span>{new Date(`${serie[0].dia}T12:00:00`).toLocaleDateString('pt-BR')}</span>
              <span>pico: {maximo}</span>
              <span>{new Date(`${serie[serie.length - 1].dia}T12:00:00`).toLocaleDateString('pt-BR')}</span>
            </div>
          </>
        )}
      </section>

      {/* --------------------------------------------------------- rankings */}
      <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(20rem, 1fr))', marginTop: '1.5rem' }}>
        {[
          { titulo: 'Produtos mais pedidos', linhas: porProduto },
          { titulo: 'Páginas que mais geram clique', linhas: porPagina },
        ].map((bloco) => (
          <section key={bloco.titulo} style={{ background: T.surface, border: `1px solid ${T.champagne}`, borderRadius: 14, padding: '1.25rem' }}>
            <p style={{ fontWeight: 800, color: T.ink, marginBottom: '0.9rem' }}>{bloco.titulo}</p>
            {bloco.linhas.length === 0 && <p style={{ color: T.inkSoft, fontSize: '0.9rem' }}>Sem dados ainda.</p>}
            {bloco.linhas.map(([nome, n]) => (
              <div key={nome} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.4rem 0', borderTop: `1px solid ${T.champagne}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.88rem', color: T.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {nome}
                  </p>
                  <div style={{ height: 4, background: T.champagne, borderRadius: 2, marginTop: '0.3rem' }}>
                    <div style={{ height: 4, width: `${(n / bloco.linhas[0][1]) * 100}%`, background: T.pink, borderRadius: 2 }} />
                  </div>
                </div>
                <span style={{ fontWeight: 700, color: T.ink, fontSize: '0.9rem' }}>{n}</span>
              </div>
            ))}
          </section>
        ))}
      </div>

      <p style={{ color: T.inkMuted, fontSize: '0.8rem', marginTop: '1.25rem' }}>
        O mesmo clique também vira <strong>generate_lead</strong> no Google Analytics e{' '}
        <strong>Lead</strong> na Meta. Este painel existe porque mostra o número na hora, sem
        a espera do processamento deles.
      </p>
    </main>
  )
}
