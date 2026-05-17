'use client'

import { useState, useCallback } from 'react'

// ─── Colours ──────────────────────────────────────────────────────
const accent = '#C4607A'
const green  = '#34C759'
const orange = '#FF9500'
const red    = '#FF3B30'
const gray   = '#8A8A8E'

// ─── Types ────────────────────────────────────────────────────────
interface ProductRow {
  id: string
  name: string
  brand: string | null
  category: string | null
  price_brl: number | null
  affiliate_url: string | null
  image_url: string | null
  hair_types: string[] | null
  is_ybera: boolean
  active: boolean
}

type FormData = {
  name: string
  brand: string
  category: string
  price_brl: string
  affiliate_url: string
  image_url: string
  hair_types: string[]
  is_ybera: boolean
  active: boolean
}

const EMPTY_FORM: FormData = {
  name: '',
  brand: '',
  category: '',
  price_brl: '',
  affiliate_url: '',
  image_url: '',
  hair_types: [],
  is_ybera: false,
  active: true,
}

const CATEGORIES = [
  { key: 'limpeza',       label: 'Shampoo / Limpeza' },
  { key: 'condicionador', label: 'Condicionador' },
  { key: 'mascara',       label: 'Máscara' },
  { key: 'oleo',          label: 'Óleo' },
  { key: 'protetor',      label: 'Protetor' },
]

const HAIR_TYPES = [
  { key: 'liso',     label: 'Liso' },
  { key: 'ondulado', label: 'Ondulado' },
  { key: 'cacheado', label: 'Cacheado' },
  { key: 'crespo',   label: 'Crespo' },
]

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(c => [c.key, c.label])
)

