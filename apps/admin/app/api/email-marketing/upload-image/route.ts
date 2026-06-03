import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// POST /api/email-marketing/upload-image
// Recebe um arquivo de imagem (campo "image") e devolve a URL pública,
// pra usar no corpo do broadcast. Antes só dava pra colar uma URL externa.
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('image')
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Nenhuma imagem enviada' }, { status: 400 })
    }

    const f = file as File
    if (f.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Imagem muito grande (máx. 5 MB)' }, { status: 400 })
    }
    if (!f.type.startsWith('image/')) {
      return NextResponse.json({ error: 'O arquivo precisa ser uma imagem' }, { status: 400 })
    }

    const sb = createAdminClient()
    const ext = f.type === 'image/png' ? 'png'
      : f.type === 'image/webp' ? 'webp'
      : f.type === 'image/gif' ? 'gif'
      : 'jpg'
    const fileName = `broadcasts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const buffer = new Uint8Array(await f.arrayBuffer())
    const { error: upErr } = await sb.storage.from('email-assets').upload(fileName, buffer, {
      contentType: f.type,
      upsert: false,
    })
    if (upErr) {
      console.error('[email-marketing/upload-image]', upErr)
      return NextResponse.json({ error: 'Falha ao salvar a imagem' }, { status: 500 })
    }

    const { data: pub } = sb.storage.from('email-assets').getPublicUrl(fileName)
    return NextResponse.json({ ok: true, url: pub.publicUrl })
  } catch (err) {
    console.error('[email-marketing/upload-image]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
