import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Protegido pelo middleware do admin (sessão). CRUD de promoções temporárias.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return createAdminClient() as any }

export async function GET() {
  try {
    const { data, error } = await sb()
      .from('promotions')
      .select('id,title,description,image_url,cta_url,discount_label,starts_at,ends_at,active,created_at')
      .order('created_at', { ascending: false })
    if (error) throw error
    return NextResponse.json({ items: data ?? [] })
  } catch (e) {
    console.error('[admin/promotions GET]', e)
    return NextResponse.json({ error: 'Erro ao listar' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    const title = String(b.title ?? '').trim()
    if (!title) return NextResponse.json({ error: 'Título é obrigatório' }, { status: 400 })
    const row = {
      title: title.slice(0, 160),
      description: b.description ? String(b.description).slice(0, 1000) : null,
      image_url: b.image_url ? String(b.image_url).slice(0, 1000) : null,
      cta_url: b.cta_url ? String(b.cta_url).slice(0, 1000) : null,
      discount_label: b.discount_label ? String(b.discount_label).slice(0, 40) : null,
      starts_at: b.starts_at ? new Date(b.starts_at).toISOString() : new Date().toISOString(),
      ends_at: b.ends_at ? new Date(b.ends_at).toISOString() : null,
      active: b.active === false ? false : true,
    }
    const { data, error } = await sb().from('promotions').insert(row).select('id').single()
    if (error) throw error
    return NextResponse.json({ ok: true, id: data?.id })
  } catch (e) {
    console.error('[admin/promotions POST]', e)
    return NextResponse.json({ error: 'Erro ao criar' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const b = await req.json()
    const id = String(b.id ?? '')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patch: Record<string, any> = {}
    if (typeof b.active === 'boolean') patch.active = b.active
    if (b.title !== undefined) patch.title = String(b.title).slice(0, 160)
    if (b.description !== undefined) patch.description = b.description ? String(b.description).slice(0, 1000) : null
    if (b.image_url !== undefined) patch.image_url = b.image_url ? String(b.image_url).slice(0, 1000) : null
    if (b.cta_url !== undefined) patch.cta_url = b.cta_url ? String(b.cta_url).slice(0, 1000) : null
    if (b.discount_label !== undefined) patch.discount_label = b.discount_label ? String(b.discount_label).slice(0, 40) : null
    if (b.starts_at !== undefined) patch.starts_at = b.starts_at ? new Date(b.starts_at).toISOString() : null
    if (b.ends_at !== undefined) patch.ends_at = b.ends_at ? new Date(b.ends_at).toISOString() : null
    const { error } = await sb().from('promotions').update(patch).eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[admin/promotions PATCH]', e)
    return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { error } = await sb().from('promotions').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[admin/promotions DELETE]', e)
    return NextResponse.json({ error: 'Erro ao excluir' }, { status: 500 })
  }
}
