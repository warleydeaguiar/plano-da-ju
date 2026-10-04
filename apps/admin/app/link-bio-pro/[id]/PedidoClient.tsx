'use client'

import { useState } from 'react'
import Link from 'next/link'
import { T } from '../../theme'

interface Imagem {
  slot?: string
  url: string
  uploaded_at?: string
}

interface Pedido {
  id: string
  session_id: string
  nome: string | null
  email: string | null
  telefone: string | null
  profissao: string | null
  respostas: Record<string, unknown> | null
  imagens: Imagem[] | null
  valor_centavos: number
  metodo_pagamento: string | null
  status_pagamento: string
  pago_em: string | null
  status_entrega: 'pendente' | 'em_producao' | 'entregue'
  entregue_em: string | null
  notas_internas: string | null
  criado_em: string
}

const fmtData = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR') : '—')

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  em_producao: 'Em produção',
  entregue: 'Entregue',
}

function formatarValor(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

const rotuloStyle: React.CSSProperties = {
  fontSize: '0.78rem', color: T.inkMuted, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.04em',
}
const valorStyle: React.CSSProperties = {
  fontSize: '0.95rem', color: T.ink, marginTop: '0.2rem', fontWeight: 600,
}

export default function PedidoClient({ pedido }: { pedido: Pedido }) {
  const [status, setStatus] = useState(pedido.status_entrega)
  const [entregueEm, setEntregueEm] = useState(pedido.entregue_em)
  const [notas, setNotas] = useState(pedido.notas_internas ?? '')
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState('')

  async function atualizar(campos: { status_entrega?: string; notas_internas?: string }) {
    setSalvando(true)
    setAviso('')
    try {
      const r = await fetch(`/api/link-bio-pro/${pedido.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campos),
      })
      const d = await r.json()
      if (!r.ok) { setAviso(d.error || 'Não consegui salvar.'); return false }
      setAviso('Salvo.')
      return true
    } catch {
      setAviso('Não consegui salvar.')
      return false
    } finally {
      setSalvando(false)
    }
  }

  async function mudarStatus(novo: 'pendente' | 'em_producao' | 'entregue') {
    if (novo === status) return
    const anterior = status
    setStatus(novo)
    const ok = await atualizar({ status_entrega: novo })
    if (ok) {
      setEntregueEm(novo === 'entregue' ? new Date().toISOString() : entregueEm)
    } else {
      setStatus(anterior)
    }
  }

  async function salvarNotas() {
    await atualizar({ notas_internas: notas })
  }

  const respostasEntries = Object.entries(pedido.respostas ?? {})
  const imagens = pedido.imagens ?? []

  return (
    <main className="dash-main" style={{ marginLeft: 234, flex: 1, overflowY: 'auto', padding: '2rem 2.5rem 4rem' }}>
      <Link href="/link-bio-pro" style={{ color: T.inkSoft, fontSize: '0.88rem' }}>← voltar</Link>

      <header style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: T.ink }}>{pedido.nome || 'Sem nome'}</h1>
          <p style={{ color: T.inkMuted, fontSize: '0.85rem', marginTop: '0.3rem' }}>
            Pedido em {fmtData(pedido.criado_em)} · pago em {fmtData(pedido.pago_em)}
            {pedido.metodo_pagamento ? ` · ${pedido.metodo_pagamento}` : ''}
            {' · R$ '}{(pedido.valor_centavos / 100).toFixed(2).replace('.', ',')}
          </p>
        </div>
      </header>

      {/* contato */}
      <section style={{ background: T.surface, border: `1px solid ${T.champagne}`, borderRadius: 14, padding: '1.25rem', marginTop: '1.5rem' }}>
        <p style={{ fontWeight: 700, color: T.ink, marginBottom: '0.75rem' }}>Contato</p>
        <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))' }}>
          <div><p style={rotuloStyle}>Nome</p><p style={valorStyle}>{pedido.nome || '—'}</p></div>
          <div><p style={rotuloStyle}>E-mail</p><p style={valorStyle}>{pedido.email || '—'}</p></div>
          <div><p style={rotuloStyle}>Telefone</p><p style={valorStyle}>{pedido.telefone || '—'}</p></div>
          <div><p style={rotuloStyle}>Profissão</p><p style={valorStyle}>{pedido.profissao || '—'}</p></div>
        </div>
      </section>

      {/* respostas do quiz */}
      <section style={{ background: T.surface, border: `1px solid ${T.champagne}`, borderRadius: 14, padding: '1.25rem', marginTop: '1.25rem' }}>
        <p style={{ fontWeight: 700, color: T.ink, marginBottom: '0.75rem' }}>Respostas do quiz</p>
        {respostasEntries.length === 0 ? (
          <p style={{ color: T.inkMuted, fontSize: '0.9rem' }}>Sem respostas registradas.</p>
        ) : (
          <div style={{ display: 'grid', gap: '0.6rem' }}>
            {respostasEntries.map(([chave, valor]) => (
              <div key={chave} style={{
                display: 'flex', gap: '0.75rem', fontSize: '0.9rem',
                borderBottom: `1px solid ${T.borderSoft}`, paddingBottom: '0.5rem',
              }}>
                <span style={{ fontWeight: 700, color: T.inkSoft, minWidth: '11rem' }}>{chave}</span>
                <span style={{ color: T.ink }}>{formatarValor(valor)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* galeria */}
      <section style={{ background: T.surface, border: `1px solid ${T.champagne}`, borderRadius: 14, padding: '1.25rem', marginTop: '1.25rem' }}>
        <p style={{ fontWeight: 700, color: T.ink, marginBottom: '0.75rem' }}>Imagens enviadas</p>
        {imagens.length === 0 ? (
          <p style={{ color: T.inkMuted, fontSize: '0.9rem' }}>Nenhuma imagem enviada.</p>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fill, minmax(9rem, 1fr))' }}>
            {imagens.map((img, i) => (
              <a
                key={`${img.url}-${i}`}
                href={img.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'block', borderRadius: 10, overflow: 'hidden', border: `1px solid ${T.champagne}` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.slot || `Imagem ${i + 1}`}
                  style={{ width: '100%', height: '9rem', objectFit: 'cover', display: 'block' }}
                />
              </a>
            ))}
          </div>
        )}
      </section>

      {/* status de entrega */}
      <section style={{ background: T.surface, border: `1px solid ${T.champagne}`, borderRadius: 14, padding: '1.25rem', marginTop: '1.25rem' }}>
        <p style={{ fontWeight: 700, color: T.ink, marginBottom: '0.75rem' }}>Status da entrega</p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {(['pendente', 'em_producao', 'entregue'] as const).map((s) => (
            <button
              key={s}
              onClick={() => mudarStatus(s)}
              disabled={salvando}
              style={{
                padding: '0.55rem 1.1rem', borderRadius: 999, fontSize: '0.85rem', fontWeight: 700,
                border: `1px solid ${T.champagne}`, cursor: salvando ? 'default' : 'pointer',
                background: status === s ? T.pink : T.surface,
                color: status === s ? '#fff' : T.inkSoft,
                opacity: salvando ? 0.7 : 1,
              }}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        {status === 'entregue' && entregueEm && (
          <p style={{ color: T.inkMuted, fontSize: '0.82rem', marginTop: '0.6rem' }}>
            Entregue em {fmtData(entregueEm)}
          </p>
        )}
      </section>

      {/* notas internas */}
      <section style={{ background: T.surface, border: `1px solid ${T.champagne}`, borderRadius: 14, padding: '1.25rem', marginTop: '1.25rem' }}>
        <p style={{ fontWeight: 700, color: T.ink, marginBottom: '0.75rem' }}>Notas internas</p>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={4}
          placeholder="Observações sobre esse pedido…"
          style={{
            width: '100%', padding: '0.7rem 0.9rem', border: `1px solid ${T.champagne}`,
            borderRadius: 10, fontSize: '0.9rem', fontFamily: 'inherit', resize: 'vertical',
          }}
        />
        <button
          onClick={salvarNotas}
          disabled={salvando}
          style={{
            marginTop: '0.75rem', background: T.pink, color: '#fff', fontWeight: 700, border: 0,
            padding: '0.6rem 1.3rem', borderRadius: 10, cursor: salvando ? 'default' : 'pointer',
            opacity: salvando ? 0.6 : 1,
          }}
        >
          {salvando ? 'Salvando…' : 'Salvar notas'}
        </button>
        {aviso && <p style={{ color: T.inkSoft, fontSize: '0.85rem', marginTop: '0.6rem' }}>{aviso}</p>}
      </section>
    </main>
  )
}
