import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '../../../lib/supabase'

export const runtime = 'nodejs'

// ─── GET: list all products ───────────────────────────────────────
export async function GET() {
  try {
    const supabase = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('products')
      .select('*')
      .order('is_ybera', { ascending: false })
      .order('name', { ascending: true })

    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (err: unknown) {
    console.error('[api/produtos GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar produtos' }, { status: 500 })
  }
}

// ─── POST: create product ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const supabase = createAdminClient()

    const payload = {
      name: body.name?.trim(),
      brand: body.brand?.trim() || null,
      category: body.category || null,
      price_brl: body.price_brl ? Number(body.price_brl) : null,
      affiliate_url: body.affiliate_url?.trim() || null,
      image_url: body.image_url?.trim() || null,
      hair_types: body.hair_types ?? [],
      is_ybera: Boolean(body.is_ybera),
      active: body.active !== false,
    }

    if (!payload.name) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('products')
      .insert(payload)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    console.error('[api/produtos POST]', err)
    return NextResponse.json({ error: 'Erro ao criar produto' }, { status: 500 })
  }
}

// ─── PATCH: update product ────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...rest } = body

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const payload: Record<string, unknown> = {}
    if ('name' in rest)          payload.name         = rest.name?.trim()
    if ('brand' in rest)         payload.brand        = rest.brand?.trim() || null
    if ('category' in rest)      payload.category     = rest.category || null
    if ('price_brl' in rest)     payload.price_brl    = rest.price_brl ? Number(rest.price_brl) : null
    if ('affiliate_url' in rest) payload.affiliate_url = rest.affiliate_url?.trim() || null
    if ('image_url' in rest)     payload.image_url    = rest.image_url?.trim() || null
    if ('hair_types' in rest)    payload.hair_types   = rest.hair_types ?? []
    if ('is_ybera' in rest)      payload.is_ybera     = Boolean(rest.is_ybera)
    if ('active' in rest)        payload.active       = Boolean(rest.active)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('products')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err: unknown) {
    console.error('[api/produtos PATCH]', err)
    return NextResponse.json({ error: 'Erro ao atualizar produto' }, { status: 500 })
  }
}

// ─── DELETE: remove product ───────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
    }

    const supabase = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('products')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('[api/produtos DELETE]', err)
    return NextResponse.json({ error: 'Erro ao remover produto' }, { status: 500 })
  }
}
