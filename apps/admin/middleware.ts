import { createServerClient } from '@supabase/ssr'
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
 */
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
  const { data: { user } } = await supabase.auth.getUser()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isAdmin = !!user && (user.app_metadata as any)?.role === 'admin'

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
