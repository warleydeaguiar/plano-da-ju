import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CAPACITY = 1024

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function GET(req: NextRequest) {
  const db = getServiceClient()
  const url = new URL(req.url)
  const utm = {
    source:   url.searchParams.get('utm_source')   ?? null,
    medium:   url.searchParams.get('utm_medium')   ?? null,
    campaign: url.searchParams.get('utm_campaign') ?? null,
  }

  const WA = 'https://chat.whatsapp.com/'

  // Seleção resiliente em camadas. Cada camada busca VÁRIOS candidatos (não 1)
  // e já filtra por link de convite VÁLIDO no banco — assim, se algum grupo
  // tiver link quebrado/revogado (ex: número admin banido), pulamos pro próximo
  // em vez de cair num beco sem saída.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pickFrom = async (build: (q: any) => any): Promise<any | null> => {
    const base = db
      .from('wg_groups' as any)
      .select('id, invite_link, member_count, name')
      .eq('status', 'active')
      .like('invite_link', `${WA}%`)
      .order('member_count', { ascending: true })
      .limit(15)
    const { data } = await build(base)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list = (data ?? []) as any[]
    return list.find(g => typeof g.invite_link === 'string' && g.invite_link.startsWith(WA)) ?? null
  }

  let finalTarget =
    // 1) ideal: recebendo + abaixo da capacidade
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await pickFrom((q: any) => q.eq('is_receiving', true).lt('member_count', CAPACITY))
    // 2) qualquer ativo abaixo da capacidade (ignora pausa manual)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ?? await pickFrom((q: any) => q.lt('member_count', CAPACITY))
    // 3) último recurso: qualquer ativo com link válido (ignora capacidade) —
    //    melhor mandar pra um grupo cheio do que deixar a pessoa sem destino
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ?? await pickFrom((q: any) => q)

  if (finalTarget) {
    // Log do clique — await para garantir que o insert complete antes do redirect
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    const { createHash } = await import('crypto')
    const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 32)

    await db.from('wg_redirect_clicks' as any).insert({
      group_id:     finalTarget.id,
      ip_hash:      ipHash,
      user_agent:   req.headers.get('user-agent') ?? null,
      utm_source:   utm.source,
      utm_medium:   utm.medium,
      utm_campaign: utm.campaign,
      referer:      req.headers.get('referer') ?? null,
    })

    // Valida que o link é realmente um convite WhatsApp antes de redirecionar
    const link: string = finalTarget.invite_link
    if (!link.startsWith('https://chat.whatsapp.com/')) {
      console.error('[g/entrar] invite_link inválido para grupo', finalTarget.id, ':', link)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://plano.julianecost.com'
      return NextResponse.redirect(`${appUrl}/?grupos=cheio`, { status: 302 })
    }

    return NextResponse.redirect(link, { status: 302 })
  }

  // Nenhum grupo disponível — redireciona para a home com aviso
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://plano.julianecost.com'
  return NextResponse.redirect(`${appUrl}/?grupos=cheio`, { status: 302 })
}
