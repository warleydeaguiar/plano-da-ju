'use client'

import { useState } from 'react'
import Link from 'next/link'

const accent = '#BE185D'
const gray = '#7C6B7E'

const SUB_STATUS: Record<string, { label: string; color: string }> = {
  active: { label: 'Ativa', color: '#22A06B' },
  cancelled: { label: 'Cancelada', color: '#DC2626' },
  expired: { label: 'Expirada', color: '#D97706' },
  pending: { label: 'Pendente', color: gray },
}

const SUB_TYPE: Record<string, string> = {
  annual_card: '90 dias — Cartão',
  annual_pix: '90 dias — PIX',
  quarterly_card: '90 dias — Cartão',
  quarterly_pix: '90 dias — PIX',
  none: '—',
}

const PAGE_SIZE = 50

const brl = (cents: number) => `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function SubsTable({ list }: { list: any[] }) {
  const [page, setPage] = useState(0)
  const [paidOnly, setPaidOnly] = useState(false)

  // "Só vendas pagas" = exclui parcerias (brindes/permutas).
  const view = paidOnly ? list.filter(s => !s.is_parceria) : list

  const total = view.length
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(page, pages - 1)
  const start = safePage * PAGE_SIZE
  const rows = view.slice(start, start + PAGE_SIZE)

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)' }}>
      <div style={{ padding: '18px 24px', borderBottom: '1px solid #F0F0F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#2A1E2C' }}>{paidOnly ? 'Vendas pagas' : 'Todas as assinaturas'}</div>
          <div style={{ fontSize: 12, color: gray, marginTop: 2 }}>
            {total === 0 ? 'Nenhuma' : `${total} no total`}
            {total > PAGE_SIZE && ` · mostrando ${start + 1}–${start + rows.length}`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={() => { setPaidOnly(v => !v); setPage(0) }}
            style={{
              padding: '7px 13px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
              border: `1px solid ${paidOnly ? accent : '#E6DEE8'}`,
              background: paidOnly ? accent : '#fff', color: paidOnly ? '#fff' : gray,
            }}
          >
            {paidOnly ? '✓ Só vendas pagas' : 'Só vendas pagas'}
          </button>
          <Link href="/usuarios" style={{ fontSize: 13, color: accent, fontWeight: 600, textDecoration: 'none' }}>
            Ver usuárias →
          </Link>
        </div>
      </div>

      {total === 0 ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: gray, fontSize: 14 }}>
          Nenhuma assinatura encontrada
        </div>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F0F0F5', background: '#FFF7EE' }}>
                {['Usuária', 'Plano', 'Valor pago', 'Status', 'PagarMe ID', 'Expira em', 'Cadastro'].map(h => (
                  <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, color: gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((s: any) => {
                const st = SUB_STATUS[s.subscription_status] ?? { label: s.subscription_status, color: gray }
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid #F9F9FC' }}>
                    <td style={{ padding: '12px 20px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#2A1E2C' }}>
                        {s.full_name ?? s.email.split('@')[0]}
                      </div>
                      <div style={{ fontSize: 11, color: gray }}>{s.email}</div>
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: 13, color: '#2A1E2C' }}>
                      {SUB_TYPE[s.subscription_type] ?? s.subscription_type}
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {s.paid_cents != null
                        ? <span style={{ color: '#16A34A' }}>{brl(s.paid_cents)}</span>
                        : s.is_parceria
                          ? <span style={{ color: '#B8860B', fontWeight: 500 }}>Parceria</span>
                          : <span style={{ color: '#B0A0B2' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                        background: st.color + '18', color: st.color,
                      }}>{st.label}</span>
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: 12, color: gray, fontFamily: 'monospace' }}>
                      {s.pagarme_subscription_id ?? '—'}
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: 12, color: s.subscription_expires_at ? '#2A1E2C' : gray }}>
                      {s.subscription_expires_at
                        ? new Date(s.subscription_expires_at).toLocaleDateString('pt-BR')
                        : '—'}
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: 12, color: gray }}>
                      {new Date(s.created_at).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {pages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderTop: '1px solid #F0F0F5' }}>
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={safePage === 0}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: '1px solid #E6DEE8',
                  background: safePage === 0 ? '#F7F4F8' : '#fff', color: safePage === 0 ? '#C4B8C6' : accent,
                  fontSize: 13, fontWeight: 600, cursor: safePage === 0 ? 'default' : 'pointer', fontFamily: 'inherit',
                }}
              >
                ← Anterior
              </button>
              <div style={{ fontSize: 13, color: gray, fontWeight: 500 }}>
                Página {safePage + 1} de {pages}
              </div>
              <button
                onClick={() => setPage(p => Math.min(pages - 1, p + 1))}
                disabled={safePage >= pages - 1}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: '1px solid #E6DEE8',
                  background: safePage >= pages - 1 ? '#F7F4F8' : '#fff', color: safePage >= pages - 1 ? '#C4B8C6' : accent,
                  fontSize: 13, fontWeight: 600, cursor: safePage >= pages - 1 ? 'default' : 'pointer', fontFamily: 'inherit',
                }}
              >
                Próxima →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
