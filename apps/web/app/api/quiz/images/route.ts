import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const revalidate = 60 // cache 1 minuto

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { persistSession: false } })
}

/**
 * GET /api/quiz/images
 * Retorna um mapa { key: url } com todas as imagens configuradas.
 * Usado pelo QuizClient e OfertaClient para carregar imagens dinâmicas.
 */
export async function GET() {
  try {
    const { data } = await client()
      .from('wg_quiz_images' as any)
      .select('key, url')
    const map: Record<string, string> = {}
    for (const row of (data ?? []) as any[]) {
      if (row.key && row.url) map[row.key] = row.url
    }
    return NextResponse.json(map, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300' },
    })
  } catch {
    return NextResponse.json({})
  }
}
