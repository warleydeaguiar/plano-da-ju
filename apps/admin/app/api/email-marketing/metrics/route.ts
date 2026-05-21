import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/email-marketing/metrics
export async function GET() {
  const sb = createAdminClient()

  const [sendsResult, seqResult, leadsResult] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb as any).from('wg_email_sends').select('status, sequence_id, sent_at, opened_at, clicked_at, open_count, click_count'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb as any).from('wg_email_sequences').select('id, name, delay_days, delay_minutes, audience, anchor_event, enabled'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb as any).from('wg_quiz_leads').select('id, email', { count: 'exact', head: true }),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sends: any[] = sendsResult.data ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sequences: any[] = seqResult.data ?? []
  const totalLeads = leadsResult.count ?? 0

  const total   = sends.length
  const sent    = sends.filter(s => s.status === 'sent').length
  const errors  = sends.filter(s => s.status === 'error').length
  const opened  = sends.filter(s => s.opened_at  != null).length
  const clicked = sends.filter(s => s.clicked_at != null).length

  // Per-sequence stats — agora inclui opened/clicked + taxas
  const bySequence = sequences.map(seq => {
    const s = sends.filter(e => e.sequence_id === seq.id)
    const seqSent    = s.filter(e => e.status === 'sent').length
    const seqOpened  = s.filter(e => e.opened_at  != null).length
    const seqClicked = s.filter(e => e.clicked_at != null).length
    return {
      id: seq.id,
      name: seq.name,
      delay_days: seq.delay_days,
      delay_minutes: seq.delay_minutes ?? 0,
      audience: seq.audience ?? 'no_purchase',
      anchor_event: seq.anchor_event ?? 'lead_created',
      enabled: seq.enabled,
      sent:    seqSent,
      errors:  s.filter(e => e.status === 'error').length,
      opened:  seqOpened,
      clicked: seqClicked,
      openRate:  seqSent > 0 ? Math.round((seqOpened  / seqSent) * 100) : 0,
      clickRate: seqSent > 0 ? Math.round((seqClicked / seqSent) * 100) : 0,
    }
  })

  // Last 7 days daily sends
  const now = Date.now()
  const daily: Record<string, number> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 86400000)
    const key = d.toISOString().slice(0, 10)
    daily[key] = 0
  }
  for (const s of sends) {
    const key = s.sent_at?.slice(0, 10)
    if (key && key in daily) daily[key]++
  }

  const dailyArray = Object.entries(daily).map(([date, count]) => ({
    date,
    count,
    label: new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
  }))

  return NextResponse.json({
    total,
    sent,
    errors,
    opened,
    clicked,
    openRate:    sent > 0 ? Math.round((opened  / sent) * 100) : 0,
    clickRate:   sent > 0 ? Math.round((clicked / sent) * 100) : 0,
    ctor:        opened > 0 ? Math.round((clicked / opened) * 100) : 0,  // click-to-open
    totalLeads,
    bySequence,
    daily: dailyArray,
  })
}
