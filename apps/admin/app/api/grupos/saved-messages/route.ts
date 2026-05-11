import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/** GET /api/grupos/saved-messages — lista todas as mensagens salvas */
export async function GET() {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('wg_saved_messages' as any)
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

/** POST /api/grupos/saved-messages — cria mensagem salva */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { title, message, media_url, media_type } = body
  if (!title?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'title e message são obrigatórios' }, { status: 400 })
  }
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('wg_saved_messages' as any)
    .insert({ title: title.trim(), message: message.trim(), media_url: media_url || null, media_type: media_type || null })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/** PATCH /api/grupos/saved-messages — atualiza mensagem salva */
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, title, message, media_url, media_type } = body
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const sb = createAdminClient()
  const { error } = await sb
    .from('wg_saved_messages' as any)
    .update({ title, message, media_url: media_url || null, media_type: media_type || null, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

/** DELETE /api/grupos/saved-messages?id=xxx — remove mensagem salva */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const sb = createAdminClient()
  const { error } = await sb.from('wg_saved_messages' as any).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
