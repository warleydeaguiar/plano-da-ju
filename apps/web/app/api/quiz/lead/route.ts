import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const CAPACITY = 1024

const VALID_SLUGS = new Set(['fashion-gold', 'plano-capilar'])
const MAX_LEN = { name: 120, email: 200, phone: 20, slug: 60, utm: 200 }

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env vars not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

function truncate(val: unknown, max: number): string | null {
  if (typeof val !== 'string' || !val.trim()) return null
  return val.trim().slice(0, max)
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const quiz_slug = truncate(body.quiz_slug ?? 'fashion-gold', MAX_LEN.slug) ?? 'fashion-gold'
  if (!VALID_SLUGS.has(quiz_slug)) {
    return NextResponse.json({ error: 'Quiz inválido' }, { status: 400 })
  }

  const name       = truncate(body.name, MAX_LEN.name)
  const email      = truncate(body.email, MAX_LEN.email)
  const phone      = truncate(body.phone, MAX_LEN.phone)
  const utm_source   = truncate(body.utm_source, MAX_LEN.utm)
  const utm_medium   = truncate(body.utm_medium, MAX_LEN.utm)
  const utm_campaign = truncate(body.utm_campaign, MAX_LEN.utm)
  const utm_content  = truncate(body.utm_content, MAX_LEN.utm)
  const utm_term     = truncate(body.utm_term, MAX_LEN.utm)

  const db = adminClient()

  // Pick the group with fewest members that still has space + has invite_link
  const { data: target } = await db
    .from('wg_groups' as any)
    .select('id, invite_link, member_count, name')
    .eq('status', 'active')
    .eq('is_receiving', true)
    .not('invite_link', 'is', null)
    .lt('member_count', CAPACITY)
    .order('member_count', { ascending: true })
    .limit(1)
    .maybeSingle()

  const inviteLink: string | null = (target as any)?.invite_link ?? null
  const groupId: string | null = (target as any)?.id ?? null

  // Save lead — log but do not block the response on insert failure
  const { error: insertError } = await db.from('wg_quiz_leads' as any).insert({
    quiz_slug,
    name, email, phone,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    group_redirected_to: groupId,
    invite_link_used: inviteLink,
  })

  if (insertError) {
    console.error('[quiz/lead] insert error:', insertError.message)
  }

  return NextResponse.json({ invite_link: inviteLink })
}
