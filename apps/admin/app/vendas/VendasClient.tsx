'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

export interface Venda {
  email: string
  nome: string
  telefone: string
  status: 'paga' | 'cancelada' | 'pix_aguardando' | 'pix_expirado' | 'cartao_recusado' | 'cartao_nao_concluido'
  metodo: 'pix' | 'cartao'
  origem: 'proprio' | 'hotmart'
  parcelas: number | null
  valorCents: number | null
  data: string
  primeiraTentativa: string
  tentativas: number
  pedido: string | null
  utm: string | null
}

const ink = '#2A1E2C'
const gray = '#7C6B7E'
const accent = '#BE185D'

const STATUS: Record<Venda['status'], { label: string; cor: string }> = {
  paga:                 { label: 'Paga',              cor: '#16A34A' },
  cancelada:            { label: 'Cancelada',         cor: '#DC2626' },
  pix_aguardando:       { label: 'PIX aguardando',    cor: '#2563EB' },
  pix_expirado:         { label: 'PIX expirado',      cor: '#D97706' },
  cartao_recusado:      { label: 'Cartão recusado',   cor: '#DC2626' },
  cartao_nao_concluido: { label: 'Cartão incompleto', cor: '#D97706' },
}

const FILTROS = [
  { id: 'todas', label: 'Todas' },
  { id: 'pagas', label: 'Pagas' },
  { id: 'nao_pagas', label: 'Não pagas' },
  { id: 'pix_aguardando', label: 'PIX aguardando' },
  { id: 'canceladas', label: 'Canceladas' },
] as const
type Filtro = (typeof FILTROS)[number]['id']

const PERIODOS = [
  { id: '7', label: '7 dias' },
  { id: '30', label: '30 dias' },
  { id: '90', label: '90 dias' },
  { id: 'todos', label: 'Tudo' },
]

const POR_PAGINA = 50
const brl = (c: number) => `R$ ${(c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
const naoPaga = (v: Venda) => v.status !== 'paga' && v.status !== 'cancelada'

function whatsapp(tel: string): string | null {
  if (tel.length < 10) return null
  return `https://wa.me/${tel.startsWith('55') && tel.length >= 12 ? tel : '55' + tel}`
}

function Kpi({ label, valor, sub, cor }: { label: string; valor: string; sub?: string; cor?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: 12, color: gray, fontWeight: 500, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: cor ?? ink, lineHeight: 1 }}>{valor}</div>
      {sub && <div style={{ fontSize: 12, color: gray, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '7px 13px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
      border: `1px solid ${ativo ? accent : '#E6DEE8'}`, background: ativo ? accent : '#fff', color: ativo ? '#fff' : gray,
    }}>{children}</button>
  )
}

