import { NextRequest, NextResponse } from 'next/server'

/**
 * Proteção mínima para rotas /api/ do admin.
 * Em produção, defina ADMIN_SECRET nas env vars do Vercel.
 * Requests devem enviar: Authorization: Bearer <ADMIN_SECRET>
 *
 * ⚠️ Para proteção completa, implemente autenticação por sessão (Supabase Auth).
 * Esta é uma camada mínima para evitar uso não autenticado das APIs.
 */
export function middleware(req: NextRequest) {
  const secret = process.env.ADMIN_SECRET

  // Se ADMIN_SECRET não estiver definida, permite acesso (backward compat)
  if (!secret) return NextResponse.next()

  // Só protege rotas /api/ (as páginas ficam abertas por enquanto)
  if (!req.nextUrl.pathname.startsWith('/api/')) return NextResponse.next()

  const auth = req.headers.get('authorization')
  if (auth === `Bearer ${secret}`) return NextResponse.next()

  // Verifica cookie de sessão (gerado pelo login quando implementado)
  const sessionCookie = req.cookies.get('admin_session')
  if (sessionCookie?.value === secret) return NextResponse.next()

  return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
}

export const config = {
  matcher: ['/api/:path*'],
}
