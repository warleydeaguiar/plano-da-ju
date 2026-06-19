import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 24

/**
 * GET /api/initial-photos/gallery?page=0
 * Galeria COMPLETA do cabelo inicial — TODAS as clientes que ENVIARAM foto
 * (profiles.photo_url não nulo), paginado, mais recentes primeiro.
 * Protegido pelo middleware do admin.
 */
export async function GET(req: NextRequest) {
  try {
    const page = Math.max(0, parseInt(req.nextUrl.searchParams.get('page') || '0', 10) || 0)
    const sb = createAdminClient()
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, count } = await (sb.from('profiles') as any)
      .select('id, full_name, email, photo_url, photo_back_url, photo_root_url, photo_taken_at, hair_type, subscription_activated_at, created_at', { count: 'exact' })
      .not('photo_url', 'is', null)
      .order('photo_taken_at', { ascending: false, nullsFirst: false })
      .order('subscription_activated_at', { ascending: false, nullsFirst: false })
      .range(from, to)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = (data ?? []).map((p: any) => ({
      id: p.id,
      name: p.full_name ?? (p.email ? String(p.email).split('@')[0] : null),
      photoUrl: p.photo_url ?? null,
      photoBackUrl: p.photo_back_url ?? null,
      photoRootUrl: p.photo_root_url ?? null,
      hairType: p.hair_type ?? null,
      takenAt: p.photo_taken_at ?? p.subscription_activated_at ?? p.created_at ?? null,
    }))

    const total = count ?? items.length
    return NextResponse.json({
      items,
      page,
      pageSize: PAGE_SIZE,
      total,
      hasMore: from + items.length < total,
    })
  } catch (e) {
    console.error('[api/initial-photos/gallery]', e)
    return NextResponse.json({ error: 'Erro ao carregar galeria' }, { status: 500 })
  }
}
