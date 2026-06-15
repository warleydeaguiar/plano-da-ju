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

/**
 * Envia uma mensagem de texto pelo WhatsApp Cloud API (Graph). Usado pro
 * follow-up 1:1 quando a pessoa clica pra entrar no grupo. Tolerante a falha
 * (nunca bloqueia o redirect).
 */
async function sendWhatsApp(phoneDigits: string, text: string): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN
  const pid = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!token || !pid || !phoneDigits) return
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 6000)
    await fetch(`https://graph.facebook.com/v21.0/${pid}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: phoneDigits, type: 'text', text: { body: text } }),
      signal: controller.signal,
    })
    clearTimeout(t)
  } catch { /* follow-up é best-effort */ }
}

// Resolve o primeiro nome da pessoa: usa ?n= (nome do contato no Chatwoot) ou,
// na falta, casa o telefone (últimos 8 dígitos) com wg_quiz_leads.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveFirstName(db: any, nameParam: string | null, phoneDigits: string): Promise<string> {
  const clean = (s: string | null | undefined) => (s ?? '').trim().split(/\s+/)[0] ?? ''
  if (nameParam && nameParam.trim()) return clean(nameParam)
  if (phoneDigits.length >= 8) {
    const last8 = phoneDigits.slice(-8)
    try {
      const { data } = await db.from('wg_quiz_leads')
        .select('name, created_at').ilike('phone', `%${last8}%`)
        .order('created_at', { ascending: false }).limit(1)
      if (data?.[0]?.name) return clean(data[0].name)
    } catch { /* ignore */ }
  }
  return ''
}

export async function GET(req: NextRequest) {
  const db = getServiceClient()
  const url = new URL(req.url)
  const utm = {
    source:   url.searchParams.get('utm_source')   ?? null,
    medium:   url.searchParams.get('utm_medium')   ?? null,
    campaign: url.searchParams.get('utm_campaign') ?? null,
  }

  // NOVO FUNIL: ?p=<telefone> (e ?n=<nome>) vindo da auto-resposta do número
  // oficial. Dispara o follow-up 1:1 ANTES de redirecionar pro grupo real.
  const phoneDigits = (url.searchParams.get('p') ?? '').replace(/\D/g, '')
  if (phoneDigits.length >= 10) {
    // DEDUP: o link pode ser acessado mais de uma vez (preview do WhatsApp,
    // re-toque, prefetch). Reivindicamos o telefone de forma atômica — só quem
    // INSERIR a linha (1ª vez) envia o follow-up; os demais acessos pulam.
    const { data: claimed } = await db
      .from('wg_group_followups' as any)
      .upsert({ phone: phoneDigits }, { onConflict: 'phone', ignoreDuplicates: true })
      .select('phone')
    if (claimed && claimed.length > 0) {
      const first = await resolveFirstName(db, url.searchParams.get('n'), phoneDigits)
      const ola = first ? `Fico muito feliz, ${first}, que você entrou no meu grupo! 💚` : 'Fico muito feliz que você entrou no meu grupo! 💚'
      const msg = `${ola}\n\nEu dou uma atenção especial pra todas que estão nele, então me conta: o que mais te incomoda no seu cabelo hoje?`
      await sendWhatsApp(phoneDigits, msg)
    }
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
      .eq('link_ok', true) // só grupos com convite VÁLIDO (não banido) — nunca link morto
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
