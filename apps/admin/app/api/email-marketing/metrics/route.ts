import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/email-marketing/metrics
export async function GET() {
  const sb = createAdminClient()

  const [sendsResult, seqResult, leadsResult] = await Promise.all([
    (sb as any).from('wg_email_sends').select('status, sequence_id, sent_at, opened_at'),
    (sb as any).from('wg_email_sequences').select('id, name, delay_days, enabled'),
    (sb as any).from('wg_quiz_leads').select('id, email', { count: 'exact', head: true }),
  ])

  const sends: any[] = sendsResult.data ?? []
  const sequences: any[] = seqResult.data ?? []
  const totalLeads = leadsResult.count ?? 0

  const total = sends.length
  const sent = sends.filter(s => s.status === 'sent').length
  const errors = sends.filter(s => s.status === 'error').length
  const opened = sends.filter(s => s.opened_at != null).length

  // Per-sequence stats
  const bySequence = sequences.map(seq => {
    const s = sends.filter(e => e.sequence_id === seq.id)
    return {
      id: seq.id,
      name: seq.name,
      delay_days: seq.delay_days,
      enabled: seq.enabled,
      sent: s.filter(e => e.status === 'sent').length,
      errors: s.filter(e => e.status === 'error').length,
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
    openRate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
    totalLeads,
    bySequence,
    daily: dailyArray,
  })
}
