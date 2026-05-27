import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SECRET = process.env.EMAIL_TRACKING_SECRET ?? '';

function signTracking(payload: string): string {
  if (!SECRET) return '';
  return createHmac('sha256', SECRET).update(payload).digest('hex').slice(0, 16);
}

function b64UrlDecode(s: string): string | null {
  try {
    const padded = s.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(padded, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

/** Resolve o email a partir dos params (e=base64url, sig=hmac de `unsub:email`). */
function resolveEmail(req: NextRequest): { email: string | null; valid: boolean } {
  const e = req.nextUrl.searchParams.get('e');
  const sig = req.nextUrl.searchParams.get('sig') ?? '';
  if (!e) return { email: null, valid: false };
  const decoded = b64UrlDecode(e);
  if (!decoded || !decoded.includes('@')) return { email: null, valid: false };
  const email = decoded.toLowerCase().trim();
  if (SECRET) {
    const expected = signTracking(`unsub:${email}`);
    if (expected !== sig) return { email, valid: false };
  }
  return { email, valid: true };
}

async function suppress(email: string, source: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  const sb = createClient(url, key, { auth: { persistSession: false } });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.from('wg_email_unsubscribes') as any).upsert(
    { email, source, created_at: new Date().toISOString() },
    { onConflict: 'email' },
  );
  return !error;
}

function page(title: string, body: string): NextResponse {
  const html = `<!doctype html><html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${title}</title></head>
<body style="margin:0;background:#FFFAF5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#2A1E2C;">
<div style="max-width:520px;margin:60px auto;padding:0 20px;">
  <div style="text-align:center;margin-bottom:22px;">
    <span style="font-size:24px;font-weight:700;">Plano da <span style="color:#BE185D;font-style:italic;">Ju</span></span>
  </div>
  <div style="background:#fff;border-radius:18px;padding:34px 28px;box-shadow:0 1px 3px rgba(42,30,44,0.08);text-align:center;">
    ${body}
  </div>
  <div style="text-align:center;font-size:12px;color:#B5A6B7;padding:18px 0;">Plano da Ju · Juliane Cost</div>
</div></body></html>`;
  return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

/**
 * GET /api/email/unsubscribe?e=<base64url email>&sig=<hmac>
 * Remove o email da lista e mostra uma página de confirmação.
 */
export async function GET(req: NextRequest) {
  const { email, valid } = resolveEmail(req);
  if (!email || !valid) {
    return page('Link inválido', `
      <h1 style="font-size:20px;margin:0 0 10px;">Link inválido</h1>
      <p style="font-size:14px;color:#7C6B7E;line-height:1.6;margin:0;">
        Este link de descadastro não é válido ou expirou. Se você quer parar de receber
        nossos emails, responda a qualquer mensagem pedindo a remoção.</p>`);
  }
  const ok = await suppress(email, 'link');
  if (!ok) {
    return page('Erro', `
      <h1 style="font-size:20px;margin:0 0 10px;">Não foi possível concluir</h1>
      <p style="font-size:14px;color:#7C6B7E;line-height:1.6;margin:0;">
        Tente novamente em alguns instantes.</p>`);
  }
  return page('Você foi removida da lista', `
    <div style="font-size:40px;margin-bottom:8px;">✓</div>
    <h1 style="font-size:20px;margin:0 0 10px;">Pronto, você saiu da lista</h1>
    <p style="font-size:14px;color:#7C6B7E;line-height:1.6;margin:0;">
      O email <strong>${email}</strong> não vai mais receber nossas mensagens de divulgação.
      Você pode continuar usando seu plano normalmente.</p>`);
}

/**
 * POST — One-Click Unsubscribe (RFC 8058). Gmail/Apple chamam isto direto.
 * Responde 200 sem corpo de página.
 */
export async function POST(req: NextRequest) {
  const { email, valid } = resolveEmail(req);
  if (email && valid) {
    await suppress(email, 'one_click');
  }
  return NextResponse.json({ ok: true });
}
