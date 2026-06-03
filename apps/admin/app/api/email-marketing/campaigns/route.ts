import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * Conta linhas via count=exact + head:true (resolvido no Postgres, sem o cap
 * de 1000 do PostgREST). Um broadcast pode ter 70k linhas em wg_email_sends,
 * então contar em JS quebraria.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function countRows(query: any): Promise<number> {
  const { count, error } = await query
  if (error) return 0
  return count ?? 0
}

// GET /api/email-marketing/campaigns
// Histórico de broadcasts: cada campanha + resultado (enviados/abertos/clicados).
export async function GET() {
  const sb = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: campaigns } = await (sb as any)
    .from('wg_email_campaigns')
    .select('campaign_id, subject, message, image_url, audience_label, recipients_total, sent, errors, skipped, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list: any[] = campaigns ?? []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sendsCount = (q: any) => sb.from('wg_email_sends').select('*', { count: 'exact', head: true })

  const enriched = await Promise.all(
    list.map(async c => {
      const [sent, opened, clicked, errors] = await Promise.all([
        countRows(sendsCount(sb).eq('campaign_id', c.campaign_id).eq('status', 'sent')),
        countRows(sendsCount(sb).eq('campaign_id', c.campaign_id).not('opened_at', 'is', null)),
        countRows(sendsCount(sb).eq('campaign_id', c.campaign_id).not('clicked_at', 'is', null)),
        countRows(sendsCount(sb).eq('campaign_id', c.campaign_id).eq('status', 'error')),
      ])
      // Usa o count ao vivo de wg_email_sends (mais confiável que o snapshot
      // salvo na hora do envio, pois aberturas/cliques chegam depois).
      const sentFinal = sent || c.sent || 0
      return {
        campaign_id: c.campaign_id,
        subject: c.subject,
        message: c.message,
        image_url: c.image_url,
        audience_label: c.audience_label,
        recipients_total: c.recipients_total,
        created_at: c.created_at,
        sent: sentFinal,
        errors: errors || c.errors || 0,
        skipped: c.skipped || 0,
        opened,
        clicked,
        openRate:  sentFinal > 0 ? Math.round((opened  / sentFinal) * 100) : 0,
        clickRate: sentFinal > 0 ? Math.round((clicked / sentFinal) * 100) : 0,
      }
    })
  )

  return NextResponse.json({ campaigns: enriched })
}
