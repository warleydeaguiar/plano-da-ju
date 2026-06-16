import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { pagarme } from '@/lib/pagarme/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/cron/pix-recovery?k=<WA_AUTOREPLY_SECRET>   (ou Bearer CRON_SECRET)
 *
 * Recuperação de PIX. Acha quem GEROU um PIX e ainda NÃO pagou, e — só depois
 * de alguns minutos (pra não incomodar quem paga na hora) — manda o código
 * copia-e-cola pelo número OFICIAL do WhatsApp (Cloud API), via TEMPLATE
 * aprovado pela Meta (mensagem business-initiated fora da janela de 24h).
 *
 * Janela: envia entre MIN_AGE_MIN e MAX_AGE_MIN minutos após a geração.
 *   - mais novo que MIN: ainda dá tempo de pagar sozinho → espera o próximo ciclo
 *   - mais velho que MAX: tarde demais (PIX perto de expirar) → marca p/ não reprocessar
 * Dispara no máximo 1x por pessoa (coluna profiles.pix_recovery_sent_at).
 *
 * ?dry=1 → não envia nem marca (só relata o que faria).
 */
const TEMPLATE = process.env.WHATSAPP_PIX_TEMPLATE || 'pix_recuperacao_v2';
const TEMPLATE_LANG = process.env.WHATSAPP_PIX_TEMPLATE_LANG || 'pt_BR';
const MIN_AGE_MIN = 5;
const MAX_AGE_MIN = 40;

function firstName(full?: string | null): string {
  const n = (full ?? '').trim().split(/\s+/)[0] ?? '';
  if (!n) return 'tudo bem';
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
}

// profiles.phone guarda só DDD+número (10–11 dígitos, sem país). A Graph API
// quer o número internacional → prefixa 55 quando necessário.
function toIntlPhone(raw?: string | null): string {
  const d = String(raw ?? '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('55') && d.length >= 12) return d;
  return `55${d}`;
}

async function sendPixTemplate(
  phoneIntl: string,
  name: string,
  linkToken: string,
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.WHATSAPP_TOKEN;
  const pid = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !pid) return { ok: false, error: 'no_token' };
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${pid}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phoneIntl,
        type: 'template',
        template: {
          name: TEMPLATE,
          language: { code: TEMPLATE_LANG },
          components: [
            // {{1}} do corpo = primeiro nome
            { type: 'body', parameters: [{ type: 'text', text: name }] },
            // {{1}} do botão URL = token que abre /pix/<token> (a Meta não permite
            // o código PIX numa variável de corpo; entregamos via página nossa)
            { type: 'button', sub_type: 'url', index: 0, parameters: [{ type: 'text', text: linkToken }] },
          ],
        },
      }),
    });
    if (res.ok) return { ok: true };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const j: any = await res.json().catch(() => ({}));
    return { ok: false, error: JSON.stringify(j?.error ?? j).slice(0, 300) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'fetch_failed' };
  }
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

  // Candidatos: pendente, com ordem PIX, com telefone, ainda sem recovery, e
  // atualizado recentemente (limita o set; a janela fina vem do created_at da ordem).
  const sinceIso = new Date(Date.now() - (MAX_AGE_MIN + 10) * 60_000).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cands, error } = await (sb.from('profiles') as any)
    .select('id, email, full_name, phone, pagarme_pix_order_id, subscription_status, updated_at')
    .eq('subscription_status', 'pending')
    .not('pagarme_pix_order_id', 'is', null)
    .not('phone', 'is', null)
    .is('pix_recovery_sent_at', null)
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

      // Já pago / cancelado / falho → não manda (e não reprocessa).
      if (status === 'paid') { result.skipped_paid++; continue; }
      if (status && status !== 'pending' && status !== 'waiting_payment') {
        if (!dry) await markSent(sb, p.id, `order_status:${status}`);
        result.expired++; continue;
      }

      const createdAt = order?.created_at ? new Date(order.created_at).getTime() : now;
      const ageMin = (now - createdAt) / 60_000;

      if (ageMin < MIN_AGE_MIN) { result.skipped_window++; continue; }   // novo demais — espera
      if (ageMin > MAX_AGE_MIN) {                                        // tarde demais
        if (!dry) await markSent(sb, p.id, 'too_old');
        result.expired++; continue;
      }

      const pixCode: string | undefined = order?.charges?.[0]?.last_transaction?.qr_code;
      if (!pixCode) { result.failed++; result.details.push({ email: p.email, err: 'no_qr_code' }); continue; }

      const phoneIntl = toIntlPhone(p.phone);
      if (phoneIntl.length < 12) { result.failed++; result.details.push({ email: p.email, err: 'bad_phone' }); continue; }

      if (dry) { result.sent++; result.details.push({ email: p.email, ageMin: Math.round(ageMin), would_send: true }); continue; }

      // O código vai pela página /pix/<id> (botão do template); aqui só validamos
      // que o PIX existe/está válido antes de mandar o link.
      void pixCode;
      const sendRes = await sendPixTemplate(phoneIntl, firstName(p.full_name), p.id);
      if (sendRes.ok) {
        await markSent(sb, p.id, 'sent');
        result.sent++;
      } else {
        // NÃO marca → tenta de novo no próximo ciclo (ex.: template ainda em revisão)
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
async function markSent(sb: any, id: string, _reason: string) {
  await sb.from('profiles').update({ pix_recovery_sent_at: new Date().toISOString() }).eq('id', id);
}
