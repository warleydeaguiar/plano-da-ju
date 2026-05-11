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

  // Pega o grupo com MENOS membros que tenha invite_link e esteja recebendo
  const { data: target } = await db
    .from('wg_groups' as any)
    .select('id, invite_link, member_count, name')
    .eq('status', 'active')
    .eq('is_receiving', true)
    .not('invite_link', 'is', null)
    .lt('member_count', CAPACITY)
    .order('member_count', { ascending: true })
    .limit(1)
    .maybeSingle()

  // Fallback: qualquer grupo ativo com link (ignora is_receiving)
  let finalTarget = target as any
  if (!finalTarget) {
    const { data: fallback } = await db
      .from('wg_groups' as any)
      .select('id, invite_link, member_count, name')
      .eq('status', 'active')
      .not('invite_link', 'is', null)
      .lt('member_count', CAPACITY)
      .order('member_count', { ascending: true })
      .limit(1)
      .maybeSingle()
    finalTarget = fallback
  }

  if (finalTarget) {
    // Log do clique (fire and forget — não bloqueia o redirect)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    const { createHash } = await import('crypto')
    const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 32)

    void db.from('wg_redirect_clicks' as any).insert({
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
