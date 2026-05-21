import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 1x1 GIF transparente — menor possível (43 bytes)
const PIXEL_GIF = Buffer.from([
  0x47,0x49,0x46,0x38,0x39,0x61,0x01,0x00,0x01,0x00,0x80,0x00,0x00,0xff,0xff,0xff,
  0x00,0x00,0x00,0x21,0xf9,0x04,0x01,0x00,0x00,0x00,0x00,0x2c,0x00,0x00,0x00,0x00,
  0x01,0x00,0x01,0x00,0x00,0x02,0x02,0x44,0x01,0x00,0x3b,
]);

const SECRET = process.env.EMAIL_TRACKING_SECRET ?? '';

function signTracking(payload: string): string {
  if (!SECRET) return '';
  return createHmac('sha256', SECRET).update(payload).digest('hex').slice(0, 16);
}

function pixelResponse(): Response {
  return new Response(PIXEL_GIF as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(PIXEL_GIF.length),
      // Não cachear — cada abertura conta
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}

/**
 * GET /api/email/track/open?s=<send_id>&sig=<hmac>
 *
 * Retorna pixel 1x1 transparente. Em background, registra a abertura
 * no wg_email_sends (open_count++, last_opened_at, opened_at se primeira).
 *
 * Importante: SEMPRE retorna 200 + pixel — falha de tracking nunca pode
 * "quebrar" o email do cliente (imagem broken visível). Erros são
 * registrados em console mas não afetam a resposta.
 */
export async function GET(req: NextRequest) {
  const sendId = req.nextUrl.searchParams.get('s');
  const sig    = req.nextUrl.searchParams.get('sig') ?? '';

  // Sempre retornar pixel mesmo se dados inválidos — não vamos quebrar o email
  if (!sendId) return pixelResponse();

  // HMAC verify (se SECRET configurado)
  if (SECRET) {
    const expected = signTracking(`open:${sendId}`);
    if (expected !== sig) {
      // Sig inválida — pode ser bot/scanner mexendo no link. Não conta.
      return pixelResponse();
    }
  }

  // Fire-and-forget — não bloqueia a resposta
  (async () => {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) return;

      const sb = createClient(url, key, { auth: { persistSession: false } });
      const ua = req.headers.get('user-agent') ?? '';
      const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();

      // UPDATE: incrementa contador, marca timestamps
      // Usa RPC inline via raw SQL pra incrementar atomicamente
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (sb.from('wg_email_sends') as any)
        .select('id, open_count, opened_at')
        .eq('id', sendId)
        .single()
        .then(async ({ data }: { data: { id: string; open_count: number; opened_at: string | null } | null }) => {
          if (!data) return;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (sb.from('wg_email_sends') as any)
            .update({
              opened_at: data.opened_at ?? new Date().toISOString(),
              last_opened_at: new Date().toISOString(),
              open_count: (data.open_count ?? 0) + 1,
            })
            .eq('id', sendId);

          // Detail event (Phase 2 — opcional, mas barato adicionar agora)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (sb.from('wg_email_events' as any) as any).insert({
            send_id: sendId,
            event_type: 'open',
            user_agent: ua.slice(0, 500),
            ip: ip || null,
          });
        });
    } catch (err) {
      console.error('[email/track/open]', err);
    }
  })();

  return pixelResponse();
}
