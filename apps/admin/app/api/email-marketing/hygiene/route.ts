import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Higienização de lista por ENGAJAMENTO.
 *
 * Política (a "melhor forma"): só consideramos alguém "frio" depois de dar TEMPO
 * e CHANCE de interagir — precisa ter recebido pelo menos COLD_MIN_SENT emails e
 * o 1º envio ser de pelo menos COLD_MIN_AGE_DAYS atrás. Quem é novo/recebeu pouco
 * fica protegido ("dando tempo"). Quem nunca abriu/clicou nesse cenário vira
 * candidato a limpeza — idealmente após um email de reengajamento.
 *
 * Segmentos:
 *  - engajado:      abriu/clicou nos últimos ENGAGED_WINDOW_DAYS
 *  - esfriando:     já abriu algum dia, mas não nos últimos ENGAGED_WINDOW_DAYS
 *  - frio:          recebeu >= COLD_MIN_SENT, 1º envio >= COLD_MIN_AGE_DAYS, 0 aberturas/cliques
 *  - protegido:     recebeu pouco ou recente demais p/ julgar (dando tempo)
 *  - descadastrado: já saiu da lista (opt-out)
 *
 * GET  → contagens + amostras por segmento
 * POST { action:'suppress_cold', dry_run? } → move os 'frio' p/ a lista de opt-out
 */

const ENGAGED_WINDOW_DAYS = 60
const COLD_MIN_SENT = 4
const COLD_MIN_AGE_DAYS = 30

type Seg = 'engajado' | 'esfriando' | 'frio' | 'protegido' | 'descadastrado'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any

type EngStat = { sent: number; opened: number; clicked: number; lastEngaged: number | null; firstSent: number | null }

async function loadEngagement(sb: Sb): Promise<Map<string, EngStat>> {
  const map = new Map<string, EngStat>()
  const { data } = await sb.from('wg_email_sends')
    .select('to_email, opened_at, clicked_at, last_opened_at, last_clicked_at, sent_at')
    .eq('status', 'sent')
    .limit(100000)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (data ?? []) as any[]) {
    const e = (r.to_email ?? '').toLowerCase().trim()
    if (!e) continue
    const cur = map.get(e) ?? { sent: 0, opened: 0, clicked: 0, lastEngaged: null, firstSent: null }
    cur.sent++
    if (r.opened_at) cur.opened++
    if (r.clicked_at) cur.clicked++
    const sentT = r.sent_at ? new Date(r.sent_at).getTime() : null
    if (sentT && (cur.firstSent === null || sentT < cur.firstSent)) cur.firstSent = sentT
    const eng = Math.max(
      r.last_opened_at ? new Date(r.last_opened_at).getTime() : 0,
      r.last_clicked_at ? new Date(r.last_clicked_at).getTime() : 0,
      r.opened_at ? new Date(r.opened_at).getTime() : 0,
      r.clicked_at ? new Date(r.clicked_at).getTime() : 0,
    )
    if (eng > 0 && (cur.lastEngaged === null || eng > cur.lastEngaged)) cur.lastEngaged = eng
    map.set(e, cur)
  }
  return map
}

/** Universo da base: todos os emails de profiles + leads (dedup). */
async function loadBase(sb: Sb): Promise<Map<string, { email: string; name: string | null }>> {
  const map = new Map<string, { email: string; name: string | null }>()
  const [{ data: profiles }, { data: leads }] = await Promise.all([
    sb.from('profiles').select('email, full_name').not('email', 'is', null).limit(50000),
    sb.from('wg_quiz_leads').select('email, name').not('email', 'is', null).limit(50000),
  ])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const l of (leads ?? []) as any[]) { const e = (l.email || '').toLowerCase().trim(); if (e && !map.has(e)) map.set(e, { email: l.email, name: l.name ?? null }) }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const p of (profiles ?? []) as any[]) { const e = (p.email || '').toLowerCase().trim(); if (e) map.set(e, { email: p.email, name: p.full_name ?? null }) }
  return map
}

async function loadSuppressed(sb: Sb): Promise<Set<string>> {
  const { data } = await sb.from('wg_email_unsubscribes').select('email').limit(100000)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Set((data ?? []).map((r: any) => (r.email ?? '').toLowerCase().trim()))
}

function classify(stat: EngStat | undefined, suppressed: boolean): Seg {
  if (suppressed) return 'descadastrado'
  const now = Date.now()
  const engWindow = ENGAGED_WINDOW_DAYS * 86400000
  if (!stat || stat.sent < COLD_MIN_SENT) return 'protegido'
  if (stat.firstSent !== null && (now - stat.firstSent) < COLD_MIN_AGE_DAYS * 86400000) return 'protegido'
  if (stat.lastEngaged !== null) {
    return (now - stat.lastEngaged) <= engWindow ? 'engajado' : 'esfriando'
  }
  // recebeu o suficiente, tempo suficiente, nunca abriu/clicou
  return 'frio'
}

async function computeSegments(sb: Sb) {
  const [base, eng, supp] = await Promise.all([loadBase(sb), loadEngagement(sb), loadSuppressed(sb)])
  const segs: Record<Seg, Array<{ email: string; name: string | null; sent: number; opened: number; clicked: number }>> = {
    engajado: [], esfriando: [], frio: [], protegido: [], descadastrado: [],
  }
  for (const [email, info] of base) {
    const stat = eng.get(email)
    const seg = classify(stat, supp.has(email))
    segs[seg].push({
      email: info.email,
      name: info.name,
      sent: stat?.sent ?? 0,
      opened: stat?.opened ?? 0,
      clicked: stat?.clicked ?? 0,
    })
  }
  return segs
}

export async function GET() {
  const sb = createAdminClient()
  const segs = await computeSegments(sb)
  const counts = Object.fromEntries(Object.entries(segs).map(([k, v]) => [k, v.length]))
  const total = Object.values(segs).reduce((s, v) => s + v.length, 0)
  return NextResponse.json({
    ok: true,
    total,
    counts,
    params: { engaged_window_days: ENGAGED_WINDOW_DAYS, cold_min_sent: COLD_MIN_SENT, cold_min_age_days: COLD_MIN_AGE_DAYS },
    samples: {
      frio: segs.frio.slice(0, 50),
      esfriando: segs.esfriando.slice(0, 30),
      engajado: segs.engajado.slice(0, 10),
    },
  })
}

export async function POST(req: NextRequest) {
  const sb = createAdminClient()
  const body = await req.json().catch(() => ({}))
  const action = body?.action

  if (action !== 'suppress_cold') {
    return NextResponse.json({ error: 'action inválida' }, { status: 400 })
  }

  const segs = await computeSegments(sb)
  const cold = segs.frio

  if (body?.dry_run) {
    return NextResponse.json({ ok: true, dry_run: true, would_suppress: cold.length, sample: cold.slice(0, 20) })
  }

  let suppressed = 0
  const BATCH = 100
  for (let i = 0; i < cold.length; i += BATCH) {
    const rows = cold.slice(i, i + BATCH).map(c => ({
      email: c.email.toLowerCase().trim(),
      source: 'hygiene',
      reason: `nunca abriu após ${c.sent} envios`,
      created_at: new Date().toISOString(),
    }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb.from('wg_email_unsubscribes') as any).upsert(rows, { onConflict: 'email' })
    if (!error) suppressed += rows.length
  }

  return NextResponse.json({ ok: true, suppressed, total_cold: cold.length })
}