export default function VendasClient({ vendas, periodo }: { vendas: Venda[]; periodo: string }) {
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(0)

  const pagas = vendas.filter(v => v.status === 'paga')
  const naoPagas = vendas.filter(naoPaga)
  const receita = pagas.reduce((s, v) => s + (v.valorCents ?? 0), 0)
  const taxa = vendas.length ? Math.round((pagas.length / vendas.length) * 100) : 0
  const pixGerados = vendas.filter(v => v.metodo === 'pix' && v.origem === 'proprio')
  const pixPagos = pixGerados.filter(v => v.status === 'paga' || v.status === 'cancelada')
  const taxaPix = pixGerados.length ? Math.round((pixPagos.length / pixGerados.length) * 100) : 0

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return vendas.filter(v => {
      if (filtro === 'pagas' && v.status !== 'paga') return false
      if (filtro === 'nao_pagas' && !naoPaga(v)) return false
      if (filtro === 'pix_aguardando' && v.status !== 'pix_aguardando') return false
      if (filtro === 'canceladas' && v.status !== 'cancelada') return false
      if (q && !(v.nome.toLowerCase().includes(q) || v.email.includes(q) || v.telefone.includes(q.replace(/\D/g, '') || '§'))) return false
      return true
    })
  }, [vendas, filtro, busca])

  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA))
  const pag = Math.min(pagina, paginas - 1)
  const linhas = lista.slice(pag * POR_PAGINA, pag * POR_PAGINA + POR_PAGINA)

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: ink }}>Vendas</div>
          <div style={{ fontSize: 13, color: gray, marginTop: 4 }}>
            Toda tentativa de pagamento (PIX gerado ou cartão enviado), paga ou não. Uma linha por cliente · cortesias não entram.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {PERIODOS.map(p => (
            <Link key={p.id} href={`/vendas?dias=${p.id}`} style={{
              padding: '7px 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, textDecoration: 'none',
              border: `1px solid ${periodo === p.id ? ink : '#E6DEE8'}`, background: periodo === p.id ? ink : '#fff', color: periodo === p.id ? '#fff' : gray,
            }}>{p.label}</Link>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <Kpi label="Vendas pagas" valor={String(pagas.length)} sub={`de ${vendas.length} clientes que tentaram pagar`} cor="#16A34A" />
        <Kpi label="Receita" valor={brl(receita)} sub={pagas.length ? `ticket médio ${brl(Math.round(receita / pagas.length))}` : 'sem vendas no período'} cor={accent} />
        <Kpi label="Não pagas" valor={String(naoPagas.length)} sub="PIX expirado/aguardando ou cartão recusado" cor={naoPagas.length ? '#D97706' : ink} />
        <Kpi label="Conversão" valor={`${taxa}%`} sub={`PIX do checkout próprio: ${taxaPix}% pagos`} />
      </div>

      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #F0F0F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {FILTROS.map(f => (
              <Chip key={f.id} ativo={filtro === f.id} onClick={() => { setFiltro(f.id); setPagina(0) }}>{f.label}</Chip>
            ))}
          </div>
          <input
            value={busca}
            onChange={e => { setBusca(e.target.value); setPagina(0) }}
            placeholder="Buscar nome, e-mail ou telefone"
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #E6DEE8', fontSize: 13, minWidth: 240, fontFamily: 'inherit', outline: 'none' }}
          />
        </div>

        {lista.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: gray, fontSize: 14 }}>Nenhuma venda nesse filtro</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F0F0F5', background: '#FFF7EE' }}>
                {['Data', 'Cliente', 'Status', 'Pagamento', 'Valor', 'Tentativas', 'Origem', ''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map(v => {
                const st = STATUS[v.status]
                const wa = naoPaga(v) ? whatsapp(v.telefone) : null
                return (
                  <tr key={v.email} style={{ borderBottom: '1px solid #F9F9FC' }}>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: gray, whiteSpace: 'nowrap' }}>{dataHora(v.data)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: ink }}>{v.nome}</div>
                      <div style={{ fontSize: 11, color: gray }}>{v.email}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: st.cor + '18', color: st.cor, whiteSpace: 'nowrap' }}>{st.label}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: ink, whiteSpace: 'nowrap' }}>
                      {v.metodo === 'pix' ? 'PIX' : `Cartão${v.parcelas && v.parcelas > 1 ? ` ${v.parcelas}x` : ''}`}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', color: v.status === 'paga' ? '#16A34A' : gray }}>
                      {v.valorCents ? brl(v.valorCents) : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: gray }}>{v.tentativas}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: gray }}>
                      {v.origem === 'hotmart' ? 'Hotmart' : 'Checkout próprio'}
                      {v.utm && <div style={{ fontSize: 11, color: '#B5A6B7' }}>{v.utm}</div>}
                    </td>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      {wa && (
                        <a href={wa} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 600, color: '#16A34A', textDecoration: 'none' }}>
                          WhatsApp →
                        </a>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {paginas > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderTop: '1px solid #F0F0F5' }}>
            <button onClick={() => setPagina(p => Math.max(0, p - 1))} disabled={pag === 0}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E6DEE8', background: '#fff', color: pag === 0 ? '#C4B8C6' : accent, fontSize: 13, fontWeight: 600, cursor: pag === 0 ? 'default' : 'pointer', fontFamily: 'inherit' }}>
              ← Anterior
            </button>
            <div style={{ fontSize: 13, color: gray }}>Página {pag + 1} de {paginas} · {lista.length} clientes</div>
            <button onClick={() => setPagina(p => Math.min(paginas - 1, p + 1))} disabled={pag >= paginas - 1}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E6DEE8', background: '#fff', color: pag >= paginas - 1 ? '#C4B8C6' : accent, fontSize: 13, fontWeight: 600, cursor: pag >= paginas - 1 ? 'default' : 'pointer', fontFamily: 'inherit' }}>
              Próxima →
            </button>
          </div>
        )}
      </div>
    </>
  )
}
