import { createAdminClient } from '@/lib/supabase'
import Sidebar from '../../components/Sidebar'
import ConversaoClient from './ConversaoClient'
import {
  matchOrdersToProfiles, aggregateNonStudents, buildProfileKeySet, isAluno, topProductsOf,
  type MatchOrder, type MatchProfile,
} from '@/lib/ybera-match'
import { YBERA_COMMISSION_RATE } from '@/lib/ybera-api'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Conversão Ybera — Admin Plano da Ju' }

const DAY = 86400000
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const ymLabel = (ym: string) => { const [y, m] = ym.split('-'); return `${MES[Number(m) - 1]}/${y}` }
const ym = (iso: string | null) => (iso ? iso.slice(0, 7) : '—')

async function loadAllOrders(): Promise<MatchOrder[]> {
  const sb = createAdminClient()
  const out: MatchOrder[] = []
  for (let page = 0; page < 50; page++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.from('ybera_orders') as any)
      .select('id, subtotal, total, register_date, customer_email, customer_phone, customer_name, products')
      .order('register_date', { ascending: true })
      .range(page * 1000, page * 1000 + 999)
    if (error || !data || data.length === 0) break
    out.push(...(data as MatchOrder[]))
    if (data.length < 1000) break
  }
  return out
}

// Bundle de métricas para um conjunto de pedidos (escopo = todo período ou 1 mês)
function buildBundle(
  scopeOrders: MatchOrder[],
  activeProfiles: MatchProfile[],
  allProfiles: MatchProfile[],
  studentKeys: ReturnType<typeof buildProfileKeySet>,
  allKeys: ReturnType<typeof buildProfileKeySet>,
  includeNonBuyers: boolean,
) {
  const activeCount = activeProfiles.length
  const matches = matchOrdersToProfiles(scopeOrders, activeProfiles)
  const studentBuyers = matches.filter(m => m.bought)
  const planoRevenue = studentBuyers.reduce((s, m) => s + m.totalSpent, 0)
  const planoOrders = studentBuyers.reduce((s, m) => s + m.orders, 0)
  const studentOrders = scopeOrders.filter(o => isAluno(o, studentKeys))

  const nonStudents = aggregateNonStudents(scopeOrders, allProfiles)
  const gruposRevenue = nonStudents.reduce((s, c) => s + c.totalSpent, 0)
  const gruposOrders = nonStudents.reduce((s, c) => s + c.orders, 0)
  const nonStudentOrders = scopeOrders.filter(o => !isAluno(o, allKeys))
  const totalRevenue = scopeOrders.reduce((s, o) => s + (o.subtotal ?? 0), 0)

  const rows = matches
    .filter(m => includeNonBuyers || m.bought)
    .map(m => ({
      id: m.profile.id, name: m.profile.full_name ?? '—', email: m.profile.email ?? '',
      bought: m.bought, orders: m.orders, totalSpent: m.totalSpent,
      lastPurchase: m.lastPurchase, matchType: m.matchType, products: m.products,
    }))
    .sort((a, b) => (Number(b.bought) - Number(a.bought)) || (b.totalSpent - a.totalSpent))

  return {
    overview: {
      totalOrders: scopeOrders.length, totalRevenue, commission: totalRevenue * YBERA_COMMISSION_RATE,
      totalBuyers: studentBuyers.length + nonStudents.length,
      studentBuyers: studentBuyers.length, nonStudentBuyers: nonStudents.length,
    },
    plano: {
      activeCount, buyers: studentBuyers.length,
      conversion: activeCount ? studentBuyers.length / activeCount : 0,
      revenue: planoRevenue, avgTicket: planoOrders ? planoRevenue / planoOrders : 0,
      avgOrdersPerBuyer: studentBuyers.length ? planoOrders / studentBuyers.length : 0,
      topProducts: topProductsOf(studentOrders, 8),
    },
    grupos: {
      buyers: nonStudents.length, revenue: gruposRevenue,
      avgTicket: gruposOrders ? gruposRevenue / gruposOrders : 0,
      avgOrdersPerBuyer: nonStudents.length ? gruposOrders / nonStudents.length : 0,
      topProducts: topProductsOf(nonStudentOrders, 8),
    },
    studentRows: rows,
  }
}

