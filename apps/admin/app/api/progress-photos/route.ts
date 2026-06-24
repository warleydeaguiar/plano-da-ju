import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 24

/**
 * GET /api/progress-photos?page=0
 * Galeria de fotos de PROGRESSO/evolução das alunas (tabela photo_analyses),
 * paginada, mais recentes primeiro. Exclui a foto INICIAL de cada perfil
 * (essa já aparece na galeria de cabelo inicial) — aqui são só os envios de
 * evolução. Protegido pelo middleware do admin.
 */
export async function GET(req: NextRequest) {
  try {
    const page = Math.max(0, parseInt(req.nextUrl.searchParams.get('page') || '0', 10) || 0)
    const sb = createAdminClient()
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, count } = await (sb.from('photo_analyses') as any)
      .select('id, user_id, photo_url, analyzed_at, frizz_score, brilho_score, hidratacao_score, pontas_score', { count: 'exact' })
      .not('photo_url', 'is', null)
      .order('analyzed_at', { ascending: false })
      .range(from, to)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (data ?? []) as any[]
    const userIds = [...new Set(rows.map(r => r.user_id).filter(Boolean))]

    // Nome + foto inicial (pra rotular e pra marcar qual é "inicial" vs progresso).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profs } = await (sb.from('profiles') as any)
      .select('id, full_name, email, photo_url')
      .in('id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000'])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profById = new Map<string, any>((profs ?? []).map((p: any) => [p.id, p]))

    const items = rows.map(r => {
      const p = profById.get(r.user_id)
      return {
        id: r.id,
        name: p?.full_name ?? (p?.email ? String(p.email).split('@')[0] : null),
        photoUrl: r.photo_url ?? null,
        isInitial: !!p && p.photo_url === r.photo_url,   // mesma foto do onboarding
        takenAt: r.analyzed_at ?? null,
        scores: {
          frizz: r.frizz_score ?? null, brilho: r.brilho_score ?? null,
          hidratacao: r.hidratacao_score ?? null, pontas: r.pontas_score ?? null,
        },
      }
    })

    const total = count ?? items.length
    return NextResponse.json({ items, page, pageSize: PAGE_SIZE, total, hasMore: from + items.length < total })
  } catch (e) {
    console.error('[api/progress-photos]', e)
    return NextResponse.json({ error: 'Erro ao carregar fotos de progresso' }, { status: 500 })
  }
}
