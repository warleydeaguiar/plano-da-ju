import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const MAX_SIZE_BYTES = 30 * 1024 * 1024 // 30 MB

/**
 * POST /api/grupos/upload
 * Recebe um arquivo de mídia (multipart/form-data) e retorna o base64
 * para uso no Evolution API (sendMedia com base64).
 *
 * Body: FormData com campo "file"
 * Returns: { base64: string, mimetype: string, mediatype: 'image'|'video'|'document', size: number }
 */
export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'Campo "file" obrigatório' }, { status: 400 })
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: `Arquivo muito grande. Máximo: 30 MB` }, { status: 400 })
  }

  const mimetype = file.type || 'application/octet-stream'
  let mediatype: 'image' | 'video' | 'document' = 'document'

  if (mimetype.startsWith('image/')) mediatype = 'image'
  else if (mimetype.startsWith('video/')) mediatype = 'video'

  // Converte para base64
  const buffer = await file.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')

  return NextResponse.json({
    base64,
    mimetype,
    mediatype,
    size: file.size,
    filename: file.name,
  })
}
