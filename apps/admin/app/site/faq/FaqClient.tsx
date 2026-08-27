'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { T } from '../../theme'

interface Item {
  id: number
  content_id: number
  pergunta: string
  resposta: string
  revisao_status: string
  revisao_motivo: string | null
  site_content: { title: string; path: string } | null
}

export default function FaqClient({ itens }: { itens: Item[] }) {
  const router = useRouter()
  const [filtro, setFiltro] = useState<'reprovada' | 'aprovada' | 'pendente'>('reprovada')
  const [selecao, setSelecao] = useState<Set<number>>(new Set())
  const [salvando, setSalvando] = useState(false)

  const lista = useMemo(() => itens.filter((i) => i.revisao_status === filtro), [itens, filtro])
  const contagem = useMemo(() => ({
    reprovada: itens.filter((i) => i.revisao_status === 'reprovada').length,
    aprovada: itens.filter((i) => i.revisao_status === 'aprovada').length,
    pendente: itens.filter((i) => i.revisao_status === 'pendente').length,
  }), [itens])

  function alternar(id: number) {
    setSelecao((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  async function aplicar(acao: 'aprovar' | 'reprovar') {
    if (!selecao.size) return
    setSalvando(true)
    try {
      await fetch('/api/site/faq', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selecao], acao }),
      })
      setSelecao(new Set())
      router.refresh()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <main style={{ flex: 1, overflowY: 'auto', padding: '2rem 2.5rem 4rem' }}>
      <h1 style={{ fontSize: '1.7rem', fontWeight: 800, color: T.ink }}>FAQ do site</h1>
      <p style={{ color: T.inkSoft, marginTop: '0.35rem', maxWidth: '54rem' }}>
        As perguntas foram escritas a partir do texto de cada artigo e passaram por duas revisões
        automáticas: uma por regra e outra conferindo cada resposta contra o próprio artigo. Aqui
        você discorda do resultado quando quiser.
      </p>

      <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
        {(['reprovada', 'aprovada', 'pendente'] as const).map((f) => (
          <button
            key={f}
            onClick={() => { setFiltro(f); setSelecao(new Set()) }}
            style={{
              padding: '0.55rem 1.1rem', borderRadius: 999, cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
              border: `1px solid ${filtro === f ? T.pink : T.champagne}`,
              background: filtro === f ? T.pinkSoft : T.surface,
              color: filtro === f ? T.pinkDeep : T.inkSoft,
            }}
          >
            {{ reprovada: 'Fora do ar', aprovada: 'No ar', pendente: 'Pendente' }[f]} ({contagem[f]})
          </button>
        ))}
      </div>

      {selecao.size > 0 && (
        <div style={{ position: 'sticky', top: 0, zIndex: 5, background: T.pinkSoft, border: `1px solid ${T.pink}`, borderRadius: 12, padding: '0.8rem 1.1rem', marginTop: '1rem', display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: T.pinkDeep }}>{selecao.size} selecionadas</span>
          <button onClick={() => aplicar('aprovar')} disabled={salvando}
            style={{ background: '#3d8f5e', color: '#fff', border: 0, fontWeight: 700, padding: '0.5rem 1.1rem', borderRadius: 8, cursor: 'pointer' }}>
            Colocar no ar
          </button>
          <button onClick={() => aplicar('reprovar')} disabled={salvando}
            style={{ background: T.surface, color: T.inkSoft, border: `1px solid ${T.champagne}`, fontWeight: 700, padding: '0.5rem 1.1rem', borderRadius: 8, cursor: 'pointer' }}>
            Tirar do ar
          </button>
          <button onClick={() => setSelecao(new Set())} style={{ background: 'none', border: 0, color: T.inkSoft, cursor: 'pointer', fontSize: '0.85rem' }}>
            limpar
          </button>
        </div>
      )}

      <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {lista.map((q) => (
          <label key={q.id} style={{
            display: 'flex', gap: '0.9rem', alignItems: 'flex-start', cursor: 'pointer',
            background: T.surface, border: `1px solid ${selecao.has(q.id) ? T.pink : T.champagne}`,
            borderRadius: 12, padding: '0.95rem 1.1rem',
          }}>
            <input type="checkbox" checked={selecao.has(q.id)} onChange={() => alternar(q.id)} style={{ marginTop: '0.25rem' }} />
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: '0.76rem', color: T.inkMuted }}>{q.site_content?.title ?? q.content_id}</p>
              <p style={{ fontWeight: 700, color: T.ink, marginTop: '0.15rem' }}>{q.pergunta}</p>
              <p style={{ color: T.inkSoft, fontSize: '0.89rem', marginTop: '0.35rem', lineHeight: 1.55 }}>{q.resposta}</p>
              {q.revisao_motivo && (
                <p style={{ color: T.pinkDeep, fontSize: '0.8rem', marginTop: '0.45rem' }}>
                  Por que saiu: {q.revisao_motivo}
                </p>
              )}
            </div>
          </label>
        ))}
      </div>

      {!lista.length && <p style={{ padding: '3rem 0', textAlign: 'center', color: T.inkSoft }}>Nada aqui.</p>}
    </main>
  )
}
