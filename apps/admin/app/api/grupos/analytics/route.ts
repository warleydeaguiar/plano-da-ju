import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/grupos/analytics?period=day|week|month
 * Retorna série temporal de entradas, saídas e cliques nos grupos.
 *
 * Usa RPCs SQL (get_grupo_activity_agg / get_grupo_clicks_agg) para agregar
 * no banco e evitar o limite de 1000 linhas do PostgREST.
 */
export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const period = req.nextUrl.searchParams.get('period') ?? 'day'

  const now = new Date()
  let points: string[]
  let labelFn: (d: Date) => string
  let keyFn: (bucket: string) => string   // bucket → point key

  if (period === 'month') {
    // Últimos 12 meses
    points = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    })
    labelFn = (d) => d.toLocaleString('pt-BR', { month: 'short' })
    keyFn = (bucket) => bucket.slice(0, 7)   // 'YYYY-MM-DD' → 'YYYY-MM'
  } else if (period === 'week') {
    // Últimas 12 semanas (começa na segunda)
    points = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now)
      d.setDate(d.getDate() - (11 - i) * 7)
      return isoWeek(d)
    })
    labelFn = (_) => ''
    keyFn = (bucket) => isoWeek(new Date(bucket + 'T12:00:00Z'))
  } else {
    // Últimos 30 dias
    points = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now)
      d.setDate(d.getDate() - (29 - i))
      return d.toISOString().slice(0, 10)
    })
    labelFn = (d) => `${d.getDate()}/${d.getMonth() + 1}`
    keyFn = (bucket) => bucket   // bucket já é 'YYYY-MM-DD'
  }

  // startIso: primeiro ponto
  const startIso = period === 'month'
    ? `${points[0]}-01T00:00:00Z`
    : `${points[0]}T00:00:00Z`

  // ── Busca agregada no banco via RPC (evita limite de 1000 linhas do PostgREST) ──
  const [activityRes, clicksRes] = await Promise.all([
    supabase.rpc('get_grupo_activity_agg', { start_ts: startIso } as any),
    supabase.rpc('get_grupo_clicks_agg',   { start_ts: startIso } as any),
  ])

  // Buckets
  const joinMap:  Record<string, number> = {}
  const leaveMap: Record<string, number> = {}
  const clickMap: Record<string, number> = {}
  points.forEach(p => { joinMap[p] = 0; leaveMap[p] = 0; clickMap[p] = 0 })

  for (const row of (activityRes.data ?? []) as any[]) {
    const key = keyFn(row.day_bucket as string)
    if (key in joinMap) {
      joinMap[key]  += Number(row.joins)  ?? 0
      leaveMap[key] += Number(row.leaves) ?? 0
    }
  }
  for (const row of (clicksRes.data ?? []) as any[]) {
    const key = keyFn(row.day_bucket as string)
    if (key in clickMap) clickMap[key] += Number(row.clicks) ?? 0
  }

  const labels: string[] = points.map(p => {
    if (period === 'week') {
      const d = mondayOfWeek(p)
      return `${d.getDate()}/${d.getMonth() + 1}`
    }
    if (period === 'month') {
      const [y, m] = p.split('-')
      return new Date(Number(y), Number(m) - 1, 1).toLocaleString('pt-BR', { month: 'short' })
    }
    return labelFn(new Date(p + 'T12:00:00'))
  })

  const series = points.map((p, i) => ({
    label:  labels[i],
    joins:  joinMap[p]  ?? 0,
    leaves: leaveMap[p] ?? 0,
    clicks: clickMap[p] ?? 0,
  }))

  return NextResponse.json(series)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isoWeek(d: Date): string {
  const date = new Date(d)
  const day = date.getDay() || 7
  date.setDate(date.getDate() - day + 1)
  return date.toISOString().slice(0, 10)
}

function mondayOfWeek(weekKey: string): Date {
  return new Date(weekKey + 'T12:00:00')
}
