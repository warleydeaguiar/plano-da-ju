// Zenvia SMS — envio transacional (recuperação de PIX não pago).
// Docs: https://zenvia.github.io/zenvia-openapi-spec/v2/  (POST /v2/channels/sms/messages)
//
// `from` = identificação do remetente configurada na conta Zenvia (env ZENVIA_SMS_FROM).
// `to`   = número internacional sem '+' (ex.: 5531999998888).
//
// SMS é cobrado por segmento de 160 chars (GSM-7). Mantemos o texto SEM acento
// e SEM emoji de propósito: acento/emoji forçam UCS-2 (70 chars/segmento) e dobram o custo.

const ZENVIA_TOKEN = process.env.ZENVIA_API_TOKEN;
const ZENVIA_FROM = process.env.ZENVIA_SMS_FROM || 'PlanoDaJu';

export interface SmsResult {
  ok: boolean;
  id?: string;
  error?: string;
  skipped?: boolean;
}

export async function sendSms(toIntl: string, text: string): Promise<SmsResult> {
  if (!ZENVIA_TOKEN) {
    console.warn('[zenvia] ZENVIA_API_TOKEN não configurado — skip');
    return { ok: false, skipped: true };
  }
  if (!toIntl || toIntl.replace(/\D/g, '').length < 12) {
    return { ok: false, error: 'bad_phone' };
  }
  try {
    const res = await fetch('https://api.zenvia.com/v2/channels/sms/messages', {
      method: 'POST',
      headers: { 'X-API-TOKEN': ZENVIA_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: ZENVIA_FROM,
        to: toIntl.replace(/\D/g, ''),
        contents: [{ type: 'text', text }],
      }),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const j: any = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, id: j?.id };
    return { ok: false, error: JSON.stringify(j).slice(0, 300) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'fetch_failed' };
  }
}