async function getData() {
  const sb = createAdminClient()
  const orders = await loadAllOrders()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profRows } = await (sb.from('profiles') as any)
    .select('id, email, phone, full_name, subscription_status, created_at').limit(100000)
  const allProfiles = (profRows ?? []) as MatchProfile[]
  const activeProfiles = allProfiles.filter(p => p.subscription_status === 'active')
  const studentKeys = buildProfileKeySet(activeProfiles)
  const allKeys = buildProfileKeySet(allProfiles)

  if (orders.length === 0) {
    return { hasOrders: false, activeCount: activeProfiles.length, months: [], periods: {}, trend: [], lifetime: null }
  }

  // Meses presentes (asc) e bundles por mês
  const monthSet = Array.from(new Set(orders.map(o => ym(o.register_date)).filter(k => k !== '—'))).sort()
  const ordersByMonth = new Map<string, MatchOrder[]>()
  for (const o of orders) { const k = ym(o.register_date); if (k === '—') continue; (ordersByMonth.get(k) ?? ordersByMonth.set(k, []).get(k)!).push(o) }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const periods: Record<string, any> = {
    all: buildBundle(orders, activeProfiles, allProfiles, studentKeys, allKeys, true),
  }
  for (const k of monthSet) {
    periods[k] = buildBundle(ordersByMonth.get(k) ?? [], activeProfiles, allProfiles, studentKeys, allKeys, false)
  }

  // Trend (asc) — usa os bundles mensais
  const trend = monthSet.map(k => ({
    ym: k, label: ymLabel(k),
    studentBuyers: periods[k].plano.buyers,
    studentRevenue: periods[k].plano.revenue,
    conversion: periods[k].plano.conversion,
    gruposBuyers: periods[k].grupos.buyers,
    gruposRevenue: periods[k].grupos.revenue,
  }))

  // Seletor de meses (desc, mais recente primeiro)
  const months = [...monthSet].reverse().map(k => ({ key: k, label: ymLabel(k) }))

  // Métricas lifetime (só fazem sentido no "todo período")
  const matchesAll = matchOrdersToProfiles(orders, activeProfiles)
  const studentBuyersAll = matchesAll.filter(m => m.bought)
  const ttf: number[] = []
  for (const m of studentBuyersAll) {
    if (m.firstPurchase && m.profile.created_at) {
      const d = (new Date(m.firstPurchase).getTime() - new Date(m.profile.created_at).getTime()) / DAY
      if (d >= 0 && d < 730) ttf.push(d)
    }
  }
  const cohortMap = new Map<string, { active: number; buyers: number }>()
  for (const m of matchesAll) {
    const k = ym(m.profile.created_at); if (k === '—') continue
    const c = cohortMap.get(k) ?? { active: 0, buyers: 0 }
    c.active += 1; if (m.bought) c.buyers += 1; cohortMap.set(k, c)
  }
  const nonStudentsAll = aggregateNonStudents(orders, allProfiles)
  const lifetime = {
    avgDaysToFirst: ttf.length ? Math.round(ttf.reduce((a, b) => a + b, 0) / ttf.length) : null,
    repeatRate: studentBuyersAll.length ? studentBuyersAll.filter(m => m.orders >= 2).length / studentBuyersAll.length : 0,
    cohorts: [...cohortMap.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([k, c]) => ({ ym: k, label: ymLabel(k), active: c.active, buyers: c.buyers, conv: c.active ? c.buyers / c.active : 0 })),
    gruposRepeatRate: nonStudentsAll.length ? nonStudentsAll.filter(c => c.orders >= 2).length / nonStudentsAll.length : 0,
  }

  return { hasOrders: true, activeCount: activeProfiles.length, months, periods, trend, lifetime }
}

export default async function ConversaoPage() {
  const data = await getData()
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#FFFAF5', fontFamily: 'Plus Jakarta Sans, -apple-system, system-ui, sans-serif' }}>
      <Sidebar />
      <main style={{ marginLeft: 234, flex: 1, height: '100vh', overflowY: 'auto', padding: '32px 40px' }}>
        <ConversaoClient data={data} />
      </main>
    </div>
  )
}
