import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/** GET /api/quiz/images — lista todos os slots de imagem */
export async function GET() {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('wg_quiz_images' as any)
    .select('*')
    .order('section', { ascending: true })
    .order('sort_order', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

/** PATCH /api/quiz/images — atualiza URL de um slot */
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { key, url, description } = body
  if (!key || typeof url !== 'string') {
    return NextResponse.json({ error: 'key e url são obrigatórios' }, { status: 400 })
  }
  const sb = createAdminClient()
  const updates: Record<string, any> = { url, updated_at: new Date().toISOString() }
  if (typeof description === 'string') updates.description = description
  const { error } = await sb.from('wg_quiz_images' as any).update(updates).eq('key', key)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
