import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 5

/**
 * GET /api/checkins?page=0
 * Feed paginado das fotos de progresso (check-ins) que as clientes adicionam
 * na seção de progresso do app. 5 por página, mais recentes primeiro.
 * Protegido pelo middleware do admin (sessão).
 */
export async function GET(req: NextRequest) {
  try {
    const page = Math.max(0, parseInt(req.nextUrl.searchParams.get('page') || '0', 10) || 0)
    const sb = createAdminClient()

    // Busca TODAS as fotos (mais antigas primeiro) e DESCARTA a 1ª de cada
    // usuária — essa é a foto INICIAL (estado do cabelo no começo). O feed de
    // Progresso deve mostrar só a evolução, não o ponto de partida.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: allData } = await (sb.from('photo_analyses') as any)
      .select(
        'id,user_id,photo_url,brilho_score,hidratacao_score,frizz_score,pontas_score,crescimento_estimado_cm,avaliacao_texto,analyzed_at',
      )
      .not('photo_url', 'is', null)
      .order('analyzed_at', { ascending: true })
      .limit(2000)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const all = (allData ?? []) as any[]
    const seen = new Set<string>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const progressOnly: any[] = []
    for (const r of all) {
      if (!seen.has(r.user_id)) { seen.add(r.user_id); continue } // pula a inicial
      progressOnly.push(r)
    }
    // mais recentes primeiro + pagina em memória
    progressOnly.reverse()
    const total = progressOnly.length
    const from = page * PAGE_SIZE
    const rows = progressOnly.slice(from, from + PAGE_SIZE)
    const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))]
    const nameMap = new Map<string, string | null>()
    if (ids.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profs } = await (sb.from('profiles') as any)
        .select('id,full_name')
        .in('id', ids)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const p of (profs ?? []) as any[]) nameMap.set(p.id, p.full_name ?? null)
    }

    const items = rows.map((r) => ({
      id: r.id,
      photoUrl: r.photo_url as string,
      name: nameMap.get(r.user_id) ?? null,
      analyzedAt: r.analyzed_at as string,
      scores: {
        brilho: r.brilho_score,
        hidratacao: r.hidratacao_score,
        frizz: r.frizz_score,
        pontas: r.pontas_score,
        crescimento: r.crescimento_estimado_cm,
      },
      texto: r.avaliacao_texto as string | null,
    }))

    return NextResponse.json({
      items,
      page,
      pageSize: PAGE_SIZE,
      total,
      hasMore: from + rows.length < total,
    })
  } catch (e) {
    console.error('[api/checkins]', e)
    return NextResponse.json({ error: 'Erro ao carregar check-ins' }, { status: 500 })
  }
}
