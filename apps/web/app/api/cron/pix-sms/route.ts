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
 * FOLLOW-UPS de recuperação de PIX por SMS (Zenvia), pra quem gerou PIX e NÃO pagou.
 * O toque 1 (imediato, e-mail+SMS) sai na própria rota de geração do PIX e já marca
 * pix_sms_count=1. Este cron faz os toques seguintes:
 *   • toque 2 — ~24h após o toque anterior
 *   • toque 3 — ~48h após o toque 2 (última chamada, ~72h da geração)
 * Para quando a pessoa paga (subscription_status deixa de ser 'pending'). Só age em
 * quem tem pix_sms_count >= 1 (fluxo novo) — PIX antigos não entram. ?dry=1 = simula.
 */
const TOUCH2_AFTER_H = 24;   // horas desde o toque 1 (imediato)
const TOUCH3_AFTER_H = 48;   // horas desde o toque 2
const MAX_TOUCHES = 3;

function firstName(full?: string | null): string {
  const n = (full ?? '').trim().split(/\s+/)[0] ?? '';
  if (!n) return 'Oi';
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
}

function toIntlPhone(raw?: string | null): string {
  const d = String(raw ?? '').replace(/\D/g, '');
  if (!d || d.length < 10) return '';
  if (d.startsWith('55') && d.length >= 12) return d;
  return `55${d}`;
}

// SMS sem acento/emoji (GSM-7, custo menor) e SEM link. Estrategia 360: leva pro
// WhatsApp/e-mail, onde estao o codigo PIX e a oferta. Mensagem por toque.
function smsText(name: string, touch: number): string {
  if (touch === 2) {
    return `${name}, seu plano capilar da Juliane ainda ta te esperando! Ainda da tempo de garantir. Chama a gente no WhatsApp que a gente finaliza com voce.`;
  }
  return `${name}, ultima chamada! A Juliane preparou seu plano personalizado. Responde nosso WhatsApp hoje que a gente destrava seu acesso.`;
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

  // Candidatos: não pagaram (pending), têm PIX + telefone, já receberam o toque 1
  // (pix_sms_count >= 1, fluxo novo) e ainda não esgotaram os toques.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cands, error } = await (sb.from('profiles') as any)
    .select('id, email, full_name, phone, pagarme_pix_order_id, subscription_status, pix_sms_count, pix_sms_last_at')
    .eq('subscription_status', 'pending')
    .not('pagarme_pix_order_id', 'is', null)
    .not('phone', 'is', null)
    .gte('pix_sms_count', 1)
    .lt('pix_sms_count', MAX_TOUCHES)
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = Date.now();
  const result = { scanned: cands?.length ?? 0, sent: 0, skipped_paid: 0, skipped_window: 0, failed: 0, details: [] as unknown[] };

  for (const p of cands ?? []) {
    try {
      const count = Number(p.pix_sms_count) || 0;
      const lastAt = p.pix_sms_last_at ? new Date(p.pix_sms_last_at).getTime() : 0;
      const hoursSince = (now - lastAt) / 3_600_000;
      const nextTouch = count + 1;                                   // 2 ou 3
      const dueAfter = nextTouch === 2 ? TOUCH2_AFTER_H : TOUCH3_AFTER_H;
      if (hoursSince < dueAfter) { result.skipped_window++; continue; }

      // Confirma que NÃO pagou (o subscription_status='pending' já filtra, mas o
      // pedido é a fonte de verdade — se pagou fora do fluxo, encerra a sequência).
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const order: any = await pagarme.get(`/orders/${p.pagarme_pix_order_id}`);
        if (order?.status === 'paid') { if (!dry) await setCount(sb, p.id, MAX_TOUCHES); result.skipped_paid++; continue; }
      } catch { /* consulta falhou → segue pelo subscription_status */ }

      const phoneIntl = toIntlPhone(p.phone);
      if (phoneIntl.length < 12) { result.failed++; result.details.push({ email: p.email, err: 'bad_phone' }); continue; }

      if (dry) { result.sent++; result.details.push({ email: p.email, touch: nextTouch, hoursSince: Math.round(hoursSince), would_send: true }); continue; }

      const sendRes = await sendSms(phoneIntl, smsText(firstName(p.full_name), nextTouch));
      if (sendRes.ok) {
        await setCount(sb, p.id, nextTouch);
        result.sent++;
      } else if (sendRes.skipped) {
        result.failed++;
        result.details.push({ email: p.email, err: 'zenvia_token_missing' });
      } else {
        // NÃO incrementa → tenta de novo no próximo ciclo
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
async function setCount(sb: any, id: string, count: number) {
  await sb.from('profiles').update({ pix_sms_count: count, pix_sms_last_at: new Date().toISOString() }).eq('id', id);
}
