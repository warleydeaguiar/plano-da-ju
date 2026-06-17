/**
 * Cruzamento de pedidos Ybera com nossas bases (profiles / leads).
 * Match por EMAIL (primário) ou TELEFONE (chave robusta), nome só como apoio.
 * Funções puras — recebem dados já carregados, sem dependência de framework.
 */

// ── Normalização ──────────────────────────────────────────────────────────────
export function normEmail(s?: string | null): string {
  return (s ?? '').trim().toLowerCase()
}

/**
 * Chave de telefone robusta a variações (código país + 9º dígito).
 * Ex.: '+55 (92) 99205-8301' / '92992058301' / '5592992058301' → '9292058301'
 * (DDD + 8 dígitos do assinante; remove o 9 do celular). Retorna '' se fraca.
 */
export function normPhoneKey(s?: string | null): string {
  let d = (s ?? '').replace(/\D/g, '')
  if (d.startsWith('55') && d.length > 11) d = d.slice(2)       // tira código país
  if (d.length === 11 && d[2] === '9') d = d.slice(0, 2) + d.slice(3) // tira o 9 do celular → DDD+8
  return d.length >= 10 ? d.slice(-10) : ''
}

export function normName(s?: string | null): string {
  return (s ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // tira acentos
    .trim().toLowerCase().replace(/\s+/g, ' ')
}

// ── Tipos ─────────────────────────────────────────────────────────────────────
export interface MatchOrder {
  id: string
  subtotal: number | null
  total: number | null
  register_date: string | null
  customer_email: string | null
  customer_phone: string | null
  customer_name: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  products: any
}

export interface MatchProfile {
  id: string
  email: string | null
  phone: string | null
  full_name: string | null
  subscription_status: string | null
  created_at: string | null
}

export interface ProfileMatch {
  profile: MatchProfile
  bought: boolean
  orders: number
  totalSpent: number
  firstPurchase: string | null
  lastPurchase: string | null
  matchType: 'email' | 'phone' | null
  products: { name: string; qty: number }[]
}

export interface CustomerAgg {
  key: string
  name: string
  email: string | null
  phone: string | null
  orders: number
  totalSpent: number
  firstPurchase: string | null
  lastPurchase: string | null
  products: { name: string; qty: number }[]
}

// ── Helpers internos ──────────────────────────────────────────────────────────
function orderProducts(o: MatchOrder): { name: string; qty: number }[] {
  const arr = Array.isArray(o.products) ? o.products : []
  return arr
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((p: any) => p && (p.value ?? 0) > 0) // ignora brindes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((p: any) => ({ name: String(p.name ?? '—'), qty: Number(p.quantity ?? 1) }))
}

function mergeProducts(into: Map<string, number>, prods: { name: string; qty: number }[]) {
  for (const p of prods) into.set(p.name, (into.get(p.name) ?? 0) + p.qty)
}

function topProducts(m: Map<string, number>, limit = 8): { name: string; qty: number }[] {
  return [...m.entries()].map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, limit)
}

function minMaxDate(cur: { min: string | null; max: string | null }, d: string | null) {
  if (!d) return
  if (!cur.min || d < cur.min) cur.min = d
  if (!cur.max || d > cur.max) cur.max = d
}

// ── Índices de pedidos ────────────────────────────────────────────────────────
function indexOrders(orders: MatchOrder[]) {
  const byEmail = new Map<string, MatchOrder[]>()
  const byPhone = new Map<string, MatchOrder[]>()
  for (const o of orders) {
    const e = normEmail(o.customer_email)
    const p = normPhoneKey(o.customer_phone)
    if (e) { const a = byEmail.get(e) ?? []; a.push(o); byEmail.set(e, a) }
    if (p) { const a = byPhone.get(p) ?? []; a.push(o); byPhone.set(p, a) }
  }
  return { byEmail, byPhone }
}

