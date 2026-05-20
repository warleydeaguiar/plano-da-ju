import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const VALID_SLUGS = new Set(['fashion-gold', 'plano-capilar'])
const VALID_EVENTS = new Set(['viewed', 'answered'])

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { persistSession: false } })
}

/**
 * POST /api/quiz/step-event
 * Registra um evento de "viewed" ou "answered" para um passo do quiz.
 * Fire-and-forget — erros são silenciados no cliente.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const session_id = typeof body.session_id === 'string' ? body.session_id.slice(0, 64)  : null
    const quiz_slug  = typeof body.quiz_slug  === 'string' ? body.quiz_slug               : 'plano-capilar'
    const step_index = typeof body.step_index === 'number' ? body.step_index              : null
    const step_id    = typeof body.step_id    === 'string' ? body.step_id.slice(0, 64)    : null
    const event_type = typeof body.event_type === 'string' ? body.event_type              : null
    // ab_variant agora pode chegar como "flag_key:variant" — até ~200 chars pra suportar
    // múltiplos experimentos concatenados (ex: "tipo_juliane_image:variant,foo:control")
    const ab_variant = typeof body.ab_variant === 'string' ? body.ab_variant.slice(0, 200) : null

    if (!session_id || !step_id || step_index === null || !VALID_SLUGS.has(quiz_slug) || !VALID_EVENTS.has(event_type)) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    await client().from('wg_quiz_step_events' as any).insert({
      session_id,
      quiz_slug,
      step_index,
      step_id,
      event_type,
      ab_variant: ab_variant ?? null,
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
