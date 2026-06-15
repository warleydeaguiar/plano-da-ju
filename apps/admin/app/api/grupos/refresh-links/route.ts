import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { refreshInviteLinks } from '@/lib/evolution-grupos'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * GET /api/grupos/refresh-links
 *
 * RESILIÊNCIA: re-busca o link de convite de cada grupo ativo usando qualquer
 * instância conectada (admin do grupo). Mantém os convites válidos mesmo quando
 * um número é banido — os grupos continuam existindo e acessíveis. Atualiza
 * wg_groups.invite_link quando o link mudou.
 *
 * Auth: Bearer CRON_SECRET (igual aos outros crons). Chamado periodicamente
 * pelo cron do VPS. Sem o secret setado, libera (dev).
 */
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (expected) {
    const auth = req.headers.get('authorization') ?? ''
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ ok: false, error: 'Não autorizado' }, { status: 401 })
    }
  }

  const sb = createAdminClient()

  // Grupos ativos com JID (os que devem receber gente)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: groups } = await (sb.from('wg_groups') as any)
    .select('id, jid, invite_link, name')
    .eq('status', 'active')
    .not('jid', 'is', null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list = (groups ?? []) as any[]
  if (list.length === 0) {
    return NextResponse.json({ ok: true, total: 0, updated: 0, unchanged: 0, missing: 0 })
  }

  const jids = list.map(g => g.jid)
  const links = await refreshInviteLinks(jids)

  let updated = 0
  let unchanged = 0
  let missing = 0

  const now = new Date().toISOString()
  for (const g of list) {
    const fresh = links[g.jid]
    if (!fresh) {
      // Nenhuma instância admin conseguiu gerar o convite → grupo provavelmente
      // banido/expulso. Marca link_ok=false pra NÃO mandar gente pra link morto.
      missing++
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (sb.from('wg_groups') as any)
        .update({ link_ok: false, link_checked_at: now, updated_at: now })
        .eq('id', g.id)
      continue
    }
    // Conseguiu o link → grupo VIVO. Marca link_ok=true e atualiza se mudou.
    if (fresh === g.invite_link) {
      unchanged++
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (sb.from('wg_groups') as any)
        .update({ link_ok: true, link_checked_at: now })
        .eq('id', g.id)
      continue
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb.from('wg_groups') as any)
      .update({ invite_link: fresh, link_ok: true, link_checked_at: now, updated_at: now })
      .eq('id', g.id)
    updated++
  }

  return NextResponse.json({
    ok: true,
    total: list.length,
    updated,       // links atualizados (mudaram)
    unchanged,     // já estavam corretos
    missing,       // nenhuma instância conectada conseguiu o link (grupo sem admin conectado)
    ran_at: new Date().toISOString(),
  })
}

/** POST — mesmo comportamento, para triggers externos. */
export async function POST(req: NextRequest) {
  return GET(req)
}
