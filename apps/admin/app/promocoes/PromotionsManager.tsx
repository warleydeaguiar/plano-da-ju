'use client'

import { useEffect, useState } from 'react'
import { T, fonts, shadow } from '../theme'

type Promo = {
  id: string
  title: string
  description: string | null
  image_url: string | null
  cta_url: string | null
  discount_label: string | null
  starts_at: string | null
  ends_at: string | null
  active: boolean
  created_at: string
}

const empty = { title: '', description: '', image_url: '', cta_url: '', discount_label: '', starts_at: '', ends_at: '' }

function fmt(iso: string | null): string {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) } catch { return '—' }
}
function isLive(p: Promo): boolean {
  if (!p.active) return false
  const now = Date.now()
  if (p.starts_at && new Date(p.starts_at).getTime() > now) return false
  if (p.ends_at && new Date(p.ends_at).getTime() < now) return false
  return true
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: 10,
  border: `1px solid ${T.border}`, background: '#fff', color: T.ink, outline: 'none',
  fontFamily: fonts.ui, boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: T.inkSoft, marginBottom: 4, display: 'block' }

export default function PromotionsManager() {
  const [items, setItems] = useState<Promo[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ ...empty })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const r = await fetch('/api/promotions')
      const d = await r.json()
      setItems(Array.isArray(d.items) ? d.items : [])
    } catch { /* noop */ }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function create() {
    if (!form.title.trim()) { setMsg('Informe um título.'); return }
    setSaving(true); setMsg(null)
    try {
      const r = await fetch('/api/promotions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          starts_at: form.starts_at || null,
          ends_at: form.ends_at || null,
        }),
      })
      if (!r.ok) { setMsg('Erro ao criar.'); return }
      setForm({ ...empty })
      setMsg('Promoção criada ✓')
      await load()
    } catch { setMsg('Falha de conexão.') } finally { setSaving(false) }
  }

  async function toggle(p: Promo) {
    await fetch('/api/promotions', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, active: !p.active }),
    })
    await load()
  }
  async function remove(p: Promo) {
    if (!confirm(`Excluir a promoção "${p.title}"?`)) return
    await fetch(`/api/promotions?id=${p.id}`, { method: 'DELETE' })
    await load()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Form */}
      <div style={{ background: T.surface, borderRadius: 16, border: `1px solid ${T.borderSoft}`, boxShadow: shadow.card, padding: 22 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, marginBottom: 4 }}>Nova promoção</div>
        <div style={{ fontSize: 12.5, color: T.inkMuted, marginBottom: 16 }}>
          Aparece na aba <b>Promoções</b> do app enquanto estiver ativa e dentro do período.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Título *</label>
            <input style={inputStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Leave-in Universal com 30% OFF" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Descrição</label>
            <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Detalhe a oferta…" />
          </div>
          <div>
            <label style={labelStyle}>Selo de desconto</label>
            <input style={inputStyle} value={form.discount_label} onChange={e => setForm(f => ({ ...f, discount_label: e.target.value }))} placeholder="Ex: 30% OFF" />
          </div>
          <div>
            <label style={labelStyle}>Link (CTA)</label>
            <input style={inputStyle} value={form.cta_url} onChange={e => setForm(f => ({ ...f, cta_url: e.target.value }))} placeholder="https://… (vazio = grupo WhatsApp)" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Imagem (URL)</label>
            <input style={inputStyle} value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://…/imagem.jpg" />
          </div>
          <div>
            <label style={labelStyle}>Início</label>
            <input type="datetime-local" style={inputStyle} value={form.starts_at} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Fim (vazio = sem prazo)</label>
            <input type="datetime-local" style={inputStyle} value={form.ends_at} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 16 }}>
          <button onClick={create} disabled={saving}
            style={{ background: `linear-gradient(135deg, ${T.pink}, ${T.pinkDeep})`, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer', fontFamily: fonts.ui }}>
            {saving ? 'Salvando…' : 'Criar promoção'}
          </button>
          {msg && <span style={{ fontSize: 13, color: msg.includes('✓') ? T.green : T.danger }}>{msg}</span>}
        </div>
      </div>

      {/* List */}
      <div style={{ background: T.surface, borderRadius: 16, border: `1px solid ${T.borderSoft}`, boxShadow: shadow.card, padding: 22 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, marginBottom: 14 }}>Promoções ({items.length})</div>
        {loading ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: T.inkMuted, fontSize: 13 }}>Carregando…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: T.inkMuted, fontSize: 13 }}>Nenhuma promoção cadastrada.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map(p => {
              const live = isLive(p)
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 12, border: `1px solid ${T.borderSoft}`, borderRadius: 12, background: T.cream }}>
                  {p.image_url
                    ? <div style={{ width: 54, height: 54, borderRadius: 10, background: `url(${p.image_url}) center/cover`, flexShrink: 0 }} />
                    : <div style={{ width: 54, height: 54, borderRadius: 10, background: T.pinkSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🎁</div>}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{p.title}</span>
                      {p.discount_label && <span style={{ fontSize: 10, fontWeight: 700, color: T.pinkDeep, background: T.pinkSoft, padding: '2px 6px', borderRadius: 5 }}>{p.discount_label}</span>}
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 99, color: live ? T.green : T.inkMuted, background: live ? T.greenSoft : T.bgWarm }}>
                        {live ? '● No ar' : p.active ? '○ Agendada/expirada' : '○ Inativa'}
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: T.inkMuted, marginTop: 3 }}>
                      {fmt(p.starts_at)} → {p.ends_at ? fmt(p.ends_at) : 'sem prazo'}
                    </div>
                  </div>
                  <button onClick={() => toggle(p)} style={{ border: `1px solid ${T.border}`, background: '#fff', color: T.ink, borderRadius: 8, padding: '6px 12px', fontSize: 12.5, cursor: 'pointer', fontFamily: fonts.ui }}>
                    {p.active ? 'Desativar' : 'Ativar'}
                  </button>
                  <button onClick={() => remove(p)} style={{ border: `1px solid ${T.dangerSoft}`, background: T.dangerSoft, color: T.danger, borderRadius: 8, padding: '6px 12px', fontSize: 12.5, cursor: 'pointer', fontFamily: fonts.ui }}>
                    Excluir
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
