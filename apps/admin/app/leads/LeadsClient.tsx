'use client'

import { useState, useMemo } from 'react'

const accent = '#C4607A'
const green  = '#34C759'
const orange = '#FF9500'
const gray   = '#8A8A8E'
const dark   = '#1C1C1E'

type Lead = {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  quiz_slug: string
  utm_source: string | null
  utm_campaign: string | null
  created_at: string
  isCliente: boolean
}

type Abandoned = {
  id: string
  full_name: string | null
  email: string
  subscription_status: string
  quiz_answers: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

function formatPhone(phone: string | null) {
  if (!phone) return '—'
  const d = phone.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return phone
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function slugLabel(slug: string) {
  if (slug === 'plano-capilar') return 'Plano Capilar'
  if (slug === 'fashion-gold') return 'Fashion Gold'
  return slug
}

function whatsappLink(phone: string | null, name: string | null) {
  if (!phone) return null
  const d = phone.replace(/\D/g, '')
  const num = d.startsWith('55') ? d : `55${d}`
  const msg = encodeURIComponent(`Olá ${name ?? ''}! Vi que você preencheu nosso quiz do Plano da Ju. Posso te ajudar? 💇‍♀️`)
  return `https://wa.me/${num}?text=${msg}`
}

type FunnelWindow = { views: number; starts: number; leads: number; sales: number }
type Funnel = { today: FunnelWindow; last7: FunnelWindow; last30: FunnelWindow }

export default function LeadsClient({
  leads,
  checkoutAbandoned,
  funnel,
}: {
  leads: Lead[]
  checkoutAbandoned: Abandoned[]
  funnel: Funnel
}) {
  const [tab, setTab] = useState<'quiz' | 'checkout'>('quiz')
  const [search, setSearch] = useState('')
  const [slugFilter, setSlugFilter] = useState('all')

  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const q = search.toLowerCase()
      const matchSearch = !q ||
        l.name?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.phone?.includes(q)
      const matchSlug = slugFilter === 'all' || l.quiz_slug === slugFilter
      return matchSearch && matchSlug
    })
  }, [leads, search, slugFilter])

  const filteredAbandoned = useMemo(() => {
    const q = search.toLowerCase()
    return checkoutAbandoned.filter(a =>
      !q ||
      a.full_name?.toLowerCase().includes(q) ||
      a.email?.toLowerCase().includes(q)
    )
  }, [checkoutAbandoned, search])

  function pct(a: number, b: number) {
    if (!b) return '—'
    return `${Math.round((a / b) * 100)}%`
  }

  function FunnelTable({ title, w }: { title: string; w: FunnelWindow }) {
    const rows: { icon: string; label: string; value: number; from: number | null }[] = [
      { icon: '👁️', label: 'Entrou no quiz',           value: w.views,  from: null },
      { icon: '✍️', label: 'Começou a responder',      value: w.starts, from: w.views },
      { icon: '📋', label: 'Completou (lead)',          value: w.leads,  from: w.starts },
      { icon: '💳', label: 'Comprou',                    value: w.sales,  from: w.leads },
    ]
    return (
      <div style={{
        background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)',
        padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 0,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: gray, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
          {title}
        </div>
        {rows.map((r, i) => {
          const conv = r.from === null ? null : pct(r.value, r.from)
          const isLast = i === rows.length - 1
          return (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '9px 0', borderBottom: isLast ? 'none' : '1px solid #F5F5F7',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: dark, fontWeight: 500 }}>
                <span style={{ fontSize: 14 }}>{r.icon}</span>
                {r.label}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                {conv !== null && (
                  <span style={{ fontSize: 11, color: conv === '—' ? gray : green, fontWeight: 600 }}>
                    {conv === '—' ? '' : `(${conv})`}
                  </span>
                )}
                <span style={{ fontSize: 16, fontWeight: 800, color: isLast ? green : dark }}>
                  {r.value}
                </span>
              </div>
            </div>
          )
        })}
        {/* Overall conv view→sales */}
        <div style={{
          marginTop: 8, paddingTop: 10, borderTop: '1px dashed #E5E5EA',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: 11, color: gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4,
        }}>
          <span>Quiz → compra</span>
          <span style={{ color: w.sales > 0 ? green : gray, fontSize: 13 }}>
            {pct(w.sales, w.views)}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1280 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: dark, margin: '0 0 4px' }}>Leads</h1>
        <p style={{ fontSize: 13, color: gray, margin: 0 }}>
          Funil completo do quiz — todas pessoas que entraram, começaram, viraram leads e compraram.
        </p>
      </div>

      {/* Funil em 3 janelas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        <FunnelTable title="Hoje"        w={funnel.today} />
        <FunnelTable title="Últimos 7 dias"  w={funnel.last7} />
        <FunnelTable title="Últimos 30 dias" w={funnel.last30} />
      </div>

      <div style={{
        marginBottom: 24, padding: '12px 16px',
        background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12,
        fontSize: 12.5, color: '#7C2D12', lineHeight: 1.6,
      }}>
        <strong>📊 Como ler isso:</strong> &ldquo;Entrou no quiz&rdquo; é quem abriu a página. &ldquo;Começou a responder&rdquo; é quem clicou em pelo menos uma resposta. &ldquo;Completou&rdquo; é quem deixou nome + e-mail no final (são esses que aparecem na lista abaixo). &ldquo;Comprou&rdquo; é quem virou cliente. A queda mais importante é normalmente entre &ldquo;Começou&rdquo; e &ldquo;Completou&rdquo;.
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: '#fff', padding: 4, borderRadius: 10, border: '1px solid rgba(0,0,0,0.06)', marginBottom: 20, width: 'fit-content' }}>
        {([
          { key: 'quiz', label: `Quiz (${leads.length})` },
          { key: 'checkout', label: `Checkout abandonado (${checkoutAbandoned.length})` },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '7px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            border: 'none', cursor: 'pointer',
            background: tab === t.key ? accent : 'transparent',
            color: tab === t.key ? '#fff' : gray,
          }}>{t.label}</button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, email ou telefone…"
          style={{
            flex: 1, maxWidth: 320, padding: '9px 14px', fontSize: 13,
            border: '1.5px solid #E5E5EA', borderRadius: 10, outline: 'none',
            background: '#fff', color: dark,
          }}
        />
        {tab === 'quiz' && (
          <select
            value={slugFilter}
            onChange={e => setSlugFilter(e.target.value)}
            style={{
              padding: '9px 14px', fontSize: 13, border: '1.5px solid #E5E5EA',
              borderRadius: 10, background: '#fff', color: dark, cursor: 'pointer',
            }}
          >
            <option value="all">Todos os quizzes</option>
            <option value="plano-capilar">Plano Capilar</option>
            <option value="fashion-gold">Fashion Gold</option>
          </select>
        )}
      </div>

      {/* Quiz Leads Table */}
      {tab === 'quiz' && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #F2F2F7', display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1fr auto', gap: 12 }}>
            {['Nome', 'Telefone', 'Email', 'Quiz', 'Status', 'Ação'].map(h => (
              <div key={h} style={{ fontSize: 11, fontWeight: 700, color: gray, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</div>
            ))}
          </div>
          <div style={{ maxHeight: 'calc(100vh - 360px)', overflowY: 'auto' }}>
            {filteredLeads.length === 0 && (
              <p style={{ textAlign: 'center', color: gray, fontSize: 13, padding: 32 }}>Nenhum lead encontrado</p>
            )}
            {filteredLeads.map((l, i) => {
              const waLink = whatsappLink(l.phone, l.name)
              return (
                <div key={l.id} style={{
                  display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1fr auto',
                  gap: 12, padding: '12px 20px', alignItems: 'center',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)',
                  borderBottom: '1px solid #F9F9FB',
                }}>
                  {/* Nome */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: dark }}>{l.name ?? '—'}</div>
                    <div style={{ fontSize: 11, color: gray, marginTop: 2 }}>{formatDate(l.created_at)}</div>
                  </div>

                  {/* Telefone */}
                  <div style={{ fontSize: 13, color: dark, fontFamily: 'monospace' }}>
                    {formatPhone(l.phone)}
                  </div>

                  {/* Email */}
                  <div style={{ fontSize: 12, color: gray, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.email ?? '—'}
                  </div>

                  {/* Quiz */}
                  <div>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                      background: l.quiz_slug === 'plano-capilar' ? '#FDE8EE' : '#FFF3E0',
                      color: l.quiz_slug === 'plano-capilar' ? accent : orange,
                    }}>
                      {slugLabel(l.quiz_slug)}
                    </span>
                  </div>

                  {/* Status */}
                  <div>
                    {l.isCliente ? (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#E8F8EF', color: green }}>
                        ✓ Cliente
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#F2F2F7', color: gray }}>
                        Lead
                      </span>
                    )}
                  </div>

                  {/* Ação WhatsApp */}
                  <div>
                    {waLink ? (
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                          background: '#25D366', color: '#fff', textDecoration: 'none',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        💬 WhatsApp
                      </a>
                    ) : (
                      <span style={{ fontSize: 12, color: gray }}>—</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {filteredLeads.length > 0 && (
            <div style={{ padding: '10px 20px', borderTop: '1px solid #F2F2F7', fontSize: 12, color: gray }}>
              {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* Checkout Abandonado */}
      {tab === 'checkout' && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #F2F2F7', display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', gap: 12 }}>
            {['Nome', 'Email', 'Status', 'Data'].map(h => (
              <div key={h} style={{ fontSize: 11, fontWeight: 700, color: gray, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</div>
            ))}
          </div>
          <div style={{ maxHeight: 'calc(100vh - 360px)', overflowY: 'auto' }}>
            {filteredAbandoned.length === 0 && (
              <p style={{ textAlign: 'center', color: gray, fontSize: 13, padding: 32 }}>Nenhum checkout abandonado</p>
            )}
            {filteredAbandoned.map((a, i) => {
              const phone = (a.quiz_answers as any)?.phone ?? null
              const waLink = whatsappLink(phone, a.full_name)
              return (
                <div key={a.id} style={{
                  display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr',
                  gap: 12, padding: '12px 20px', alignItems: 'center',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)',
                  borderBottom: '1px solid #F9F9FB',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: dark }}>{a.full_name ?? '—'}</div>
                    {phone && (
                      <div style={{ fontSize: 11, color: gray, marginTop: 2, fontFamily: 'monospace' }}>{formatPhone(phone)}</div>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: gray }}>{a.email}</div>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#FFF3E0', color: orange }}>
                      ⏳ Pendente
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: gray }}>{formatDate(a.created_at)}</span>
                    {waLink && (
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '4px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                          background: '#25D366', color: '#fff', textDecoration: 'none',
                        }}
                      >
                        💬
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {filteredAbandoned.length > 0 && (
            <div style={{ padding: '10px 20px', borderTop: '1px solid #F2F2F7', fontSize: 12, color: gray }}>
              {filteredAbandoned.length} pessoa{filteredAbandoned.length !== 1 ? 's' : ''} com checkout iniciado
            </div>
          )}
        </div>
      )}
    </div>
  )
}
