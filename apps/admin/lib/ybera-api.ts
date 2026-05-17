/**
 * Ybera Club — External API integration
 * Endpoint: https://api-prod.yberaclub.com/api/external/order/list
 * Auth: Bearer JWT (ExternalAPI role) stored in YBERA_API_TOKEN
 */

const YBERA_BASE = 'https://api-prod.yberaclub.com'

export interface YberaProduct {
  originProductId: string
  sku: string
  name: string
  quantity: number
  value: number
  total: number
}

export interface YberaOrder {
  id: string
  originId: string
  customer: {
    id: string
    name: string
    email: string
    phone: string | null
  }
  total: number
  subtotal: number
  shippingValue: number
  registerDate: string // ISO 8601
  influencerID: string
  influencerName: string
  products: YberaProduct[]
}

export interface YberaOrdersResult {
  status: 'ok' | 'no_token' | 'error'
  orders: YberaOrder[]
  error?: string
}

/**
 * Fetch all orders for a date range (auto-paginates up to 10 pages = 1000 orders)
 */
export async function fetchYberaOrders(
  start: string,
  end: string,
): Promise<YberaOrdersResult> {
  const token = process.env.YBERA_API_TOKEN
  if (!token) return { status: 'no_token', orders: [] }

  try {
    const allOrders: YberaOrder[] = []
    let page = 1

    while (page <= 10) {
      const url = `${YBERA_BASE}/api/external/order/list?page=${page}&start=${start}&end=${end}`
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        next: { revalidate: 300 }, // cache 5 min
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const json = await res.json()
      if (!json.success) throw new Error('API returned success=false')

      const orders: YberaOrder[] = json.data?.orders ?? []
      allOrders.push(...orders)

      // Stop when we get fewer than 100 (last page)
      if (orders.length < 100) break
      page++
    }

    return { status: 'ok', orders: allOrders }
  } catch (err) {
    console.error('[ybera-api]', err)
    return { status: 'error', orders: [], error: String(err) }
  }
}

/** Fetch current month orders */
export async function fetchCurrentMonthOrders(): Promise<YberaOrdersResult> {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return fetchYberaOrders(`${y}-${m}-01`, `${y}-${m}-${d}`)
}

/** Group orders by YYYY-MM and compute monthly totals */
export interface MonthlyYberaSales {
  yearMonth: string
  orders: number
  subtotal: number
  topProducts: { name: string; qty: number; revenue: number }[]
}

export function groupByMonth(orders: YberaOrder[]): MonthlyYberaSales[] {
  const map = new Map<string, { orders: YberaOrder[] }>()

  for (const o of orders) {
    const ym = o.registerDate.slice(0, 7)
    if (!map.has(ym)) map.set(ym, { orders: [] })
    map.get(ym)!.orders.push(o)
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([yearMonth, { orders }]) => {
      const subtotal = orders.reduce((s, o) => s + (o.subtotal ?? 0), 0)

      // Top products
      const prodMap = new Map<string, { qty: number; revenue: number }>()
      for (const o of orders) {
        for (const p of o.products) {
          if (!p.value || p.value === 0) continue // skip freebies
          const existing = prodMap.get(p.name) ?? { qty: 0, revenue: 0 }
          existing.qty += p.quantity
          existing.revenue += p.total
          prodMap.set(p.name, existing)
        }
      }
      const topProducts = Array.from(prodMap.entries())
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)

      return { yearMonth, orders: orders.length, subtotal, topProducts }
    })
}
