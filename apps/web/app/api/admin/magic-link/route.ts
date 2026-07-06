import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { normalizeEmail } from '@/lib/normalize-email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APP = 'https://planodaju.julianecost.com';

/**
 * GET /api/admin/magic-link?user=<id|email>&k=<PLAN_PREVIEW_SECRET>
 *
 * Gera um LINK DE ACESSO (magic link, login sem senha) pra QUALQUER cliente e o
 * RETORNA — o admin copia e manda pela cliente (Chatwoot, WhatsApp, onde for).
 * O link é de uso único e expira ~1h. Read-side (não altera dados da cliente).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.PLAN_PREVIEW_SECRET;
  const k = req.nextUrl.searchParams.get('k');
  if (!secret || k !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const raw = (req.nextUrl.searchParams.get('user') ?? '').trim();
  if (!raw) return NextResponse.json({ error: 'informe o e-mail ou id da cliente' }, { status: 400 });

  const sb = await createServiceClient();

  // Resolve o e-mail (aceita id uuid ou e-mail).
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);
  let email = normalizeEmail(raw).email;
  let fullName: string | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = (sb.from('profiles') as any).select('email, full_name');
  const { data: prof } = isUuid ? await q.eq('id', raw).maybeSingle() : await q.eq('email', email).maybeSingle();
  if (prof?.email) { email = prof.email; fullName = prof.full_name ?? null; }
  if (!email || !email.includes('@')) return NextResponse.json({ error: 'cliente não encontrada' }, { status: 404 });

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.auth.admin as any).generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${APP}/entrar` },
    });
    const tokenHash = data?.properties?.hashed_token;
    if (error || !tokenHash) return NextResponse.json({ error: error?.message ?? 'cliente sem conta de acesso' }, { status: 404 });

    const link = `${APP}/entrar#token_hash=${encodeURIComponent(tokenHash)}&type=magiclink`;
    return NextResponse.json({ ok: true, email, full_name: fullName, link });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'erro' }, { status: 500 });
  }
}
