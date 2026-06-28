/**
 * Sincroniza pedidos da Ybera (API) → tabela local ybera_orders (upsert por id).
 * Usado pelo backfill (histórico) e pelo cron diário.
 */
import { createAdminClient } from '@/lib/supabase'
import { fetchYberaOrders, type YberaOrder } from '@/lib/ybera-api'
import { normEmail, normPhoneKey } from '@/lib/ybera-match'

function toRow(o: YberaOrder) {
  return {
    id: o.id,
    origin_id: o.originId ?? null,
    customer_name: o.customer?.name?.trim() ?? null,
    customer_email: normEmail(o.customer?.email) || null,
    customer_phone: (o.customer?.phone ?? '').replace(/\D/g, '') || null,
    phone_key: normPhoneKey(o.customer?.phone) || null,
    subtotal: o.subtotal ?? null,
    total: o.total ?? null,
    shipping_value: o.shippingValue ?? null,
    influencer_name: o.influencerName ?? null,
    register_date: o.registerDate ?? null,
    products: o.products ?? [],
  }
}

export async function syncYberaRange(
  start: string,
  end: string,
): Promise<{ ok: boolean; fetched: number; upserted: number; error?: string }> {
  const res = await fetchYberaOrders(start, end)
  if (res.status !== 'ok') {
    return { ok: false, fetched: 0, upserted: 0, error: res.status === 'no_token' ? 'YBERA_API_TOKEN ausente' : (res.error ?? 'erro Ybera') }
  }
  const rows = res.orders.map(toRow)
  if (!rows.length) return { ok: true, fetched: 0, upserted: 0 }

  const sb = createAdminClient()
  let upserted = 0
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb.from('ybera_orders') as any).upsert(chunk, { onConflict: 'id' })
    if (error) return { ok: false, fetched: rows.length, upserted, error: error.message }
    upserted += chunk.length
  }
  return { ok: true, fetched: rows.length, upserted }
}

const MONTH_NAMES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

/** Mês a partir do qual os números mensais vêm da API (antes disso = Excel manual). */
export const YBERA_API_FROM = process.env.YBERA_API_FROM_MONTH ?? '2026-06'

/**
 * Agrega ybera_orders por mês e grava em ybera_monthly_data — SOMENTE para meses
 * >= YBERA_API_FROM (do ponto da integração pra frente). Os meses anteriores
 * (preenchidos à mão pelo Excel) NUNCA são tocados. Atualiza só vendas/
 * vendas_afiliadas (merge-duplicates preserva anuncios/leads/meta da linha).
 */
export async function syncYberaMonthlyAggregates(
  fromYM: string = YBERA_API_FROM,
): Promise<{ ok: boolean; months: number; error?: string }> {
  const sb = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.from('ybera_orders') as any)
    .select('register_date, subtotal')
    .gte('register_date', `${fromYM}-01`)
  if (error) return { ok: false, months: 0, error: error.message }

  const agg = new Map<string, { vendas: number; count: number }>()
  for (const o of data ?? []) {
    if (!o.register_date) continue
    const ym = String(o.register_date).slice(0, 7)
    if (ym < fromYM) continue
    const e = agg.get(ym) ?? { vendas: 0, count: 0 }
    e.vendas += Number(o.subtotal ?? 0); e.count++
    agg.set(ym, e)
  }

  const rows = Array.from(agg.entries()).map(([ym, v]) => {
    const [y, m] = ym.split('-').map(Number)
    return {
      year_month: ym,
      month_name: `${MONTH_NAMES_PT[m - 1]} ${y}`,
      vendas: Math.round(v.vendas * 100) / 100,
      vendas_afiliadas: Math.round(v.vendas * 100) / 100,
      updated_at: new Date().toISOString(),
    }
  })
  if (!rows.length) return { ok: true, months: 0 }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: upErr } = await (sb.from('ybera_monthly_data') as any)
    .upsert(rows, { onConflict: 'year_month' })
  if (upErr) return { ok: false, months: 0, error: upErr.message }
  return { ok: true, months: rows.length }
}

/** Lista de janelas [start,end] mês a mês, de `fromYM` ('YYYY-MM') até hoje (BR). */
export function monthWindows(fromYM: string): { start: string; end: string; ym: string }[] {
  const [fy, fm] = fromYM.split('-').map(Number)
  const now = new Date()
  const endY = now.getFullYear()
  const endM = now.getMonth() + 1
  const out: { start: string; end: string; ym: string }[] = []
  let y = fy, m = fm
  while (y < endY || (y === endY && m <= endM)) {
    const mm = String(m).padStart(2, '0')
    const lastDay = new Date(y, m, 0).getDate() // último dia do mês m
    out.push({ ym: `${y}-${mm}`, start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(lastDay).padStart(2, '0')}` })
    m++; if (m > 12) { m = 1; y++ }
  }
  return out
}
