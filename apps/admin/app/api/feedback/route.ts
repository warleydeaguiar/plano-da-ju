import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Sobe um print colado (data URL base64) pro storage e devolve a URL pública.
async function uploadScreenshot(sb: ReturnType<typeof createAdminClient>, dataUrl: string): Promise<string | null> {
  const m = /^data:(image\/(png|jpeg|jpg|webp|gif));base64,(.+)$/i.exec(dataUrl)
  if (!m) return null
  const mime = m[1]
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : mime.includes('gif') ? 'gif' : 'jpg'
  const buffer = Buffer.from(m[3], 'base64')
  if (buffer.length > 6 * 1024 * 1024) return null // ~6MB
  const fileName = `feedback/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await sb.storage.from('email-assets').upload(fileName, buffer, { contentType: mime, upsert: false })
  if (error) { console.error('[feedback/upload]', error); return null }
  const { data } = sb.storage.from('email-assets').getPublicUrl(fileName)
  return data.publicUrl
}

// POST — cria um feedback (bug/sugestão). Body: { type, message, page_url?, screenshot? (data URL) }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const type = body.type === 'suggestion' ? 'suggestion' : 'bug'
    const message = (body.message ?? '').toString().trim()
    if (!message) return NextResponse.json({ error: 'Escreva o que aconteceu.' }, { status: 400 })
    if (message.length > 5000) return NextResponse.json({ error: 'Mensagem muito longa.' }, { status: 400 })

    const sb = createAdminClient()
    let screenshot_url: string | null = null
    if (typeof body.screenshot === 'string' && body.screenshot.startsWith('data:image/')) {
      screenshot_url = await uploadScreenshot(sb, body.screenshot)
    }

    const { data, error } = await (sb.from('admin_feedback') as any)
      .insert({
        type,
        message,
        page_url: (body.page_url ?? '').toString().slice(0, 500) || null,
        screenshot_url,
        submitted_by: (body.submitted_by ?? '').toString().slice(0, 200) || null,
      })
      .select('id')
      .single()

    if (error) { console.error('[feedback POST]', error); return NextResponse.json({ error: 'Falha ao salvar' }, { status: 500 }) }
    return NextResponse.json({ ok: true, id: data.id })
  } catch (err) {
    console.error('[feedback POST]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// PATCH — atualiza status/nota. Body: { id, status?, resolution_note? }
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
    const patch: Record<string, unknown> = {}
    if (body.status && ['open', 'in_progress', 'resolved', 'dismissed'].includes(body.status)) {
      patch.status = body.status
      patch.resolved_at = ['resolved', 'dismissed'].includes(body.status) ? new Date().toISOString() : null
    }
    if (typeof body.resolution_note === 'string') patch.resolution_note = body.resolution_note.slice(0, 2000)
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })

    const sb = createAdminClient()
    const { error } = await (sb.from('admin_feedback') as any).update(patch).eq('id', body.id)
    if (error) { console.error('[feedback PATCH]', error); return NextResponse.json({ error: 'Falha ao atualizar' }, { status: 500 }) }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[feedback PATCH]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
