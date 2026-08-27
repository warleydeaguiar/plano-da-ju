'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { T } from '../theme'

interface Linha {
  id: number
  kind: string
  path: string
  title: string
  status: string
  word_count: number | null
  published_at: string | null
  modified_at: string | null
  revisado_em: string | null
  seo_description: string | null
  og_image: string | null
  cliques: number
  top50: boolean
}

const data = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

export default function SiteClient({
  linhas, faqPendentes, faqAprovadas, faqReprovadas,
}: {
  linhas: Linha[]
  faqPendentes: number
  faqAprovadas: number
  faqReprovadas: number
}) {
  const router = useRouter()
  const [busca, setBusca] = useState('')
  const [tipo, setTipo] = useState<'todos' | 'post' | 'page' | 'product'>('post')
  const [soProblema, setSoProblema] = useState(false)
  const [criando, setCriando] = useState(false)
  const [tituloNovo, setTituloNovo] = useState('')
  const [erro, setErro] = useState('')

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return linhas.filter((l) => {
      if (tipo !== 'todos' && l.kind !== tipo) return false
      if (q && !l.title.toLowerCase().includes(q) && !l.path.toLowerCase().includes(q)) return false
      // "com problema" = o que o Google penaliza calado: sem descrição ou nunca atualizado
      if (soProblema) {
        const atualizadoEm = l.revisado_em || l.modified_at
    const velho = !atualizadoEm || new Date(atualizadoEm) < new Date('2025-01-01')
        if (l.seo_description && !velho) return false
      }
      return true
    })
  }, [linhas, busca, tipo, soProblema])

  const semDescricao = linhas.filter((l) => l.kind === 'post' && !l.seo_description).length

  async function criar() {
    setErro('')
    if (!tituloNovo.trim()) return
    setCriando(true)
    try {
      const r = await fetch('/api/site/conteudo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: tituloNovo }),
      })
      const d = await r.json()
      if (!r.ok) { setErro(d.error || 'Não consegui criar.'); return }
      router.push(`/site/${d.id}`)
    } finally {
      setCriando(false)
    }
  }

  return (
    <main className="dash-main" style={{ marginLeft: 234, flex: 1, overflowY: 'auto', padding: '2rem 2.5rem' }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.7rem', fontWeight: 800, color: T.ink }}>Site</h1>
          <p style={{ color: T.inkSoft, marginTop: '0.35rem' }}>
            O conteúdo de julianecost.com. Publicar aqui coloca no ar sem passar pelo WordPress.
          </p>
        </div>
        <a
          href="https://novo.julianecost.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: T.pink, fontWeight: 600, fontSize: '0.9rem' }}
        >
          ver o site ↗
        </a>
      </header>

      {/* ------------------------------------------------------------ resumo */}
      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))', marginTop: '1.75rem' }}>
        {[
          { rotulo: 'Posts', valor: linhas.filter((l) => l.kind === 'post').length },
          { rotulo: 'Produtos', valor: linhas.filter((l) => l.kind === 'product').length },
          { rotulo: 'Sem descrição', valor: semDescricao, alerta: semDescricao > 0 },
          { rotulo: 'FAQ no ar', valor: faqAprovadas },
          { rotulo: 'FAQ pendente', valor: faqPendentes, alerta: faqPendentes > 0 },
        ].map((c) => (
          <div key={c.rotulo} style={{ background: T.surface, border: `1px solid ${T.champagne}`, borderRadius: 14, padding: '1rem 1.1rem' }}>
            <p style={{ fontSize: '0.78rem', color: T.inkSoft, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {c.rotulo}
            </p>
            <p style={{ fontSize: '1.6rem', fontWeight: 800, color: c.alerta ? T.pinkDeep : T.ink, marginTop: '0.3rem' }}>
              {c.valor}
            </p>
          </div>
        ))}
      </div>

      {faqReprovadas > 0 && (
        <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: T.inkSoft }}>
          {faqReprovadas} perguntas do FAQ foram reprovadas na revisão e não aparecem no site.{' '}
          <Link href="/site/faq" style={{ color: T.pink, fontWeight: 600 }}>Ver e decidir</Link>
        </p>
      )}

      {/* ------------------------------------------------------- post novo */}
      <section style={{ background: T.surface, border: `1px solid ${T.champagne}`, borderRadius: 14, padding: '1.25rem', marginTop: '1.75rem' }}>
        <p style={{ fontWeight: 700, color: T.ink }}>Escrever post novo</p>
        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
          <input
            value={tituloNovo}
            onChange={(e) => setTituloNovo(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') criar() }}
            placeholder="Título do post"
            style={{ flex: 1, minWidth: '18rem', padding: '0.7rem 0.9rem', border: `1px solid ${T.champagne}`, borderRadius: 10, fontSize: '0.95rem' }}
          />
          <button
            onClick={criar}
            disabled={criando || !tituloNovo.trim()}
            style={{
              background: T.pink, color: '#fff', fontWeight: 700, border: 0,
              padding: '0.7rem 1.4rem', borderRadius: 10, cursor: 'pointer',
              opacity: criando || !tituloNovo.trim() ? 0.5 : 1,
            }}
          >
            {criando ? 'Criando…' : 'Criar'}
          </button>
        </div>
        {erro && <p style={{ color: T.pinkDeep, fontSize: '0.85rem', marginTop: '0.6rem' }}>{erro}</p>}
        <p style={{ color: T.inkSoft, fontSize: '0.82rem', marginTop: '0.6rem' }}>
          Nasce como rascunho. Só vai ao ar quando você mandar publicar.
        </p>
      </section>

      {/* --------------------------------------------------------- filtros */}
      <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por título ou endereço"
          style={{ flex: 1, minWidth: '16rem', padding: '0.6rem 0.9rem', border: `1px solid ${T.champagne}`, borderRadius: 10 }}
        />
        {(['post', 'product', 'page', 'todos'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTipo(t)}
            style={{
              padding: '0.55rem 1rem', borderRadius: 999, cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem',
              border: `1px solid ${tipo === t ? T.pink : T.champagne}`,
              background: tipo === t ? T.pinkSoft : T.surface,
              color: tipo === t ? T.pinkDeep : T.inkSoft,
            }}
          >
            {{ post: 'Posts', product: 'Produtos', page: 'Páginas', todos: 'Todos' }[t]}
          </button>
        ))}
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem', color: T.inkSoft, cursor: 'pointer' }}>
          <input type="checkbox" checked={soProblema} onChange={(e) => setSoProblema(e.target.checked)} />
          só com pendência
        </label>
      </div>

      {/* ---------------------------------------------------------- tabela */}
      <div style={{ background: T.surface, border: `1px solid ${T.champagne}`, borderRadius: 14, marginTop: '1rem', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ background: T.cream, textAlign: 'left' }}>
              {['Título', 'Cliques (16m)', 'Palavras', 'Atualizado', 'Situação'].map((h) => (
                <th key={h} style={{ padding: '0.7rem 1rem', fontWeight: 700, color: T.inkSoft, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtradas.map((l) => (
              <tr key={l.id} style={{ borderTop: `1px solid ${T.champagne}` }}>
                <td style={{ padding: '0.7rem 1rem', maxWidth: '30rem' }}>
                  <Link href={`/site/${l.id}`} style={{ color: T.ink, fontWeight: 600 }}>{l.title}</Link>
                  {l.top50 && (
                    <span title="Está entre as 50 páginas que concentram 92% dos cliques" style={{ marginLeft: '0.5rem', fontSize: '0.7rem', background: T.pinkSoft, color: T.pinkDeep, padding: '0.1rem 0.45rem', borderRadius: 999, fontWeight: 700 }}>
                      top 50
                    </span>
                  )}
                  <div style={{ color: T.inkMuted, fontSize: '0.78rem', marginTop: '0.15rem' }}>{l.path}</div>
                </td>
                <td style={{ padding: '0.7rem 1rem', color: l.cliques ? T.ink : T.inkMuted, fontWeight: l.cliques ? 700 : 400 }}>
                  {l.cliques ? l.cliques.toLocaleString('pt-BR') : '—'}
                </td>
                <td style={{ padding: '0.7rem 1rem', color: T.inkSoft }}>{l.word_count ?? '—'}</td>
                <td style={{ padding: '0.7rem 1rem', color: T.inkSoft }}>
                  {data(l.revisado_em || l.modified_at)}
                  {l.revisado_em && (
                    <span title="Você marcou este conteúdo como revisado" style={{ color: T.pinkDeep, marginLeft: '0.35rem' }}>✓</span>
                  )}
                </td>
                <td style={{ padding: '0.7rem 1rem' }}>
                  {l.status !== 'publish' ? (
                    <span style={{ color: T.inkSoft, fontWeight: 600 }}>rascunho</span>
                  ) : !l.seo_description ? (
                    <span style={{ color: T.pinkDeep, fontWeight: 600 }}>sem descrição</span>
                  ) : (
                    <span style={{ color: '#3d8f5e', fontWeight: 600 }}>no ar</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtradas.length && (
          <p style={{ padding: '2rem', textAlign: 'center', color: T.inkSoft }}>Nada encontrado.</p>
        )}
      </div>

      <p style={{ color: T.inkMuted, fontSize: '0.8rem', marginTop: '1rem', paddingBottom: '2rem' }}>
        Mostrando {filtradas.length} de {linhas.length}.
      </p>
    </main>
  )
}
