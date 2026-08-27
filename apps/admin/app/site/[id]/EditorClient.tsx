'use client'

import { useState } from 'react'
import Link from 'next/link'
import { T } from '../../theme'

interface Item {
  id: number
  kind: string
  path: string
  title: string
  content_clean: string | null
  excerpt_html: string | null
  seo_title: string | null
  seo_description: string | null
  og_image: string | null
  status: string
  noindex: boolean
  published_at: string | null
  modified_at: string | null
  revisado_em: string | null
  word_count: number | null
  affiliate_url: string | null
  price_cents: number | null
}

interface Metricas {
  gsc_clicks: number
  gsc_impressions: number
  gsc_position: number | null
  is_top50: boolean
}

const campo: React.CSSProperties = {
  width: '100%', padding: '0.7rem 0.9rem', border: `1px solid ${T.champagne}`,
  borderRadius: 10, fontSize: '0.95rem', fontFamily: 'inherit', background: '#fff',
}

const rotulo: React.CSSProperties = {
  fontWeight: 700, fontSize: '0.82rem', color: T.ink,
  display: 'block', marginBottom: '0.35rem',
}

/** Google corta o título por volta de 60 caracteres e a descrição por volta de 155. */
const LIM_TITULO = 60
const LIM_DESC = 155

function Medidor({ valor, limite }: { valor: string; limite: number }) {
  const n = valor.length
  const cor = n === 0 ? T.inkMuted : n > limite ? T.pinkDeep : '#3d8f5e'
  return (
    <span style={{ fontSize: '0.78rem', color: cor, fontWeight: 600 }}>
      {n}/{limite}
      {n > limite && ' — o Google vai cortar'}
      {n === 0 && ' — vazio'}
    </span>
  )
}

