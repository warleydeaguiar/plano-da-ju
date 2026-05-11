import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { persistSession: false } })
}

/**
 * POST /api/quiz/answers
 * Salva as respostas do quiz principal (plano-capilar) para analytics.
 * Body: { session_id, quiz_slug, answers: Record<string, string|string[]>, utm_source?, utm_campaign? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { session_id, quiz_slug = 'plano-capilar', answers, utm_source, utm_campaign } = body

    if (!answers || typeof answers !== 'object') return NextResponse.json({ ok: false })

    const rows = Object.entries(answers)
      .filter(([qid, ans]) => qid && ans !== undefined && ans !== null && ans !== '')
      .map(([question_id, answer]) => ({
        session_id: typeof session_id === 'string' ? session_id.slice(0, 36) : null,
        quiz_slug,
        question_id,
        answer,
        utm_source:   typeof utm_source   === 'string' ? utm_source.slice(0, 100)   : null,
        utm_campaign: typeof utm_campaign === 'string' ? utm_campaign.slice(0, 100) : null,
      }))

    if (rows.length === 0) return NextResponse.json({ ok: true })

    await client().from('wg_quiz_answers' as any).insert(rows)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
