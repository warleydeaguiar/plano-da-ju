import { createServerClient } from '@supabase/ssr'
import { jwtVerify } from 'jose'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Proteção do painel admin.
 *
 * Bloqueia TODAS as rotas — páginas e APIs — exigindo:
 *  - Cookie de sessão Supabase válido
 *  - usuário com app_metadata.role === 'admin'
 *
 * Exceções:
 *  - /login → sempre aberta (senão não dá pra entrar)
 *  - APIs com Authorization: Bearer <CRON_SECRET|ADMIN_SECRET> → para crons
 *
 * Sem isso, o painel ficava 100% público (problema reportado).
 *
 * A sessão é conferida AQUI, sem perguntar ao servidor de login a cada clique.
 * Antes cada página, prefetch e chamada de API fazia `getUser()` — uma ida ao
 * serviço de auth. Na VPS de 1 núcleo isso chegou a levar 10 s e estourar o
 * tempo, e timeout virava "não logada": em 14/09/2026 a Juliane caiu no login
 * 10 vezes em 8 minutos com a sessão válida no servidor o tempo todo.
 *
 * Agora `getSession()` só lê o cookie (e renova o token quando vence, ~1x por
 * hora), e a assinatura do JWT é conferida localmente com o segredo do
 * Supabase. Cookie adulterado não passa: sem o segredo não se assina um token.
 */
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET
const chave = JWT_SECRET ? new TextEncoder().encode(JWT_SECRET) : null

async function papelDoToken(token: string): Promise<string | null> {
  if (!chave) return null
  try {
    const { payload } = await jwtVerify(token, chave, { algorithms: ['HS256'], clockTolerance: 30 })
    return (payload.app_metadata as { role?: string } | undefined)?.role ?? null
  } catch {
    return null
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Página de login é sempre acessível
  if (pathname === '/login') return NextResponse.next()

  // Cron / integrações server-to-server podem usar Bearer
  if (pathname.startsWith('/api/')) {
    const auth = req.headers.get('authorization') ?? ''
    const cronSecret = process.env.CRON_SECRET
    const adminSecret = process.env.ADMIN_SECRET
    if (cronSecret && auth === `Bearer ${cronSecret}`) return NextResponse.next()
    if (adminSecret && auth === `Bearer ${adminSecret}`) return NextResponse.next()
  }

  // Verifica sessão Supabase pelos cookies da request
  const res = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll().map(c => ({ name: c.name, value: c.value })) },
        setAll(cookies) {
          cookies.forEach(({ name, value, options }) => {
            res.cookies.set({ name, value, ...options })
          })
        },
      },
    },
  )

  let isAdmin = false
  if (chave) {
    const { data: { session } } = await supabase.auth.getSession()
    isAdmin = !!session?.access_token && (await papelDoToken(session.access_token)) === 'admin'
  } else {
    // Sem o segredo configurado, volta a perguntar ao servidor (jeito antigo).
    const { data: { user } } = await supabase.auth.getUser()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    isAdmin = !!user && (user.app_metadata as any)?.role === 'admin'
  }

  if (!isAdmin) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    if (pathname !== '/') url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  return res
}

export const config = {
  // Roda em tudo, exceto assets estáticos do Next e arquivos públicos comuns.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|css|js)$).*)'],
}
