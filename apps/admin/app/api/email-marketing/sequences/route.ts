import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/email-marketing/sequences
export async function GET() {
  const sb = createAdminClient()
  const { data, error } = await (sb as any)
    .from('wg_email_sequences')
    .select('*')
    .order('delay_days', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// PATCH /api/email-marketing/sequences — update a sequence
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  updates.updated_at = new Date().toISOString()

  const sb = createAdminClient()
  const { data, error } = await (sb as any)
    .from('wg_email_sequences')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, sequence: data })
}

// POST /api/email-marketing/sequences — create new sequence
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, delay_days, subject, html_body, text_body, quiz_slug, send_hour } = body

  if (!name || delay_days == null || !subject) {
    return NextResponse.json({ error: 'name, delay_days, subject são obrigatórios' }, { status: 400 })
  }

  const sb = createAdminClient()
  const { data, error } = await (sb as any)
    .from('wg_email_sequences')
    .insert({
      name,
      delay_days: Number(delay_days),
      subject,
      html_body: html_body ?? '',
      text_body: text_body ?? '',
      quiz_slug: quiz_slug || null,
      send_hour: send_hour ?? 9,
      enabled: false,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, sequence: data })
}

// DELETE /api/email-marketing/sequences?id=xxx
export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const sb = createAdminClient()
  await (sb as any).from('wg_email_sequences').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
