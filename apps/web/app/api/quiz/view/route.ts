import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const VALID_SLUGS = new Set(['fashion-gold', 'plano-capilar'])

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { persistSession: false } })
}

/** POST /api/quiz/view — registra pageview de um quiz (para taxa de conversão) */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const quiz_slug = typeof body.quiz_slug === 'string' ? body.quiz_slug : 'plano-capilar'
    if (!VALID_SLUGS.has(quiz_slug)) return NextResponse.json({ ok: false })

    const utm_source   = typeof body.utm_source   === 'string' ? body.utm_source.slice(0, 100)   : null
    const utm_campaign = typeof body.utm_campaign === 'string' ? body.utm_campaign.slice(0, 100) : null

    await client().from('wg_quiz_views' as any).insert({ quiz_slug, utm_source, utm_campaign })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
