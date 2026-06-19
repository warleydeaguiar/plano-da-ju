import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 5
const MAX_CLIENTS = 15

/**
 * GET /api/initial-photos?page=0
 * Foto INICIAL (do onboarding, profiles.photo_url) das últimas 15 clientes
 * ativas QUE ENVIARAM FOTO. 5 por página. Quem ainda não subiu foto NÃO
 * aparece aqui (essa seção é a galeria de fotos iniciais).
 * Protegido pelo middleware do admin.
 */
export async function GET(req: NextRequest) {
  try {
    const page = Math.max(0, parseInt(req.nextUrl.searchParams.get('page') || '0', 10) || 0)
    const sb = createAdminClient()

    // Últimas clientes ativas COM foto inicial (mais recentes pela data da foto).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (sb.from('profiles') as any)
      .select('id, full_name, email, photo_url, photo_back_url, photo_root_url, photo_taken_at, subscription_activated_at, created_at')
      .eq('subscription_status', 'active')
      .not('photo_url', 'is', null)
      .order('photo_taken_at', { ascending: false, nullsFirst: false })
      .order('subscription_activated_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(MAX_CLIENTS)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const all = (data ?? []) as any[]
    const total = all.length
    const from = page * PAGE_SIZE
    const slice = all.slice(from, from + PAGE_SIZE)

    const items = slice.map((p) => ({
      id: p.id,
      name: p.full_name ?? (p.email ? String(p.email).split('@')[0] : null),
      photoUrl: p.photo_url ?? null,
      photoBackUrl: p.photo_back_url ?? null,
      photoRootUrl: p.photo_root_url ?? null,
      takenAt: p.photo_taken_at ?? p.subscription_activated_at ?? p.created_at ?? null,
    }))

    const withPhoto = all.filter((p) => !!p.photo_url).length

    return NextResponse.json({
      items,
      page,
      pageSize: PAGE_SIZE,
      total,
      withPhoto,
      hasMore: from + slice.length < total,
    })
  } catch (e) {
    console.error('[api/initial-photos]', e)
    return NextResponse.json({ error: 'Erro ao carregar fotos iniciais' }, { status: 500 })
  }
}
