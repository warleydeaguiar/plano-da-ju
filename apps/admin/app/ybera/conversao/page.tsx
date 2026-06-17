import { createAdminClient } from '@/lib/supabase'
import Sidebar from '../../components/Sidebar'
import ConversaoClient from './ConversaoClient'
import {
  matchOrdersToProfiles, aggregateNonStudents, buildProfileKeySet, isAluno,
  normEmail, normPhoneKey, topProductsOf,
  type MatchOrder, type MatchProfile,
} from '@/lib/ybera-match'
import { YBERA_COMMISSION_RATE } from '@/lib/ybera-api'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Conversão Ybera — Admin Plano da Ju' }

const DAY = 86400000

// Carrega TODOS os pedidos Ybera (paginado — PostgREST limita 1000/req)
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

function ym(iso: string | null): string {
  return iso ? iso.slice(0, 7) : '—'
}

async function getData() {
  const sb = createAdminClient()
  const orders = await loadAllOrders()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profRows } = await (sb.from('profiles') as any)
    .select('id, email, phone, full_name, subscription_status, created_at')
    .limit(100000)
  const allProfiles = (profRows ?? []) as MatchProfile[]
  const activeProfiles = allProfiles.filter(p => p.subscription_status === 'active')

  // Leads fashion-gold (atribuição do canal grupos)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: fgRows } = await (sb.from('wg_quiz_leads') as any)
    .select('email, phone').eq('quiz_slug', 'fashion-gold').limit(100000)
  const fgKeys = buildProfileKeySet((fgRows ?? []).map((r: { email: string|null; phone: string|null }) => ({
    id: '', email: r.email, phone: r.phone, full_name: null, subscription_status: null, created_at: null,
  })))

  // ── Plano → Ybera ──
  const matches = matchOrdersToProfiles(orders, activeProfiles)
  const studentBuyers = matches.filter(m => m.bought)
  const activeCount = activeProfiles.length
  const planoRevenue = studentBuyers.reduce((s, m) => s + m.totalSpent, 0)
  const planoOrders = studentBuyers.reduce((s, m) => s + m.orders, 0)
  const repeatStudents = studentBuyers.filter(m => m.orders >= 2).length
  // tempo até a 1ª compra (aprox.: created_at do profile → 1ª compra Ybera)
  const ttf: number[] = []
  for (const m of studentBuyers) {
    if (m.firstPurchase && m.profile.created_at) {
      const d = (new Date(m.firstPurchase).getTime() - new Date(m.profile.created_at).getTime()) / DAY
      if (d >= 0 && d < 730) ttf.push(d)
    }
  }
  const avgDaysToFirst = ttf.length ? Math.round(ttf.reduce((a, b) => a + b, 0) / ttf.length) : null

  // cohorts por mês de entrada (created_at)
  const cohortMap = new Map<string, { active: number; buyers: number }>()
  for (const m of matches) {
    const k = ym(m.profile.created_at)
    const c = cohortMap.get(k) ?? { active: 0, buyers: 0 }
    c.active += 1; if (m.bought) c.buyers += 1
    cohortMap.set(k, c)
  }
  const cohorts = [...cohortMap.entries()]
    .filter(([k]) => k !== '—')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ymk, c]) => ({ ym: ymk, active: c.active, buyers: c.buyers, conv: c.active ? c.buyers / c.active : 0 }))

  // produtos comprados por alunas (filtra pedidos das alunas)
  const studentKeys = buildProfileKeySet(activeProfiles)
  const studentOrders = orders.filter(o => isAluno(o, studentKeys))
  const planoTopProducts = topProductsOf(studentOrders, 8)

  // ── Grupos / outros (não-alunas, exclui QUALQUER profile) ──
  const nonStudents = aggregateNonStudents(orders, allProfiles)
  const gruposRevenue = nonStudents.reduce((s, c) => s + c.totalSpent, 0)
  const gruposOrders = nonStudents.reduce((s, c) => s + c.orders, 0)
  const gruposRepeat = nonStudents.filter(c => c.orders >= 2).length
  const allKeys = buildProfileKeySet(allProfiles)
  const nonStudentOrders = orders.filter(o => !isAluno(o, allKeys))
  const gruposTopProducts = topProductsOf(nonStudentOrders, 8)
  // distribuição de recorrência
  const dist = { '1': 0, '2': 0, '3': 0, '4+': 0 }
  for (const c of nonStudents) {
    if (c.orders === 1) dist['1']++
    else if (c.orders === 2) dist['2']++
    else if (c.orders === 3) dist['3']++
    else dist['4+']++
  }
  // quantos compradores não-alunas vieram do quiz fashion-gold
  const fgMatched = nonStudents.filter(c =>
    (c.email && fgKeys.emails.has(normEmail(c.email))) || (c.phone && fgKeys.phones.has(normPhoneKey(c.phone)))
  ).length

  // tendência mensal (não-alunas) — últimos 12 meses
  const monMap = new Map<string, { orders: number; revenue: number }>()
  for (const o of nonStudentOrders) {
    const k = ym(o.register_date)
    const e = monMap.get(k) ?? { orders: 0, revenue: 0 }
    e.orders += 1; e.revenue += o.subtotal ?? 0
    monMap.set(k, e)
  }
  const gruposMonthly = [...monMap.entries()].filter(([k]) => k !== '—')
    .sort(([a], [b]) => a.localeCompare(b)).slice(-12)
    .map(([ymk, v]) => ({ ym: ymk, ...v }))

  // ── Overview ──
  const totalRevenue = orders.reduce((s, o) => s + (o.subtotal ?? 0), 0)
  const totalBuyers = studentBuyers.length + nonStudents.length
  const repeatOverall = studentBuyers.length + nonStudents.length > 0
    ? (repeatStudents + gruposRepeat) / (studentBuyers.length + nonStudents.length) : 0

  // tabela de alunas (compradoras primeiro, por valor gasto)
  const studentRows = matches
    .map(m => ({
      id: m.profile.id,
      name: m.profile.full_name ?? '—',
      email: m.profile.email ?? '',
      bought: m.bought,
      orders: m.orders,
      totalSpent: m.totalSpent,
      lastPurchase: m.lastPurchase,
      matchType: m.matchType,
      products: m.products,
    }))
    .sort((a, b) => (Number(b.bought) - Number(a.bought)) || (b.totalSpent - a.totalSpent))

  return {
    hasOrders: orders.length > 0,
    overview: {
      totalOrders: orders.length, totalRevenue, commission: totalRevenue * YBERA_COMMISSION_RATE,
      totalBuyers, studentBuyers: studentBuyers.length, nonStudentBuyers: nonStudents.length,
      repeatOverall,
    },
    plano: {
      activeCount, buyers: studentBuyers.length,
      conversion: activeCount ? studentBuyers.length / activeCount : 0,
      revenue: planoRevenue,
      avgTicket: planoOrders ? planoRevenue / planoOrders : 0,
      avgOrdersPerBuyer: studentBuyers.length ? planoOrders / studentBuyers.length : 0,
      avgDaysToFirst, repeatRate: studentBuyers.length ? repeatStudents / studentBuyers.length : 0,
      topProducts: planoTopProducts, cohorts,
    },
    grupos: {
      buyers: nonStudents.length, revenue: gruposRevenue,
      avgTicket: gruposOrders ? gruposRevenue / gruposOrders : 0,
      avgOrdersPerBuyer: nonStudents.length ? gruposOrders / nonStudents.length : 0,
      repeatRate: nonStudents.length ? gruposRepeat / nonStudents.length : 0,
      dist, topProducts: gruposTopProducts, fgMatched, monthly: gruposMonthly,
    },
    studentRows,
  }
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
