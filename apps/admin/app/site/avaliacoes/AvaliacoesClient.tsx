'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { T } from '../../theme'

interface Avaliacao {
  id: number
  content_id: number
  autora: string
  nota: number
  texto: string
  data: string
  origem: string
  publicada: boolean
  site_content: { title: string; path: string } | null
}

interface Produto {
  id: number
  title: string
  path: string
  impressoes: number
  temAvaliacao: boolean
}

const campo: React.CSSProperties = {
  width: '100%', padding: '0.65rem 0.85rem', border: `1px solid ${T.champagne}`,
  borderRadius: 10, fontSize: '0.95rem', fontFamily: 'inherit', background: '#fff',
}
const rotulo: React.CSSProperties = {
  fontWeight: 700, fontSize: '0.8rem', color: T.ink, display: 'block', marginBottom: '0.3rem',
}

const Estrelas = ({ n }: { n: number }) => (
  <span style={{ color: '#e8a020', letterSpacing: '0.05em' }} aria-label={`${n} de 5`}>
    {'★'.repeat(n)}
    <span style={{ color: T.champagne }}>{'★'.repeat(5 - n)}</span>
  </span>
)

export default function AvaliacoesClient({
  avaliacoes, produtos,
}: { avaliacoes: Avaliacao[]; produtos: Produto[] }) {
  const router = useRouter()
  const [produtoId, setProdutoId] = useState<number | ''>('')
  const [autora, setAutora] = useState('')
  const [nota, setNota] = useState(5)
  const [texto, setTexto] = useState('')
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10))
  const [origem, setOrigem] = useState('whatsapp')
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [erro, setErro] = useState('')

  const semAvaliacao = useMemo(
    () => produtos.filter((p) => !p.temAvaliacao && p.impressoes > 0).slice(0, 8),
    [produtos],
  )

  async function lancar() {
    setErro(''); setAviso('')
    setSalvando(true)
    try {
      const r = await fetch('/api/site/avaliacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_id: produtoId, autora, nota, texto, data, origem }),
      })
      const d = await r.json()
      if (!r.ok) { setErro(d.error || 'Não consegui salvar.'); return }
      setAutora(''); setTexto(''); setNota(5)
      setAviso('Avaliação publicada. Ela aparece na página do produto e conta na nota.')
      router.refresh()
    } finally { setSalvando(false) }
  }

  async function alternar(a: Avaliacao) {
    await fetch('/api/site/avaliacoes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: a.id, publicada: !a.publicada }),
    })
    router.refresh()
  }

  async function excluir(a: Avaliacao) {
    if (!confirm(`Excluir a avaliação de ${a.autora}? Isso não tem volta.`)) return
    await fetch(`/api/site/avaliacoes?id=${a.id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <main className="dash-main" style={{ marginLeft: 234, flex: 1, overflowY: 'auto', padding: '2rem 2.5rem 4rem' }}>
      <h1 style={{ fontSize: '1.7rem', fontWeight: 800, color: T.ink }}>Avaliações</h1>
      <p style={{ color: T.inkSoft, marginTop: '0.35rem', maxWidth: '58rem' }}>
        O que as clientes te contam no WhatsApp entra aqui. Cada avaliação aparece na página do
        produto e entra no cálculo da nota que o Google exibe como estrela no resultado.
      </p>

      <div style={{ background: '#FFF4E5', border: '1px solid #F0C98A', borderRadius: 12, padding: '0.9rem 1.1rem', marginTop: '1.25rem', maxWidth: '58rem' }}>
        <p style={{ fontSize: '0.88rem', color: '#7a5312', lineHeight: 1.6 }}>
          <strong>Só avaliação de cliente de verdade.</strong> O Google trata avaliação inventada
          como manipulação e a punição é manual — some com a estrela do site inteiro, não só do
          produto. Como tudo aqui vem de conversa real, está tudo certo: é só não criar texto
          que ninguém escreveu.
        </p>
      </div>

      {/* --------------------------------------------------- onde falta mais */}
      {semAvaliacao.length > 0 && (
        <section style={{ marginTop: '1.75rem', background: T.surface, border: `1px solid ${T.champagne}`, borderRadius: 14, padding: '1.25rem' }}>
          <p style={{ fontWeight: 800, color: T.ink }}>Onde a estrela renderia mais</p>
          <p style={{ color: T.inkSoft, fontSize: '0.87rem', marginTop: '0.25rem' }}>
            Produtos que o Google mais mostra e que ainda não têm nenhuma avaliação.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.9rem' }}>
            {semAvaliacao.map((p) => (
              <button
                key={p.id}
                onClick={() => { setProdutoId(p.id); window.scrollTo({ top: 0 }) }}
                style={{
                  border: `1px solid ${T.champagne}`, background: T.cream, borderRadius: 999,
                  padding: '0.4rem 0.9rem', cursor: 'pointer', fontSize: '0.85rem', color: T.ink,
                }}
              >
                {p.title.slice(0, 38)}
                <span style={{ color: T.inkMuted, marginLeft: '0.4rem' }}>
                  {p.impressoes.toLocaleString('pt-BR')} impr.
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------- lançamento */}
      <section style={{ marginTop: '1.5rem', background: T.surface, border: `1px solid ${T.champagne}`, borderRadius: 14, padding: '1.4rem', maxWidth: '58rem' }}>
        <p style={{ fontWeight: 800, color: T.ink, marginBottom: '1rem' }}>Lançar avaliação</p>

        <label style={rotulo}>Produto</label>
        <select value={produtoId} onChange={(e) => setProdutoId(Number(e.target.value) || '')} style={campo}>
          <option value="">Escolha…</option>
          {produtos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.temAvaliacao ? '' : '◦ '}{p.title}
            </option>
          ))}
        </select>

        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))', marginTop: '1rem' }}>
          <div>
            <label style={rotulo}>Quem escreveu</label>
            <input value={autora} onChange={(e) => setAutora(e.target.value)} placeholder="Primeiro nome" style={campo} />
          </div>
          <div>
            <label style={rotulo}>Nota</label>
            <select value={nota} onChange={(e) => setNota(Number(e.target.value))} style={campo}>
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{'★'.repeat(n)} — {n}</option>)}
            </select>
          </div>
          <div>
            <label style={rotulo}>Data</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} style={campo} />
          </div>
          <div>
            <label style={rotulo}>Veio de</label>
            <select value={origem} onChange={(e) => setOrigem(e.target.value)} style={campo}>
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
              <option value="email">E-mail</option>
              <option value="outro">Outro</option>
            </select>
          </div>
        </div>

        <label style={{ ...rotulo, marginTop: '1rem' }}>O que ela disse</label>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={4}
          placeholder="Cole o que a cliente escreveu. Pode ajustar a pontuação, mas não invente o conteúdo."
          style={{ ...campo, resize: 'vertical' }}
        />
        <p style={{ color: texto.length && texto.length < 20 ? T.pinkDeep : T.inkMuted, fontSize: '0.8rem', marginTop: '0.35rem' }}>
          {texto.length} caracteres{texto.length > 0 && texto.length < 20 && ' — curto demais, escreva pelo menos uma frase'}
        </p>

        <button
          onClick={lancar}
          disabled={salvando || !produtoId || !autora.trim() || texto.trim().length < 20}
          style={{
            marginTop: '1.1rem', background: T.pink, color: '#fff', fontWeight: 700, border: 0,
            padding: '0.75rem 1.6rem', borderRadius: 10, cursor: 'pointer',
            opacity: salvando || !produtoId || !autora.trim() || texto.trim().length < 20 ? 0.5 : 1,
          }}
        >
          {salvando ? 'Publicando…' : 'Publicar avaliação'}
        </button>

        {aviso && <p style={{ marginTop: '0.8rem', color: '#1e7b40', fontWeight: 600, fontSize: '0.9rem' }}>{aviso}</p>}
        {erro && <p style={{ marginTop: '0.8rem', color: T.pinkDeep, fontWeight: 600, fontSize: '0.9rem' }}>{erro}</p>}
      </section>

      {/* ----------------------------------------------------------- lista */}
      <p style={{ fontWeight: 800, color: T.ink, marginTop: '2rem' }}>
        Publicadas ({avaliacoes.filter((a) => a.publicada).length} de {avaliacoes.length})
      </p>
      <div style={{ marginTop: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', maxWidth: '58rem' }}>
        {avaliacoes.map((a) => (
          <div
            key={a.id}
            style={{
              background: T.surface, border: `1px solid ${T.champagne}`, borderRadius: 12,
              padding: '0.95rem 1.1rem', opacity: a.publicada ? 1 : 0.55,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: '0.76rem', color: T.inkMuted }}>{a.site_content?.title ?? a.content_id}</p>
                <p style={{ fontWeight: 700, color: T.ink, marginTop: '0.1rem' }}>
                  {a.autora} <Estrelas n={a.nota} />
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: '0.76rem', color: T.inkMuted }}>
                  {a.data} · {a.origem}
                </span>
                <button onClick={() => alternar(a)}
                  style={{ border: `1px solid ${T.champagne}`, background: T.surface, borderRadius: 8, padding: '0.3rem 0.7rem', cursor: 'pointer', fontSize: '0.8rem', color: T.inkSoft }}>
                  {a.publicada ? 'tirar do ar' : 'publicar'}
                </button>
                <button onClick={() => excluir(a)}
                  style={{ border: 0, background: 'none', cursor: 'pointer', fontSize: '0.8rem', color: T.inkMuted }}>
                  excluir
                </button>
              </div>
            </div>
            <p style={{ color: T.inkSoft, fontSize: '0.9rem', marginTop: '0.4rem', lineHeight: 1.55 }}>{a.texto}</p>
          </div>
        ))}
      </div>
      {!avaliacoes.length && <p style={{ color: T.inkSoft, marginTop: '1rem' }}>Nenhuma avaliação ainda.</p>}
    </main>
  )
}
