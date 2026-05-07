import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/grupos/analytics?period=day|week|month
 * Retorna série temporal de entradas, saídas e cliques nos grupos.
 */
export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const period = req.nextUrl.searchParams.get('period') ?? 'day'

  const now = new Date()
  let points: string[]
  let labelFn: (d: Date) => string
  let keyFn: (iso: string) => string

  if (period === 'month') {
    // Últimos 12 meses
    points = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    })
    labelFn = (d) => d.toLocaleString('pt-BR', { month: 'short' })
    keyFn = (iso) => iso.slice(0, 7)  // 'YYYY-MM'
  } else if (period === 'week') {
    // Últimas 12 semanas (começa na segunda)
    points = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now)
      d.setDate(d.getDate() - (11 - i) * 7)
      return isoWeek(d)
    })
    labelFn = (_) => ''  // computed per point
    keyFn = (iso) => isoWeek(new Date(iso))
  } else {
    // Últimos 30 dias
    points = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now)
      d.setDate(d.getDate() - (29 - i))
      return d.toISOString().slice(0, 10)
    })
    labelFn = (d) => `${d.getDate()}/${d.getMonth() + 1}`
    keyFn = (iso) => iso.slice(0, 10)
  }

  // Calcula o range de datas
  const startIso = period === 'month'
    ? `${points[0]}-01T00:00:00Z`
    : `${points[0]}T00:00:00Z`

  const [eventsRes, clicksRes] = await Promise.all([
    supabase
      .from('wg_member_events' as any)
      .select('action, created_at')
      .gte('created_at', startIso),
    supabase
      .from('wg_redirect_clicks' as any)
      .select('created_at')
      .gte('created_at', startIso),
  ])

  // Buckets
  const joinMap: Record<string, number> = {}
  const leaveMap: Record<string, number> = {}
  const clickMap: Record<string, number> = {}
  points.forEach(p => { joinMap[p] = 0; leaveMap[p] = 0; clickMap[p] = 0 })

  for (const ev of (eventsRes.data ?? []) as any[]) {
    const key = keyFn(ev.created_at)
    if (key in joinMap) {
      if (ev.action === 'join')  joinMap[key]++
      if (ev.action === 'leave') leaveMap[key]++
    }
  }
  for (const cl of (clicksRes.data ?? []) as any[]) {
    const key = keyFn(cl.created_at)
    if (key in clickMap) clickMap[key]++
  }

  const labels: string[] = points.map(p => {
    if (period === 'week') {
      // Monday of that week
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
    label: labels[i],
    joins:  joinMap[p] ?? 0,
    leaves: leaveMap[p] ?? 0,
    clicks: clickMap[p] ?? 0,
  }))

  return NextResponse.json(series)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isoWeek(d: Date): string {
  const date = new Date(d)
  // set to Monday
  const day = date.getDay() || 7
  date.setDate(date.getDate() - day + 1)
  return date.toISOString().slice(0, 10)
}

function mondayOfWeek(weekKey: string): Date {
  return new Date(weekKey + 'T12:00:00')
}
