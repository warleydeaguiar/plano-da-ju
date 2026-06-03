import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * Conta linhas via count=exact + head:true (NÃO traz as linhas).
 *
 * ⚠️ Por que não dá pra fazer `.select(...)` e contar em JS:
 *    o PostgREST corta em db-max-rows (1000) por request. Com 1000+ envios,
 *    contar em JS dava números travados em 1000 e taxas erradas — e quebraria
 *    de vez quando a base crescer (70k+). count=exact é resolvido no Postgres
 *    e não sofre esse limite.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function countRows(query: any): Promise<number> {
  const { count, error } = await query
  if (error) return 0
  return count ?? 0
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sendsCount(sb: any) {
  return sb.from('wg_email_sends').select('*', { count: 'exact', head: true })
}

// GET /api/email-marketing/metrics
export async function GET() {
  const sb = createAdminClient()

  // Sequências (tabela pequena — pode trazer as linhas)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: seqData } = await (sb as any)
    .from('wg_email_sequences')
    .select('id, name, delay_days, delay_minutes, audience, anchor_event, enabled')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sequences: any[] = seqData ?? []

  // ── Totais globais (via count, sem cap de 1000) ──────────────
  const [total, sent, errors, opened, clicked, totalLeads] = await Promise.all([
    countRows(sendsCount(sb)),
    countRows(sendsCount(sb).eq('status', 'sent')),
    countRows(sendsCount(sb).eq('status', 'error')),
    countRows(sendsCount(sb).not('opened_at', 'is', null)),
    countRows(sendsCount(sb).not('clicked_at', 'is', null)),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    countRows((sb as any).from('wg_quiz_leads').select('*', { count: 'exact', head: true })),
  ])

  // ── Por sequência (counts filtrados por sequence_id) ─────────
  const bySequence = await Promise.all(
    sequences.map(async seq => {
      const [seqSent, seqOpened, seqClicked, seqErrors] = await Promise.all([
        countRows(sendsCount(sb).eq('sequence_id', seq.id).eq('status', 'sent')),
        countRows(sendsCount(sb).eq('sequence_id', seq.id).not('opened_at', 'is', null)),
        countRows(sendsCount(sb).eq('sequence_id', seq.id).not('clicked_at', 'is', null)),
        countRows(sendsCount(sb).eq('sequence_id', seq.id).eq('status', 'error')),
      ])
      return {
        id: seq.id,
        name: seq.name,
        delay_days: seq.delay_days,
        delay_minutes: seq.delay_minutes ?? 0,
        audience: seq.audience ?? 'no_purchase',
        anchor_event: seq.anchor_event ?? 'lead_created',
        enabled: seq.enabled,
        sent: seqSent,
        errors: seqErrors,
        opened: seqOpened,
        clicked: seqClicked,
        openRate:  seqSent > 0 ? Math.round((seqOpened  / seqSent) * 100) : 0,
        clickRate: seqSent > 0 ? Math.round((seqClicked / seqSent) * 100) : 0,
      }
    })
  )

  // ── Envios nos últimos 7 dias (count por janela de dia, UTC) ──
  const now = Date.now()
  const dayKeys: string[] = []
  for (let i = 6; i >= 0; i--) {
    dayKeys.push(new Date(now - i * 86400000).toISOString().slice(0, 10))
  }
  const dailyCounts = await Promise.all(
    dayKeys.map(key => {
      const next = new Date(new Date(key + 'T00:00:00Z').getTime() + 86400000)
        .toISOString().slice(0, 10)
      return countRows(sendsCount(sb).gte('sent_at', key).lt('sent_at', next))
    })
  )
  const dailyArray = dayKeys.map((date, i) => ({
    date,
    count: dailyCounts[i],
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
