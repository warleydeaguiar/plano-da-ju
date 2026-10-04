'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { T } from '../theme'

interface Pedido {
  id: string
  nome: string | null
  email: string | null
  telefone: string | null
  profissao: string | null
  status_entrega: 'pendente' | 'em_producao' | 'entregue'
  criado_em: string
  entregue_em: string | null
}

const fmtData = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  em_producao: 'Em produção',
  entregue: 'Entregue',
}

const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  pendente: { bg: T.alertSoft, fg: T.alert },
  em_producao: { bg: T.blueSoft, fg: T.blue },
  entregue: { bg: T.greenSoft, fg: T.green },
}

function Badge({ status }: { status: string }) {
  const c = STATUS_COLOR[status] ?? STATUS_COLOR.pendente
  return (
    <span style={{
      background: c.bg, color: c.fg, fontWeight: 700, fontSize: '0.78rem',
      padding: '0.25rem 0.65rem', borderRadius: 999, whiteSpace: 'nowrap',
    }}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

export default function LinkBioProClient({ pedidos }: { pedidos: Pedido[] }) {
  const [filtro, setFiltro] = useState<'todos' | 'pendente' | 'em_producao' | 'entregue'>('todos')

  const contagem = useMemo(() => ({
    pendente: pedidos.filter((p) => p.status_entrega === 'pendente').length,
    em_producao: pedidos.filter((p) => p.status_entrega === 'em_producao').length,
    entregue: pedidos.filter((p) => p.status_entrega === 'entregue').length,
  }), [pedidos])

  const filtrados = useMemo(
    () => (filtro === 'todos' ? pedidos : pedidos.filter((p) => p.status_entrega === filtro)),
    [pedidos, filtro],
  )

  return (
    <main className="dash-main" style={{ marginLeft: 234, flex: 1, overflowY: 'auto', padding: '2rem 2.5rem 4rem' }}>
      <header>
        <h1 style={{ fontSize: '1.7rem', fontWeight: 800, color: T.ink }}>Link na Bio PRO</h1>
        <p style={{ color: T.inkSoft, marginTop: '0.35rem' }}>
          Pedidos pagos do serviço de bio personalizada. Monte a bio por fora e marque o andamento aqui.
        </p>
      </header>

      <p style={{ marginTop: '1.25rem', color: T.inkSoft, fontSize: '0.92rem', fontWeight: 600 }}>
        {contagem.pendente} pendentes · {contagem.em_producao} em produção · {contagem.entregue} entregues
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
        {(['todos', 'pendente', 'em_producao', 'entregue'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            style={{
              padding: '0.45rem 0.9rem', borderRadius: 999, fontSize: '0.85rem', fontWeight: 600,
              border: `1px solid ${T.champagne}`, cursor: 'pointer',
              background: filtro === f ? T.pink : T.surface,
              color: filtro === f ? '#fff' : T.inkSoft,
            }}
          >
            {f === 'todos' ? 'Todos' : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      <section style={{ background: T.surface, border: `1px solid ${T.champagne}`, borderRadius: 14, marginTop: '1.5rem', overflow: 'hidden' }}>
        {filtrados.length === 0 ? (
          <p style={{ padding: '2rem', textAlign: 'center', color: T.inkMuted }}>Nenhum pedido aqui.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: `1px solid ${T.champagne}` }}>
                {['Nome', 'E-mail', 'Profissão', 'Data', 'Status', ''].map((h) => (
                  <th key={h} style={{
                    padding: '0.8rem 1rem', fontSize: '0.78rem', color: T.inkMuted,
                    fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => (
                <tr key={p.id} style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                  <td style={{ padding: '0.8rem 1rem', fontWeight: 600, color: T.ink }}>{p.nome || '—'}</td>
                  <td style={{ padding: '0.8rem 1rem', color: T.inkSoft }}>{p.email || '—'}</td>
                  <td style={{ padding: '0.8rem 1rem', color: T.inkSoft }}>{p.profissao || '—'}</td>
                  <td style={{ padding: '0.8rem 1rem', color: T.inkSoft }}>{fmtData(p.criado_em)}</td>
                  <td style={{ padding: '0.8rem 1rem' }}><Badge status={p.status_entrega} /></td>
                  <td style={{ padding: '0.8rem 1rem', textAlign: 'right' }}>
                    <Link href={`/link-bio-pro/${p.id}`} style={{ color: T.pink, fontWeight: 600, fontSize: '0.85rem' }}>
                      Abrir →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  )
}
