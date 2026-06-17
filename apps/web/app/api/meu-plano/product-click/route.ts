import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/meu-plano/product-click
 * Body: { product_id, product_name, is_ybera, user_id }
 * Registra um clique no produto recomendado do plano (analytics). Best-effort.
 */
export async function POST(req: NextRequest) {
  try {
    const { product_id, product_name, is_ybera, user_id } = await req.json()
    if (!product_id) return NextResponse.json({ ok: false }, { status: 400 })
    const sb = await createServiceClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb.from('plan_product_clicks') as any).insert({
      user_id: user_id ?? null,
      product_id: String(product_id).slice(0, 64),
      product_name: product_name ? String(product_name).slice(0, 200) : null,
      is_ybera: !!is_ybera,
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true }) // analytics: nunca quebra a navegação
  }
}
