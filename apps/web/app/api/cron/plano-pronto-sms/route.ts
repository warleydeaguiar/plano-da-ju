import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendSms } from '@/lib/zenvia';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/cron/plano-pronto-sms?k=<WA_AUTOREPLY_SECRET>  (ou Bearer CRON_SECRET)
 *
 * Avisa por SMS quando o plano capilar da cliente ficou PRONTO (liberado). Espelha
 * o e-mail de entrega (deliver-plans): mesma janela de 6h após plan_released_at, pra
 * não disparar retroativamente pros planos antigos. 1x por pessoa (plan_sms_sent_at).
 * SMS sem link (leva pro app) e sem acento (o sendSms já limpa). ?dry=1 = simula.
 */
const WINDOW_H = 6;

function firstName(full?: string | null): string {
  const n = (full ?? '').trim().split(/\s+/)[0] ?? '';
  if (!n) return 'Oi';
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
}
function toIntlPhone(raw?: string | null): string {
  const d = String(raw ?? '').replace(/\D/g, '');
  if (!d || d.length < 10) return '';
  return d.startsWith('55') && d.length >= 12 ? d : `55${d}`;
}
function smsText(name: string): string {
  return `${name}, seu plano capilar personalizado da Juliane ficou pronto! Abra o app Plano da Ju pra ver seu cronograma completo e comecar hoje.`;
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

  const nowIso = new Date().toISOString();
  const windowAgo = new Date(Date.now() - WINDOW_H * 3600_000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cands, error } = await (sb.from('profiles') as any)
    .select('id, email, full_name, phone, plan_released_at')
    .eq('subscription_status', 'active')
    .eq('plan_status', 'ready')
    .is('plan_sms_sent_at', null)
    .not('phone', 'is', null)
    .not('plan_released_at', 'is', null)
    .lte('plan_released_at', nowIso)
    .gte('plan_released_at', windowAgo)
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = { scanned: cands?.length ?? 0, sent: 0, failed: 0, details: [] as unknown[] };

  for (const p of cands ?? []) {
    const phoneIntl = toIntlPhone(p.phone);
    if (phoneIntl.length < 12) {
      // marca pra não travar o lote com telefone ruim
      if (!dry) await markSent(sb, p.id);
      result.failed++; result.details.push({ email: p.email, err: 'bad_phone' }); continue;
    }
    if (dry) { result.sent++; result.details.push({ email: p.email, to: phoneIntl, would_send: true }); continue; }

    const r = await sendSms(phoneIntl, smsText(firstName(p.full_name)));
    if (r.ok) { await markSent(sb, p.id); result.sent++; }
    else if (r.skipped) { result.failed++; result.details.push({ email: p.email, err: 'zenvia_token_missing' }); }
    else { result.failed++; result.details.push({ email: p.email, err: r.error }); } // não marca → retenta
  }

  return NextResponse.json({ ok: true, dry, ...result });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function markSent(sb: any, id: string) {
  await sb.from('profiles').update({ plan_sms_sent_at: new Date().toISOString() }).eq('id', id);
}
