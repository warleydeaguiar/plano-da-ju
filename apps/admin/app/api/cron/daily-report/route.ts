import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getQuizAdSpend } from '@/lib/meta-ads-quiz'
import { fetchYberaOrders, salesOnDateBR, YBERA_COMMISSION_RATE } from '@/lib/ybera-api'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PLAN_PRICE = 34.90
const WEBHOOK = process.env.DISCORD_DAILY_REPORT_WEBHOOK ?? ''

/**
 * GET /api/cron/daily-report
 *
 * Roda diariamente às 10:30 BR (13:30 UTC) via Vercel Cron.
 * Envia 2 embeds no Discord:
 *  1. Plano da Ju (investimento / receita / lucro de ONTEM)
 *  2. Grupos Ybera (investimento / leads / CPL / vendas Ybera / comissão / lucro)
 *
 * Proteção: Vercel Cron adiciona header 'authorization: Bearer <CRON_SECRET>'
 * automaticamente quando configurado em settings. Aceitamos chamada sem
 * auth também pra permitir trigger manual.
 */
function brl(v: number): string {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function intStr(v: number): string {
  return v.toLocaleString('pt-BR')
}

async function sendToDiscord(payload: unknown): Promise<{ ok: boolean; error?: string }> {
  if (!WEBHOOK) return { ok: false, error: 'DISCORD_DAILY_REPORT_WEBHOOK not set' }
  try {
    const res = await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      return { ok: false, error: `Discord ${res.status}: ${txt.slice(0, 200)}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' }
  }
}

export async function GET(_req: NextRequest) {
  // Calcula "ontem" em horário de Brasília (UTC-3)
  const now = new Date()
  const brasiliaOffsetMs = 3 * 60 * 60 * 1000
  const brasiliaNow = new Date(now.getTime() - brasiliaOffsetMs)
  const yyyy = brasiliaNow.getUTCFullYear()
  const mm   = String(brasiliaNow.getUTCMonth() + 1).padStart(2, '0')
  const dd   = String(brasiliaNow.getUTCDate()).padStart(2, '0')
  // Meia-noite BR de hoje = 03:00 UTC de hoje
  const todayStartBR     = new Date(`${yyyy}-${mm}-${dd}T03:00:00.000Z`)
  const yesterdayStartBR = new Date(todayStartBR.getTime() - 86400_000)
  const yesterdayBR      = yesterdayStartBR.toISOString().slice(0, 10)
  const yesterdayLabel   = yesterdayStartBR.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

  const sb = createAdminClient()

  // Buscas em paralelo
  const [
    activeYestRes,
    groupJoinsYestRes,
    metaAds,
    yberaOrdersRes,
  ] = await Promise.all([
    // Vendas Plano ontem (subscription_activated_at em ontem BR)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('profiles') as any)
      .select('*', { count: 'exact', head: true })
      .eq('subscription_status', 'active')
      .gte('subscription_activated_at', yesterdayStartBR.toISOString())
      .lt('subscription_activated_at', todayStartBR.toISOString()),
    // Cadastros nos grupos ontem
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('wg_member_events') as any)
      .select('*', { count: 'exact', head: true })
      .eq('action', 'join')
      .gte('created_at', yesterdayStartBR.toISOString())
      .lt('created_at', todayStartBR.toISOString()),
    // Meta Ads (plano + grupos)
    getQuizAdSpend(),
    // Vendas Ybera de ontem — pega o dia inteiro com fetch específico
    fetchYberaOrders(yesterdayBR, yesterdayBR),
  ])

  // ── Plano da Ju ─────────────────────────────────────────────
  const salesYest      = activeYestRes.count ?? 0
  const revenueYest    = salesYest * PLAN_PRICE
  const planoSpendYest = metaAds.plano.yesterday
  const planoProfitYest = revenueYest - planoSpendYest
  const planoRoasYest   = planoSpendYest > 0 ? revenueYest / planoSpendYest : null

  // ── Grupos Ybera ────────────────────────────────────────────
  const joinsYest      = groupJoinsYestRes.count ?? 0
  const gruposSpendYest = metaAds.grupos.yesterday
  const cplYest = joinsYest > 0 ? gruposSpendYest / joinsYest : null

  const yberaOrders = yberaOrdersRes.orders ?? []
  const yberaSalesYest = yberaOrders.length > 0
    ? salesOnDateBR(yberaOrders, yesterdayBR)
    : 0
  const commissionYest = yberaSalesYest * YBERA_COMMISSION_RATE
  const gruposProfitYest = commissionYest - gruposSpendYest

  // ── Discord embeds ──────────────────────────────────────────
  const PINK = 0xEC4899
  const BLUE = 0x007AFF

  const profitColor = (v: number) => v >= 0 ? 0x34C759 : 0xFF3B30

  const payload = {
    username: 'Relatório Diário — Plano da Ju',
    content: `📊 **Relatório de ${yesterdayLabel}**`,
    embeds: [
      {
        title: '💇‍♀️ Plano Capilar',
        color: PINK,
        fields: [
          { name: '💸 Investimento',  value: brl(planoSpendYest), inline: true },
          { name: '💰 Receita',        value: `${brl(revenueYest)} (${salesYest} venda${salesYest !== 1 ? 's' : ''})`, inline: true },
          { name: planoProfitYest >= 0 ? '📈 Lucro' : '📉 Prejuízo', value: brl(planoProfitYest), inline: true },
          ...(planoRoasYest !== null ? [{ name: '📊 ROAS', value: `${planoRoasYest.toFixed(2)}x`, inline: true }] : []),
        ],
      },
      {
        title: '📱 Grupos de Promoção (Ybera)',
        color: BLUE,
        fields: [
          { name: '💸 Investimento',  value: brl(gruposSpendYest), inline: true },
          { name: '👥 Leads',          value: intStr(joinsYest), inline: true },
          { name: '🎯 Custo/lead',     value: cplYest !== null ? brl(cplYest) : '—', inline: true },
          { name: '🛍️ Vendas Ybera',  value: brl(yberaSalesYest), inline: true },
          { name: '🤝 Comissão (20%)', value: brl(commissionYest), inline: true },
          { name: gruposProfitYest >= 0 ? '📈 Lucro' : '📉 Prejuízo', value: brl(gruposProfitYest), inline: true },
        ],
      },
    ],
    // Cores cumulativas no embed inteiro vão pelo primeiro embed; visualmente
    // OK pra Discord. Cor única no top-level pra destaque do lucro:
    color: profitColor(planoProfitYest + gruposProfitYest),
  }

  const result = await sendToDiscord(payload)

  return NextResponse.json({
    ok: result.ok,
    sent_at: new Date().toISOString(),
    error: result.error,
    yesterday: yesterdayBR,
    summary: {
      plano: { investimento: planoSpendYest, receita: revenueYest, lucro: planoProfitYest, vendas: salesYest },
      grupos: { investimento: gruposSpendYest, leads: joinsYest, vendas_ybera: yberaSalesYest, comissao: commissionYest, lucro: gruposProfitYest },
    },
  })
}
