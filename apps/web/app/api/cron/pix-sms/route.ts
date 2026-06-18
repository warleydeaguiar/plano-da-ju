import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { pagarme } from '@/lib/pagarme/client';
import { sendSms } from '@/lib/zenvia';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/cron/pix-sms?k=<WA_AUTOREPLY_SECRET>   (ou Bearer CRON_SECRET)
 *
 * Recuperação de PIX por SMS (Zenvia). Canal paralelo ao WhatsApp: pega quem
 * gerou um PIX e ainda NÃO pagou e, por volta de ~15 min após a geração, manda
 * UM SMS com o link da página /pix/<id> (onde está o copia-e-cola).
 *
 * Janela: MIN_AGE_MIN..MAX_AGE_MIN. Dispara no máximo 1x por pessoa
 * (coluna profiles.pix_sms_sent_at). ?dry=1 → só relata o que faria.
 */
const MIN_AGE_MIN = 13;   // alvo ~15 min (cron roda a cada 3 min)
const MAX_AGE_MIN = 50;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://planodaju.julianecost.com';

function firstName(full?: string | null): string {
  const n = (full ?? '').trim().split(/\s+/)[0] ?? '';
  if (!n) return 'Oi';
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
}

function toIntlPhone(raw?: string | null): string {
  const d = String(raw ?? '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('55') && d.length >= 12) return d;
  return `55${d}`;
}

// SMS sem acento/emoji (GSM-7, custo menor). Link da página /pix/<id>.
function smsText(name: string, id: string): string {
  return `${name}, seu PIX do Plano da Ju ainda nao foi confirmado e esta perto de expirar. Finalize seu acesso aqui: ${APP_URL}/pix/${id}`;
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const waSecret = process.env.WA_AUTOREPLY_SECRET;
  const auth = req.headers.get('authorization');
  const k = req.nextUrl.searchParams.get('k');
  const authed =
    (secret && auth === `Bearer ${secret}`) ||
    (waSecret && k === waSecret) ||
    (secret && k === secret);
  if (!authed) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const dry = req.nextUrl.searchParams.get('dry') === '1';
  const sb = await createServiceClient();

  const sinceIso = new Date(Date.now() - (MAX_AGE_MIN + 10) * 60_000).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cands, error } = await (sb.from('profiles') as any)
    .select('id, email, full_name, phone, pagarme_pix_order_id, subscription_status, updated_at')
    .eq('subscription_status', 'pending')
    .not('pagarme_pix_order_id', 'is', null)
    .not('phone', 'is', null)
    .is('pix_sms_sent_at', null)
    .gt('updated_at', sinceIso)
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = Date.now();
  const result = { scanned: cands?.length ?? 0, sent: 0, skipped_paid: 0, skipped_window: 0, expired: 0, failed: 0, details: [] as unknown[] };

  for (const p of cands ?? []) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const order: any = await pagarme.get(`/orders/${p.pagarme_pix_order_id}`);
      const status = order?.status;

      if (status === 'paid') { result.skipped_paid++; continue; }
      if (status && status !== 'pending' && status !== 'waiting_payment') {
        if (!dry) await markSent(sb, p.id);
        result.expired++; continue;
      }

      const createdAt = order?.created_at ? new Date(order.created_at).getTime() : now;
      const ageMin = (now - createdAt) / 60_000;

      if (ageMin < MIN_AGE_MIN) { result.skipped_window++; continue; }
      if (ageMin > MAX_AGE_MIN) { if (!dry) await markSent(sb, p.id); result.expired++; continue; }

      const phoneIntl = toIntlPhone(p.phone);
      if (phoneIntl.length < 12) { result.failed++; result.details.push({ email: p.email, err: 'bad_phone' }); continue; }

      if (dry) { result.sent++; result.details.push({ email: p.email, ageMin: Math.round(ageMin), to: phoneIntl, would_send: true }); continue; }

      const sendRes = await sendSms(phoneIntl, smsText(firstName(p.full_name), p.id));
      if (sendRes.ok) {
        await markSent(sb, p.id);
        result.sent++;
      } else if (sendRes.skipped) {
        result.failed++;
        result.details.push({ email: p.email, err: 'zenvia_token_missing' });
      } else {
        // NÃO marca → tenta de novo no próximo ciclo
        result.failed++;
        result.details.push({ email: p.email, err: sendRes.error });
      }
    } catch (e) {
      result.failed++;
      result.details.push({ email: p.email, err: e instanceof Error ? e.message.slice(0, 200) : 'order_fetch_failed' });
    }
  }

  return NextResponse.json({ ok: true, dry, ...result });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function markSent(sb: any, id: string) {
  await sb.from('profiles').update({ pix_sms_sent_at: new Date().toISOString() }).eq('id', id);
}