// ── Plano → Ybera: agrega por aluna ───────────────────────────────────────────
export function matchOrdersToProfiles(orders: MatchOrder[], profiles: MatchProfile[]): ProfileMatch[] {
  const { byEmail, byPhone } = indexOrders(orders)
  return profiles.map(profile => {
    const e = normEmail(profile.email)
    const p = normPhoneKey(profile.phone)
    const matched = new Map<string, MatchOrder>()
    let matchType: 'email' | 'phone' | null = null
    if (e && byEmail.has(e)) { byEmail.get(e)!.forEach(o => matched.set(o.id, o)); matchType = 'email' }
    if (p && byPhone.has(p)) { byPhone.get(p)!.forEach(o => matched.set(o.id, o)); if (!matchType) matchType = 'phone' }

    const list = [...matched.values()]
    const dates = { min: null as string | null, max: null as string | null }
    const prodMap = new Map<string, number>()
    let totalSpent = 0
    for (const o of list) {
      totalSpent += o.subtotal ?? 0
      minMaxDate(dates, o.register_date)
      mergeProducts(prodMap, orderProducts(o))
    }
    return {
      profile,
      bought: list.length > 0,
      orders: list.length,
      totalSpent,
      firstPurchase: dates.min,
      lastPurchase: dates.max,
      matchType: list.length ? matchType : null,
      products: topProducts(prodMap, 6),
    }
  })
}

// ── Conjunto de chaves de TODAS as alunas (p/ classificar canal) ──────────────
export function buildProfileKeySet(profiles: MatchProfile[]): { emails: Set<string>; phones: Set<string> } {
  const emails = new Set<string>()
  const phones = new Set<string>()
  for (const p of profiles) {
    const e = normEmail(p.email); if (e) emails.add(e)
    const k = normPhoneKey(p.phone); if (k) phones.add(k)
  }
  return { emails, phones }
}

export function isAluno(o: MatchOrder, keys: { emails: Set<string>; phones: Set<string> }): boolean {
  const e = normEmail(o.customer_email)
  const p = normPhoneKey(o.customer_phone)
  return (!!e && keys.emails.has(e)) || (!!p && keys.phones.has(p))
}

// ── Grupos/outros → Ybera: agrega compradores que NÃO são alunas ──────────────
export function aggregateNonStudents(orders: MatchOrder[], profiles: MatchProfile[]): CustomerAgg[] {
  const keys = buildProfileKeySet(profiles)
  const map = new Map<string, CustomerAgg & { _prod: Map<string, number>; _d: { min: string | null; max: string | null } }>()
  for (const o of orders) {
    if (isAluno(o, keys)) continue
    const e = normEmail(o.customer_email)
    const p = normPhoneKey(o.customer_phone)
    const key = e || (p ? 'tel:' + p : 'nome:' + normName(o.customer_name)) || o.id
    let agg = map.get(key)
    if (!agg) {
      agg = {
        key, name: (o.customer_name ?? '—').trim(), email: o.customer_email, phone: o.customer_phone,
        orders: 0, totalSpent: 0, firstPurchase: null, lastPurchase: null, products: [],
        _prod: new Map(), _d: { min: null, max: null },
      }
      map.set(key, agg)
    }
    agg.orders += 1
    agg.totalSpent += o.subtotal ?? 0
    minMaxDate(agg._d, o.register_date)
    mergeProducts(agg._prod, orderProducts(o))
  }
  return [...map.values()].map(a => ({
    key: a.key, name: a.name, email: a.email, phone: a.phone,
    orders: a.orders, totalSpent: a.totalSpent,
    firstPurchase: a._d.min, lastPurchase: a._d.max,
    products: topProducts(a._prod, 6),
  }))
}

// ── Top produtos global de um conjunto de pedidos ─────────────────────────────
export function topProductsOf(orders: MatchOrder[], limit = 8): { name: string; qty: number; revenue: number }[] {
  const m = new Map<string, { qty: number; revenue: number }>()
  for (const o of orders) {
    const arr = Array.isArray(o.products) ? o.products : []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const p of arr as any[]) {
      if (!p || (p.value ?? 0) <= 0) continue
      const ex = m.get(p.name) ?? { qty: 0, revenue: 0 }
      ex.qty += Number(p.quantity ?? 1)
      ex.revenue += Number(p.total ?? 0)
      m.set(String(p.name), ex)
    }
  }
  return [...m.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, limit)
}
