import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
// Cache 5 min — testimonials rarely change
export const revalidate = 300

function client() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function GET(req: NextRequest) {
  const slug = new URL(req.url).searchParams.get('slug') ?? 'fashion-gold'

  const { data, error } = await client()
    .from('wg_quiz_testimonials' as any)
    .select('id, type, sort_order, name, city, stars, text, photo_url')
    .eq('quiz_slug', slug)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