export default function EditorClient({
  item, faq, metricas,
}: {
  item: Item
  faq: { id: number; pergunta: string; resposta: string; revisao_status: string; revisao_motivo: string | null }[]
  metricas: Metricas | null
}) {
  const [titulo, setTitulo] = useState(item.title)
  const [seoTitulo, setSeoTitulo] = useState(item.seo_title ?? '')
  const [seoDesc, setSeoDesc] = useState(item.seo_description ?? '')
  const [conteudo, setConteudo] = useState(item.content_clean ?? '')
  const [status, setStatus] = useState(item.status)
  const [revisadoEm, setRevisadoEm] = useState<string | null>(item.revisado_em)
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState('')

  const sujo =
    titulo !== item.title ||
    seoTitulo !== (item.seo_title ?? '') ||
    seoDesc !== (item.seo_description ?? '') ||
    conteudo !== (item.content_clean ?? '') ||
    status !== item.status

  async function marcarRevisado() {
    setSalvando(true)
    setAviso('')
    try {
      const r = await fetch('/api/site/conteudo', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, marcar_revisado: !revisadoEm }),
      })
      const d = await r.json()
      if (!r.ok) { setAviso(d.error || 'Não consegui marcar.'); return }
      const agora = revisadoEm ? null : new Date().toISOString()
      setRevisadoEm(agora)
      setAviso(
        agora
          ? 'Marcado como revisado hoje. O Google vê essa data como a atualização do conteúdo.'
          : 'Marca de revisão removida.',
      )
    } finally {
      setSalvando(false)
    }
  }

  async function salvar(novoStatus?: string) {
    setSalvando(true)
    setAviso('')
    try {
      const r = await fetch('/api/site/conteudo', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          title: titulo,
          seo_title: seoTitulo || null,
          seo_description: seoDesc || null,
          content_clean: conteudo,
          status: novoStatus ?? status,
          modified_at: new Date().toISOString(),
          ...(novoStatus === 'publish' && !item.published_at
            ? { published_at: new Date().toISOString() }
            : {}),
        }),
      })
      const d = await r.json()
      if (!r.ok) { setAviso(d.error || 'Não consegui salvar.'); return }
      if (novoStatus) setStatus(novoStatus)
      setAviso(
        novoStatus === 'publish'
          ? 'Publicado. O site atualiza em até 1 hora.'
          : 'Salvo.',
      )
    } finally {
      setSalvando(false)
    }
  }

  return (
    <main style={{ flex: 1, overflowY: 'auto', padding: '2rem 2.5rem 4rem' }}>
      <Link href="/site" style={{ color: T.inkSoft, fontSize: '0.88rem' }}>← voltar</Link>

      <header style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: T.ink, maxWidth: '40rem' }}>{item.title}</h1>
          <p style={{ color: T.inkMuted, fontSize: '0.85rem', marginTop: '0.3rem' }}>
            {item.path}
            {' · '}
            <a href={`https://novo.julianecost.com${item.path}`} target="_blank" rel="noopener noreferrer" style={{ color: T.pink }}>
              ver no site ↗
            </a>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          {/* Reler um artigo e confirmar que continua valendo É uma atualização
              de conteúdo, mesmo sem trocar uma vírgula. Este botão conta isso
              ao Google sem exigir uma edição de fachada. */}
          <button
            onClick={marcarRevisado}
            disabled={salvando}
            title={
              revisadoEm
                ? `Revisado em ${new Date(revisadoEm).toLocaleDateString('pt-BR')}. Clique para desfazer.`
                : 'Marca a data de hoje como a revisão deste conteúdo'
            }
            style={{
              background: revisadoEm ? T.pinkSoft : T.surface,
              color: revisadoEm ? T.pinkDeep : T.inkSoft,
              fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem',
              border: `1px solid ${revisadoEm ? T.pink : T.champagne}`,
              padding: '0.7rem 1.1rem', borderRadius: 10,
            }}
          >
            {revisadoEm
              ? `✓ Revisado ${new Date(revisadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
              : 'Marcar como revisado'}
          </button>
          <button
            onClick={() => salvar()}
            disabled={salvando || !sujo}
            style={{
              background: T.surface, color: T.ink, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${T.champagne}`, padding: '0.7rem 1.3rem', borderRadius: 10,
              opacity: salvando || !sujo ? 0.5 : 1,
            }}
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
          {status === 'publish' ? (
            <button
              onClick={() => salvar('draft')}
              disabled={salvando}
              style={{ background: T.surface, color: T.inkSoft, fontWeight: 700, cursor: 'pointer', border: `1px solid ${T.champagne}`, padding: '0.7rem 1.3rem', borderRadius: 10 }}
            >
              Tirar do ar
            </button>
          ) : (
            <button
              onClick={() => salvar('publish')}
              disabled={salvando}
              style={{ background: T.pink, color: '#fff', fontWeight: 700, cursor: 'pointer', border: 0, padding: '0.7rem 1.4rem', borderRadius: 10 }}
            >
              Publicar
            </button>
          )}
        </div>
      </header>

      {aviso && (
        <p style={{ marginTop: '1rem', background: T.pinkSoft, color: T.pinkDeep, padding: '0.7rem 1rem', borderRadius: 10, fontWeight: 600, fontSize: '0.9rem' }}>
          {aviso}
        </p>
      )}

      {metricas && metricas.gsc_clicks > 0 && (
        <div style={{ marginTop: '1.25rem', background: T.cream, border: `1px solid ${T.champagne}`, borderRadius: 12, padding: '0.9rem 1.1rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', color: T.inkSoft }}>
            <strong style={{ color: T.ink }}>{metricas.gsc_clicks.toLocaleString('pt-BR')}</strong> cliques em 16 meses
          </span>
          <span style={{ fontSize: '0.85rem', color: T.inkSoft }}>
            <strong style={{ color: T.ink }}>{metricas.gsc_impressions.toLocaleString('pt-BR')}</strong> impressões
          </span>
          {metricas.gsc_position && (
            <span style={{ fontSize: '0.85rem', color: T.inkSoft }}>
              posição média <strong style={{ color: T.ink }}>{metricas.gsc_position}</strong>
            </span>
          )}
          {metricas.is_top50 && (
            <span style={{ fontSize: '0.85rem', color: T.pinkDeep, fontWeight: 700 }}>
              está entre as 50 páginas que trazem 92% do tráfego — cuidado ao mexer
            </span>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------- SEO */}
      <section style={{ marginTop: '1.75rem', background: T.surface, border: `1px solid ${T.champagne}`, borderRadius: 14, padding: '1.4rem' }}>
        <p style={{ fontWeight: 800, color: T.ink, marginBottom: '1rem' }}>Como aparece no Google</p>

        {/* prévia do resultado de busca */}
        <div style={{ background: T.cream, borderRadius: 10, padding: '0.9rem 1.1rem', marginBottom: '1.25rem' }}>
          <p style={{ color: '#1a0dab', fontSize: '1.05rem', lineHeight: 1.3 }}>
            {(seoTitulo || titulo).slice(0, LIM_TITULO) || 'Sem título'}
          </p>
          <p style={{ color: '#006621', fontSize: '0.8rem', marginTop: '0.15rem' }}>
            julianecost.com{item.path}
          </p>
          <p style={{ color: T.inkSoft, fontSize: '0.85rem', marginTop: '0.25rem', lineHeight: 1.45 }}>
            {seoDesc.slice(0, LIM_DESC) || 'Sem descrição — o Google inventa uma, e quase sempre pior que a sua.'}
          </p>
        </div>

        <label style={rotulo}>Título</label>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} style={campo} />

        <label style={{ ...rotulo, marginTop: '1.1rem' }}>
          Título no Google <Medidor valor={seoTitulo || titulo} limite={LIM_TITULO} />
        </label>
        <input
          value={seoTitulo}
          onChange={(e) => setSeoTitulo(e.target.value)}
          placeholder="Se vazio, usa o título acima"
          style={campo}
        />

        <label style={{ ...rotulo, marginTop: '1.1rem' }}>
          Descrição no Google <Medidor valor={seoDesc} limite={LIM_DESC} />
        </label>
        <textarea
          value={seoDesc}
          onChange={(e) => setSeoDesc(e.target.value)}
          rows={3}
          placeholder="A frase que convence a clicar. Sem ela o Google monta uma sozinho."
          style={{ ...campo, resize: 'vertical' }}
        />
      </section>

      {/* ------------------------------------------------------ conteúdo */}
      <section style={{ marginTop: '1.5rem', background: T.surface, border: `1px solid ${T.champagne}`, borderRadius: 14, padding: '1.4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <p style={{ fontWeight: 800, color: T.ink }}>Conteúdo</p>
          <span style={{ fontSize: '0.8rem', color: T.inkSoft }}>
            {conteudo.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length} palavras
          </span>
        </div>
        <textarea
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          rows={26}
          spellCheck
          style={{ ...campo, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.85rem', lineHeight: 1.6, resize: 'vertical' }}
        />
        <p style={{ color: T.inkMuted, fontSize: '0.8rem', marginTop: '0.6rem' }}>
          É HTML. Use &lt;h2&gt; para os títulos das seções — é o que vira o índice do artigo e as âncoras
          que o Google exibe como sublinks. &lt;p&gt; para parágrafo, &lt;strong&gt; para negrito.
        </p>
      </section>

      {/* ------------------------------------------------------------ FAQ */}
      {faq.length > 0 && (
        <section style={{ marginTop: '1.5rem', background: T.surface, border: `1px solid ${T.champagne}`, borderRadius: 14, padding: '1.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontWeight: 800, color: T.ink }}>Perguntas frequentes deste post</p>
            <Link href="/site/faq" style={{ color: T.pink, fontSize: '0.85rem', fontWeight: 600 }}>revisar todas ↗</Link>
          </div>
          <div style={{ marginTop: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {faq.map((q) => (
              <div key={q.id} style={{ border: `1px solid ${T.champagne}`, borderRadius: 10, padding: '0.8rem 1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                  <p style={{ fontWeight: 600, color: T.ink, fontSize: '0.92rem' }}>{q.pergunta}</p>
                  <span style={{
                    flexShrink: 0, fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: 999,
                    background: q.revisao_status === 'aprovada' ? '#e6f4ea' : T.pinkSoft,
                    color: q.revisao_status === 'aprovada' ? '#1e7b40' : T.pinkDeep,
                  }}>
                    {q.revisao_status === 'aprovada' ? 'no ar' : 'fora do ar'}
                  </span>
                </div>
                <p style={{ color: T.inkSoft, fontSize: '0.87rem', marginTop: '0.35rem', lineHeight: 1.55 }}>{q.resposta}</p>
                {q.revisao_motivo && (
                  <p style={{ color: T.inkMuted, fontSize: '0.78rem', marginTop: '0.4rem', fontStyle: 'italic' }}>
                    Reprovada: {q.revisao_motivo}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
