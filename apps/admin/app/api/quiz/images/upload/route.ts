import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/quiz/images/upload
 * FormData: file (imagem) + key (slot)
 * Sobe para o bucket 'quiz-images' e retorna a public URL.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const key = formData.get('key') as string | null

    if (!file || !key) {
      return NextResponse.json({ error: 'file e key são obrigatórios' }, { status: 400 })
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Imagem maior que 10MB' }, { status: 413 })
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Tipo de arquivo inválido (apenas imagens)' }, { status: 400 })
    }

    const sb = createAdminClient()
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const filename = `${key}_${Date.now()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await sb.storage
      .from('quiz-images')
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: true,
        cacheControl: '3600',
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: pub } = sb.storage.from('quiz-images').getPublicUrl(filename)
    const url = pub.publicUrl

    // Atualiza o registro na tabela wg_quiz_images
    await sb
      .from('wg_quiz_images' as any)
      .update({ url, updated_at: new Date().toISOString() })
      .eq('key', key)

    return NextResponse.json({ ok: true, url })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
