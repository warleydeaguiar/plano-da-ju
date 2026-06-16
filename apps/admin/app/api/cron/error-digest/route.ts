import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/cron/error-digest   (Authorization: Bearer CRON_SECRET)
 *
 * Revisão periódica de erros. Usa um "watermark" (error_review_state) — só olha
 * os erros NOVOS desde a última revisão, posta um resumo amigável no Discord e
 * avança o marco. Assim, erros já corrigidos param de aparecer naturalmente
 * (sem apagar o histórico). ?dry=1 → não posta nem avança (pra testar).
 */
const WEBHOOK = process.env.DISCORD_ERRORS_WEBHOOK
  || 'https://discord.com/api/webhooks/1506986071236542625/nplexcvCuV2ZZP_uQuLWRKrzX2AeBe4E52j573i4WXJGkxy4VaSNFiFFsJItiXAgtADO'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function groupBy<T>(rows: T[], keyFn: (r: T) => string): { key: string; count: number }[] {
  const m = new Map<string, number>()
  for (const r of rows) { const k = keyFn(r); m.set(k, (m.get(k) ?? 0) + 1) }
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count)
}

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (expected && req.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const dry = req.nextUrl.searchParams.get('dry') === '1'
  const sb = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: state } = await (sb.from('error_review_state') as any)
    .select('last_reviewed_at').eq('source', 'global').maybeSingle()
  const since = state?.last_reviewed_at ?? new Date(Date.now() - 3 * 86400000).toISOString()
  const now = new Date().toISOString()
  const days = Math.max(1, Math.round((Date.now() - new Date(since).getTime()) / 86400000))

  // Erros do sistema (app_errors)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sysRows } = await (sb.from('app_errors') as any)
    .select('route, severity, message').gt('created_at', since).limit(3000)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sys = (sysRows ?? []) as any[]
  const sysGroups = groupBy(sys, r => `${r.route} — ${String(r.message ?? '').slice(0, 70)}`)
  const sysCritical = sys.filter(r => r.severity === 'critical').length

  // Erros de checkout (checkout_events)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: coRows } = await (sb.from('checkout_events') as any)
    .select('payment_type, metadata').eq('event_type', 'checkout_error').gt('created_at', since).limit(3000)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const co = (coRows ?? []) as any[]
  const coGroups = groupBy(co, r => `${r.payment_type ?? '?'}/${r.metadata?.kind ?? '?'} — ${String(r.metadata?.message ?? '').slice(0, 60)}`)

  // Heurística simples de "precisa de atenção": grupos com 3+ ocorrências ou erro crítico.
  const attention = [...sysGroups, ...coGroups].filter(g => g.count >= 3)
  const needsAttention = attention.length > 0 || sysCritical > 0
  const totalNew = sys.length + co.length

  const fmt = (groups: { key: string; count: number }[]) =>
    groups.slice(0, 8).map(g => `• ${g.key} — **${g.count}x**`).join('\n') || '— nenhum'

  const embed = {
    title: totalNew === 0 ? '✅ Checkup do sistema — tudo limpo' : '🩺 Checkup do sistema — erros novos',
    color: needsAttention ? 15158332 : (totalNew === 0 ? 3066993 : 16769305),
    description: totalNew === 0
      ? `Nenhum erro novo nos últimos ${days} dia(s). 🎉`
      : `Erros novos nos últimos ${days} dia(s): **${co.length}** no checkout · **${sys.length}** internos.`
        + (needsAttention ? '\n\n⚠️ **Alguns parecem precisar de atenção** (3+ ocorrências ou crítico) — vale pedir pro Claude conferir.' : '\n\nVolumes baixos/isolados — provavelmente nada urgente.'),
    fields: totalNew === 0 ? [] : [
      { name: '🛒 Checkout', value: fmt(coGroups).slice(0, 1020) },
      { name: '⚙️ Sistema', value: fmt(sysGroups).slice(0, 1020) },
    ],
    footer: { text: 'Plano da Ju • Revisão de erros (a cada 3 dias)' },
  }

  if (!dry) {
    try {
      await fetch(WEBHOOK, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] }),
      })
    } catch (e) { console.error('[error-digest] discord falhou', e) }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb.from('error_review_state') as any)
      .update({ last_reviewed_at: now }).eq('source', 'global')
  }

  return NextResponse.json({
    ok: true, dry, since, days,
    checkout_new: co.length, system_new: sys.length, needs_attention: needsAttention,
    top_checkout: coGroups.slice(0, 8), top_system: sysGroups.slice(0, 8),
  })
}