// ─── Helpers ──────────────────────────────────────────────────────
function brl(v: number | null | undefined) {
  if (v == null) return '—'
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function productToForm(p: ProductRow): FormData {
  return {
    name: p.name,
    brand: p.brand ?? '',
    category: p.category ?? '',
    price_brl: p.price_brl != null ? String(p.price_brl) : '',
    affiliate_url: p.affiliate_url ?? '',
    image_url: p.image_url ?? '',
    hair_types: p.hair_types ?? [],
    is_ybera: p.is_ybera,
    active: p.active,
  }
}

// ─── Modal ────────────────────────────────────────────────────────
function Modal({
  title,
  form,
  setForm,
  onSave,
  onClose,
  saving,
  errorMsg,
}: {
  title: string
  form: FormData
  setForm: (f: FormData) => void
  onSave: () => void
  onClose: () => void
  saving: boolean
  errorMsg: string | null
}) {
  function toggleHairType(key: string) {
    const current = form.hair_types
    setForm({
      ...form,
      hair_types: current.includes(key)
        ? current.filter(h => h !== key)
        : [...current, key],
    })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13,
    border: '1px solid #E0E0E8', outline: 'none', background: '#FAFAFA',
    color: '#2D1B2E', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: gray,
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5, display: 'block',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '20px',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: '#fff', borderRadius: 18, width: '100%', maxWidth: 560,
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        {/* Header */}
        <div style={{
          padding: '22px 28px 18px',
          borderBottom: '1px solid #F0F0F5',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, background: '#fff', zIndex: 1,
          borderRadius: '18px 18px 0 0',
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#2D1B2E' }}>{title}</div>
          <button onClick={onClose} style={{
            background: '#F5F5F7', border: 'none', borderRadius: 8,
            width: 32, height: 32, cursor: 'pointer', fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Name */}
          <div>
            <label style={labelStyle}>Nome do produto *</label>
            <input
              style={inputStyle}
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Shampoo Nutritivo Ybera"
            />
          </div>

          {/* Brand + Category */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Marca</label>
              <input
                style={inputStyle}
                value={form.brand}
                onChange={e => setForm({ ...form, brand: e.target.value })}
                placeholder="Ex: Ybera Paris"
              />
            </div>
            <div>
              <label style={labelStyle}>Categoria</label>
              <select
                style={{ ...inputStyle, cursor: 'pointer' }}
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
              >
                <option value="">Selecionar…</option>
                {CATEGORIES.map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Price + Image URL */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Preço (R$)</label>
              <input
                style={inputStyle}
                type="number"
                step="0.01"
                min="0"
                value={form.price_brl}
                onChange={e => setForm({ ...form, price_brl: e.target.value })}
                placeholder="0,00"
              />
            </div>
            <div>
              <label style={labelStyle}>URL da imagem</label>
              <input
                style={inputStyle}
                value={form.image_url}
                onChange={e => setForm({ ...form, image_url: e.target.value })}
                placeholder="https://…"
              />
            </div>
          </div>

          {/* Affiliate URL */}
          <div>
            <label style={labelStyle}>Link de afiliado</label>
            <input
              style={inputStyle}
              value={form.affiliate_url}
              onChange={e => setForm({ ...form, affiliate_url: e.target.value })}
              placeholder="https://…"
            />
            <div style={{ fontSize: 11, color: gray, marginTop: 4 }}>
              Link que abre ao clicar em "Ver produto" no app
            </div>
          </div>

          {/* Hair types */}
          <div>
            <label style={labelStyle}>Tipos de cabelo</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {HAIR_TYPES.map(h => {
                const selected = form.hair_types.includes(h.key)
                return (
                  <button
                    key={h.key}
                    type="button"
                    onClick={() => toggleHairType(h.key)}
                    style={{
                      padding: '6px 14px', borderRadius: 99,
                      border: selected ? `1.5px solid ${accent}` : '1.5px solid #E0E0E8',
                      background: selected ? accent + '14' : '#FAFAFA',
                      color: selected ? accent : gray,
                      fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {h.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Toggles */}
          <div style={{ display: 'flex', gap: 14 }}>
            {/* Is Ybera */}
            <div
              onClick={() => setForm({ ...form, is_ybera: !form.is_ybera })}
              style={{
                flex: 1, padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                border: `1.5px solid ${form.is_ybera ? accent : '#E0E0E8'}`,
                background: form.is_ybera ? accent + '08' : '#FAFAFA',
                display: 'flex', alignItems: 'center', gap: 10,
                transition: 'all 0.15s',
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: 5,
                background: form.is_ybera ? accent : '#E0E0E8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'background 0.15s',
              }}>
                {form.is_ybera && <span style={{ color: '#fff', fontSize: 13, lineHeight: 1 }}>✓</span>}
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#2D1B2E' }}>✨ Produto Ybera</div>
                <div style={{ fontSize: 11, color: gray }}>Aparece na seção Ybera Paris</div>
              </div>
            </div>

            {/* Active */}
            <div
              onClick={() => setForm({ ...form, active: !form.active })}
              style={{
                flex: 1, padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                border: `1.5px solid ${form.active ? green : '#E0E0E8'}`,
                background: form.active ? green + '08' : '#FAFAFA',
                display: 'flex', alignItems: 'center', gap: 10,
                transition: 'all 0.15s',
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: 5,
                background: form.active ? green : '#E0E0E8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'background 0.15s',
              }}>
                {form.active && <span style={{ color: '#fff', fontSize: 13, lineHeight: 1 }}>✓</span>}
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#2D1B2E' }}>Ativo no app</div>
                <div style={{ fontSize: 11, color: gray }}>Visível em Promoções</div>
              </div>
            </div>
          </div>

          {/* Error */}
          {errorMsg && (
            <div style={{
              background: red + '10', border: `1px solid ${red}30`,
              borderRadius: 8, padding: '10px 14px', fontSize: 13, color: red,
            }}>
              {errorMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 28px 24px',
          display: 'flex', gap: 10, justifyContent: 'flex-end',
          position: 'sticky', bottom: 0, background: '#fff',
          borderTop: '1px solid #F0F0F5',
        }}>
          <button onClick={onClose} style={{
            padding: '10px 20px', borderRadius: 10,
            border: '1px solid #E0E0E8', background: '#F5F5F7',
            fontSize: 13.5, fontWeight: 600, color: '#2D1B2E', cursor: 'pointer',
          }}>
            Cancelar
          </button>
          <button onClick={onSave} disabled={saving} style={{
            padding: '10px 24px', borderRadius: 10,
            border: 'none', background: saving ? gray : accent,
            fontSize: 13.5, fontWeight: 700, color: '#fff', cursor: saving ? 'default' : 'pointer',
            transition: 'background 0.15s',
          }}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Delete Confirm Modal ─────────────────────────────────────────
function DeleteConfirm({
  product,
  onConfirm,
  onClose,
  deleting,
}: {
  product: ProductRow
  onConfirm: () => void
  onClose: () => void
  deleting: boolean
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1001, padding: '20px',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: '#fff', borderRadius: 18, width: '100%', maxWidth: 420, padding: '28px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{ fontSize: 32, marginBottom: 14, textAlign: 'center' }}>🗑️</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#2D1B2E', textAlign: 'center', marginBottom: 8 }}>
          Remover produto?
        </div>
        <div style={{ fontSize: 13, color: gray, textAlign: 'center', marginBottom: 24, lineHeight: 1.5 }}>
          <strong style={{ color: '#2D1B2E' }}>{product.name}</strong> será removido permanentemente
          e não aparecerá mais em Promoções.
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '11px', borderRadius: 10,
            border: '1px solid #E0E0E8', background: '#F5F5F7',
            fontSize: 13.5, fontWeight: 600, color: '#2D1B2E', cursor: 'pointer',
          }}>
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={deleting} style={{
            flex: 1, padding: '11px', borderRadius: 10,
            border: 'none', background: deleting ? gray : red,
            fontSize: 13.5, fontWeight: 700, color: '#fff', cursor: deleting ? 'default' : 'pointer',
          }}>
            {deleting ? 'Removendo…' : 'Remover'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Product Row ─────────────────────────────────────────────────
function ProductItem({
  product,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  product: ProductRow
  onEdit: (p: ProductRow) => void
  onDelete: (p: ProductRow) => void
  onToggleActive: (p: ProductRow) => void
}) {
  return (
    <tr style={{ borderBottom: '1px solid #F0F0F5' }}>
      {/* Image + Name */}
      <td style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
            background: product.is_ybera
              ? 'linear-gradient(135deg, #C4607A, #8B3A6E)'
              : '#F0F0F5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {product.image_url
              ? <img src={product.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 18 }}>🧴</span>
            }
          </div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#2D1B2E', lineHeight: 1.3 }}>
              {product.name}
            </div>
            <div style={{ fontSize: 11, color: gray, marginTop: 1 }}>
              {product.brand || '—'}
            </div>
          </div>
        </div>
      </td>

      {/* Category */}
      <td style={{ padding: '12px 16px', fontSize: 12.5, color: '#2D1B2E' }}>
        {product.category ? (CATEGORY_LABELS[product.category] ?? product.category) : '—'}
      </td>

      {/* Price */}
      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: accent }}>
        {brl(product.price_brl)}
      </td>

      {/* Hair types */}
      <td style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {(product.hair_types ?? []).length > 0
            ? (product.hair_types ?? []).map(h => (
                <span key={h} style={{
                  fontSize: 10, fontWeight: 600, padding: '2px 7px',
                  borderRadius: 5, background: '#F0E8F0', color: '#8B3A6E',
                }}>
                  {h}
                </span>
              ))
            : <span style={{ fontSize: 12, color: gray }}>—</span>
          }
        </div>
      </td>

      {/* Affiliate link */}
      <td style={{ padding: '12px 16px' }}>
        {product.affiliate_url
          ? <a href={product.affiliate_url} target="_blank" rel="noopener noreferrer" style={{
              fontSize: 12, color: accent, fontWeight: 600, textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              🔗 Ver link
            </a>
          : <span style={{ fontSize: 12, color: gray }}>Sem link</span>
        }
      </td>

      {/* Tags */}
      <td style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {product.is_ybera && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '3px 8px',
              borderRadius: 5, background: accent + '14', color: accent,
            }}>✨ Ybera</span>
          )}
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5,
            background: product.active ? green + '14' : '#F0F0F5',
            color: product.active ? green : gray,
          }}>
            {product.active ? 'Ativo' : 'Inativo'}
          </span>
        </div>
      </td>

      {/* Actions */}
      <td style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* Toggle active */}
          <button
            onClick={() => onToggleActive(product)}
            title={product.active ? 'Desativar' : 'Ativar'}
            style={{
              padding: '6px 10px', borderRadius: 8, border: 'none',
              background: product.active ? orange + '15' : green + '15',
              color: product.active ? orange : green,
              fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {product.active ? '⏸ Desativar' : '▶ Ativar'}
          </button>

          {/* Edit */}
          <button
            onClick={() => onEdit(product)}
            style={{
              padding: '6px 12px', borderRadius: 8, border: `1px solid ${accent}30`,
              background: accent + '0A', color: accent,
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}
          >
            ✏️ Editar
          </button>

          {/* Delete */}
          <button
            onClick={() => onDelete(product)}
            style={{
              padding: '6px 10px', borderRadius: 8, border: 'none',
              background: red + '10', color: red,
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}
          >
            🗑
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Main Client ─────────────────────────────────────────────────
export default function ProdutosClient({ initialProducts }: { initialProducts: ProductRow[] }) {
  const [products, setProducts] = useState<ProductRow[]>(initialProducts)
  const [filterCat, setFilterCat] = useState('all')
  const [filterSearch, setFilterSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')

  // Modal state
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null)
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Delete state
  const [deletingProduct, setDeletingProduct] = useState<ProductRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Filtered products ────────────────────────────────────────────
  const filtered = products.filter(p => {
    const q = filterSearch.toLowerCase()
    const matchSearch = !q ||
      p.name.toLowerCase().includes(q) ||
      (p.brand ?? '').toLowerCase().includes(q)
    const matchCat = filterCat === 'all' || p.category === filterCat
    const matchStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && p.active) ||
      (filterStatus === 'inactive' && !p.active)
    return matchSearch && matchCat && matchStatus
  })

  const activeCount = products.filter(p => p.active).length
  const yberaCount  = products.filter(p => p.is_ybera).length

  // ── Open add modal ────────────────────────────────────────────────
  function openAdd() {
    setEditingProduct(null)
    setForm(EMPTY_FORM)
    setErrorMsg(null)
    setModalMode('add')
  }

  // ── Open edit modal ───────────────────────────────────────────────
  function openEdit(p: ProductRow) {
    setEditingProduct(p)
    setForm(productToForm(p))
    setErrorMsg(null)
    setModalMode('edit')
  }

  // ── Save ──────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!form.name.trim()) {
      setErrorMsg('Nome é obrigatório.')
      return
    }
    setSaving(true)
    setErrorMsg(null)

    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        brand: form.brand.trim() || null,
        category: form.category || null,
        price_brl: form.price_brl ? Number(form.price_brl) : null,
        affiliate_url: form.affiliate_url.trim() || null,
        image_url: form.image_url.trim() || null,
        hair_types: form.hair_types,
        is_ybera: form.is_ybera,
        active: form.active,
      }

      if (modalMode === 'edit' && editingProduct) {
        body.id = editingProduct.id
        const res = await fetch('/api/produtos', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setProducts(prev => prev.map(p => p.id === editingProduct.id ? data : p))
        showToast('Produto atualizado!')
      } else {
        const res = await fetch('/api/produtos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setProducts(prev => [data, ...prev])
        showToast('Produto criado!')
      }

      setModalMode(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar'
      setErrorMsg(msg)
    } finally {
      setSaving(false)
    }
  }, [form, modalMode, editingProduct])

  // ── Toggle active ─────────────────────────────────────────────────
  async function handleToggleActive(p: ProductRow) {
    const updated = { ...p, active: !p.active }
    setProducts(prev => prev.map(x => x.id === p.id ? updated : x))
    try {
      const res = await fetch('/api/produtos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, active: updated.active }),
      })
      if (!res.ok) throw new Error('Erro')
      showToast(updated.active ? 'Produto ativado!' : 'Produto desativado!')
    } catch {
      // Revert on error
      setProducts(prev => prev.map(x => x.id === p.id ? p : x))
      showToast('Erro ao atualizar status', 'error')
    }
  }

  // ── Delete ────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deletingProduct) return
    setDeleting(true)
    try {
      const res = await fetch('/api/produtos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deletingProduct.id }),
      })
      if (!res.ok) throw new Error('Erro ao deletar')
      setProducts(prev => prev.filter(p => p.id !== deletingProduct.id))
      setDeletingProduct(null)
      showToast('Produto removido!')
    } catch {
      showToast('Erro ao remover produto', 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 2000,
          background: toast.type === 'success' ? green : red,
          color: '#fff', padding: '12px 20px', borderRadius: 12,
          fontSize: 13.5, fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          animation: 'fadeInUp 0.25s ease',
        }}>
          {toast.type === 'success' ? '✓ ' : '✗ '}{toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#2D1B2E' }}>Produtos & Promoções</div>
          <div style={{ fontSize: 13, color: gray, marginTop: 4 }}>
            Catálogo visível em{' '}
            <a
              href="https://planodaju.julianecost.com/meu-plano/promocoes"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: accent, textDecoration: 'none', fontWeight: 600 }}
            >
              meu-plano/promocoes
            </a>
          </div>
        </div>
        <button onClick={openAdd} style={{
          padding: '10px 20px', borderRadius: 10,
          border: 'none', background: accent,
          fontSize: 13.5, fontWeight: 700, color: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 7,
        }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Novo produto
        </button>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { icon: '🧴', label: 'Total cadastrados', value: products.length, color: '#2D1B2E' },
          { icon: '✅', label: 'Ativos no app', value: activeCount, color: green },
          { icon: '✨', label: 'Produtos Ybera', value: yberaCount, color: accent },
          { icon: '💚', label: 'Alternativos', value: products.length - yberaCount, color: '#22C55E' },
        ].map(s => (
          <div key={s.label} style={{
            background: '#fff', borderRadius: 14, padding: '18px 22px',
            border: '1px solid rgba(0,0,0,0.06)',
          }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 11, color: gray, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div style={{
        background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)',
        padding: '16px 20px', marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        {/* Search */}
        <input
          value={filterSearch}
          onChange={e => setFilterSearch(e.target.value)}
          placeholder="🔍  Buscar produto ou marca…"
          style={{
            flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8,
            border: '1px solid #E0E0E8', fontSize: 13, color: '#2D1B2E',
            outline: 'none', background: '#FAFAFA',
          }}
        />

        {/* Category filter */}
        <select
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
          style={{
            padding: '8px 12px', borderRadius: 8, border: '1px solid #E0E0E8',
            fontSize: 13, color: '#2D1B2E', background: '#FAFAFA', cursor: 'pointer', outline: 'none',
          }}
        >
          <option value="all">Todas categorias</option>
          {CATEGORIES.map(c => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>

        {/* Status filter */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'active', 'inactive'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              style={{
                padding: '7px 14px', borderRadius: 8,
                border: filterStatus === s ? 'none' : '1px solid #E0E0E8',
                background: filterStatus === s
                  ? (s === 'inactive' ? gray : s === 'active' ? green : accent)
                  : '#FAFAFA',
                color: filterStatus === s ? '#fff' : gray,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {s === 'all' ? 'Todos' : s === 'active' ? '✅ Ativos' : '⏸ Inativos'}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 12, color: gray, whiteSpace: 'nowrap' }}>
          {filtered.length} produto{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🧴</div>
            <div style={{ fontSize: 15, color: gray, fontWeight: 500 }}>
              {products.length === 0 ? 'Nenhum produto cadastrado ainda.' : 'Nenhum produto encontrado.'}
            </div>
            {products.length === 0 && (
              <button onClick={openAdd} style={{
                marginTop: 16, padding: '10px 20px', borderRadius: 10,
                border: 'none', background: accent,
                fontSize: 13.5, fontWeight: 700, color: '#fff', cursor: 'pointer',
              }}>
                Cadastrar primeiro produto
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #F0F0F5' }}>
                  {['Produto', 'Categoria', 'Preço', 'Tipos de cabelo', 'Link afiliado', 'Status', 'Ações'].map(h => (
                    <th key={h} style={{
                      padding: '11px 16px', textAlign: 'left',
                      fontSize: 11, color: gray, fontWeight: 600,
                      textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <ProductItem
                    key={p.id}
                    product={p}
                    onEdit={openEdit}
                    onDelete={setDeletingProduct}
                    onToggleActive={handleToggleActive}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add/Edit Modal ── */}
      {modalMode && (
        <Modal
          title={modalMode === 'add' ? 'Novo produto' : `Editar: ${editingProduct?.name}`}
          form={form}
          setForm={setForm}
          onSave={handleSave}
          onClose={() => setModalMode(null)}
          saving={saving}
          errorMsg={errorMsg}
        />
      )}

      {/* ── Delete Modal ── */}
      {deletingProduct && (
        <DeleteConfirm
          product={deletingProduct}
          onConfirm={handleDelete}
          onClose={() => setDeletingProduct(null)}
          deleting={deleting}
        />
      )}
    </div>
  )
}
