import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * GET /api/admin/pagarme-net?k=<WA_AUTOREPLY_SECRET>&start=2026-04-01&end=2026-06-30
 *
 * Soma os RECEBÍVEIS (payables) da Pagar.me no período → faturamento bruto, taxas
 * e LÍQUIDO real. A chave (PAGARME_SECRET_KEY) é "sensitive" no Vercel e só existe
 * em runtime; por isso o cálculo roda aqui dentro. Read-only.
 *
 * Payables por `payment_date` (dia em que o dinheiro entrou). type='credit' soma,
 * type='refund'/'chargeback' subtrai. net = amount - fee - anticipation_fee.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.WA_AUTOREPLY_SECRET || process.env.CRON_SECRET
  const k = req.nextUrl.searchParams.get('k')
  if (!secret || k !== secret) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const key = process.env.PAGARME_SECRET_KEY
  if (!key) return NextResponse.json({ error: 'PAGARME_SECRET_KEY ausente' }, { status: 500 })

  const start = req.nextUrl.searchParams.get('start') || '2026-04-01'
  const end = req.nextUrl.searchParams.get('end') || '2026-06-30'
  const auth = 'Basic ' + Buffer.from(key + ':').toString('base64')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const acc: Record<string, { gross: number; fee: number; anticipation: number; net: number; count: number }> = {}
  let debit = 0 // estornos/chargebacks (subtraem)
  let page = 1
  let scanned = 0
  const size = 1000

  try {
    for (;;) {
      const url = `https://api.pagar.me/core/v5/payables?created_since=${start}T00:00:00Z&created_until=${end}T23:59:59Z&page=${page}&size=${size}`
      const res = await fetch(url, { headers: { Authorization: auth, 'Content-Type': 'application/json' } })
      if (!res.ok) return NextResponse.json({ error: `Pagar.me ${res.status}: ${(await res.text()).slice(0, 200)}` }, { status: 502 })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: any = await res.json()
      const rows: any[] = Array.isArray(body?.data) ? body.data : []
      if (!rows.length) break

      for (const p of rows) {
        scanned++
        const amount = Number(p.amount ?? 0)            // centavos (bruto do payable)
        const fee = Number(p.fee ?? 0)
        const antic = Number(p.anticipation_fee ?? 0)
        const type = String(p.type ?? 'credit')          // credit | refund | chargeback
        const method = String(p.payment_method ?? 'outro')
        if (type !== 'credit') { debit += amount + fee + antic; continue }
        const e = acc[method] ?? { gross: 0, fee: 0, anticipation: 0, net: 0, count: 0 }
        e.gross += amount; e.fee += fee; e.anticipation += antic; e.net += (amount - fee - antic); e.count++
        acc[method] = e
      }
      if (rows.length < size) break
      page++
      if (page > 60) break // trava de segurança
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'erro' }, { status: 500 })
  }

  const c = (n: number) => Math.round(n) / 100
  const tot = Object.values(acc).reduce((a, e) => ({
    gross: a.gross + e.gross, fee: a.fee + e.fee, anticipation: a.anticipation + e.anticipation, net: a.net + e.net, count: a.count + e.count,
  }), { gross: 0, fee: 0, anticipation: 0, net: 0, count: 0 })

  return NextResponse.json({
    periodo: { start, end },
    por_metodo: Object.fromEntries(Object.entries(acc).map(([m, e]) => [m, {
      bruto: c(e.gross), taxa: c(e.fee), antecipacao: c(e.anticipation), liquido: c(e.net), recebiveis: e.count,
    }])),
    total: {
      bruto: c(tot.gross), taxa_pagarme: c(tot.fee), antecipacao: c(tot.anticipation),
      estornos: c(debit), liquido: c(tot.net - debit), recebiveis: tot.count,
    },
    taxa_efetiva_pct: tot.gross > 0 ? Math.round((tot.fee / tot.gross) * 10000) / 100 : 0,
    scanned,
  })
}
