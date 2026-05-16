// Meta Conversions API (CAPI) — eventos server-side
// Recupera 30-50% dos eventos perdidos por iOS ATT, ad blockers, Safari ITP.
// Docs: https://developers.facebook.com/docs/marketing-api/conversions-api

import crypto from 'crypto';

const PIXEL_ID = '921783859786853';
const CAPI_TOKEN = process.env.META_CAPI_ACCESS_TOKEN; // System User token

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value.toLowerCase().trim()).digest('hex');
}

interface CapiUserData {
  email?: string;
  phone?: string;       // E.164 sem '+': '5511999998888'
  firstName?: string;
  lastName?: string;
  zip?: string;
  cpf?: string;
  fbp?: string;         // _fbp cookie
  fbc?: string;         // _fbc cookie (vem do fbclid)
  ip?: string;
  userAgent?: string;
}

interface CapiCustomData {
  value: number;        // ex: 34.90
  currency: string;     // 'BRL'
  content_name?: string;
  content_category?: string;
  order_id?: string;
}

export async function sendCapiEvent(opts: {
  eventName: 'Purchase' | 'InitiateCheckout' | 'Lead' | 'AddPaymentInfo';
  eventTime?: number;            // unix seconds
  eventId?: string;              // dedup com pixel client
  eventSourceUrl?: string;
  user: CapiUserData;
  customData: CapiCustomData;
  testEventCode?: string;        // só pra teste
}) {
  if (!CAPI_TOKEN) {
    console.warn('[CAPI] META_CAPI_ACCESS_TOKEN não configurado — skip');
    return { ok: false, skipped: true };
  }

  const userData: Record<string, string | string[]> = {};
  if (opts.user.email)     userData.em = sha256(opts.user.email);
  if (opts.user.phone)     userData.ph = sha256(opts.user.phone);
  if (opts.user.firstName) userData.fn = sha256(opts.user.firstName);
  if (opts.user.lastName)  userData.ln = sha256(opts.user.lastName);
  if (opts.user.zip)       userData.zp = sha256(opts.user.zip);
  if (opts.user.cpf)       userData.external_id = sha256(opts.user.cpf);
  if (opts.user.fbp)       userData.fbp = opts.user.fbp;
  if (opts.user.fbc)       userData.fbc = opts.user.fbc;
  if (opts.user.ip)        userData.client_ip_address = opts.user.ip;
  if (opts.user.userAgent) userData.client_user_agent = opts.user.userAgent;
  userData.country = sha256('br');

  const payload = {
    data: [
      {
        event_name: opts.eventName,
        event_time: opts.eventTime ?? Math.floor(Date.now() / 1000),
        event_id: opts.eventId, // mesmo ID do pixel = dedup
        event_source_url: opts.eventSourceUrl,
        action_source: 'website',
        user_data: userData,
        custom_data: opts.customData,
      },
    ],
    ...(opts.testEventCode ? { test_event_code: opts.testEventCode } : {}),
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${CAPI_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    const data = await res.json();
    if (!res.ok) {
      console.error('[CAPI] erro:', data);
      return { ok: false, error: data };
    }
    return { ok: true, data };
  } catch (err) {
    console.error('[CAPI] exception:', err);
    return { ok: false, error: err };
  }
}
