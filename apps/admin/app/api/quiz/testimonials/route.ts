import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET — list all for a quiz
export async function GET(req: NextRequest) {
  const slug = new URL(req.url).searchParams.get('slug') ?? 'fashion-gold'
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('wg_quiz_testimonials' as any)
    .select('*')
    .eq('quiz_slug', slug)
    .order('type')
    .order('sort_order')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST — create
export async function POST(req: NextRequest) {
  const body = await req.json()
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('wg_quiz_testimonials' as any)
    .insert({ ...body, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}

// PATCH — update by id (pass id in body)
export async function PATCH(req: NextRequest) {
  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('wg_quiz_testimonials' as any)
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// DELETE — by id in query string
export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const sb = createAdminClient()
  const { error } = await sb
    .from('wg_quiz_testimonials' as any)
    .delete()
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
