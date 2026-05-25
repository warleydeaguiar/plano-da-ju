/**
 * tracking-client — captura e persiste a identidade de tracking no navegador
 * e a envia para /api/track/identity (server-side CAPI / Advanced Matching).
 *
 * Princípios:
 *  - session_id canônico = 'checkout_session_id' (mesma chave usada em /oferta e
 *    gravada em profile.checkout_session_id no checkout). Isso permite que o
 *    webhook PagarMe (Purchase) faça o JOIN com a identidade persistida.
 *  - fbp/fbc vêm dos cookies que o Meta Pixel (fbevents.js) escreve. Se o usuário
 *    chegou com ?fbclid=... e o cookie _fbc ainda não existe, sintetizamos o fbc.
 *  - UTMs/landing/referrer são lidos da URL no primeiro toque. O servidor faz MERGE
 *    e nunca sobrescreve um valor conhecido com null, então basta reenviar.
 *  - Best-effort: nunca lança, nunca bloqueia o fluxo.
 */

const SESSION_KEY = 'checkout_session_id';

/** session_id único por visita — compartilhado com /oferta via sessionStorage */
export function getTrackingSessionId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `cs_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return `cs_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

function param(search: URLSearchParams, key: string): string | null {
  const v = search.get(key);
  return v && v.trim() ? v.trim() : null;
}

/**
 * Monta o payload de identidade a partir do estado atual do navegador.
 * Só inclui campos não-nulos (o servidor faz merge preservando o que já sabe).
 */
function collectIdentity(): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof window === 'undefined') return out;

  const search = new URLSearchParams(window.location.search);

  // Identificadores Meta (cookies do pixel)
  const fbp = readCookie('_fbp');
  if (fbp) out.fbp = fbp;

  let fbc = readCookie('_fbc');
  const fbclid = param(search, 'fbclid');
  // Sintetiza _fbc a partir do fbclid se o pixel ainda não escreveu o cookie.
  // Formato oficial: fb.<subdomainIndex>.<timestamp>.<fbclid>
  if (!fbc && fbclid) fbc = `fb.1.${Date.now()}.${fbclid}`;
  if (fbc) out.fbc = fbc;
  if (fbclid) out.fbclid = fbclid;

  // Atribuição (primeiro toque — só presente na landing)
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const) {
    const v = param(search, k);
    if (v) out[k] = v;
  }

  try {
    out.landing_url = window.location.href.slice(0, 500);
  } catch { /* ignore */ }
  if (document.referrer) out.referrer = document.referrer.slice(0, 500);

  return out;
}

function post(body: Record<string, unknown>): void {
  try {
    const payload = JSON.stringify({ session_id: getTrackingSessionId(), ...body });
    // sendBeacon sobrevive a navegações; fetch keepalive como fallback.
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track/identity', new Blob([payload], { type: 'application/json' }));
    } else {
      fetch('/api/track/identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch { /* best-effort */ }
}

/**
 * Captura a identidade atual e envia ao servidor. Roda no mount de cada página.
 * Faz uma 2ª tentativa após ~1.2s para pegar o cookie _fbp que o fbevents.js
 * escreve de forma assíncrona logo após o carregamento.
 */
export function captureIdentity(): void {
  if (typeof window === 'undefined') return;
  post(collectIdentity());
  // 2ª captura — garante fbp depois que o pixel terminou de inicializar
  window.setTimeout(() => {
    const again = collectIdentity();
    if (again.fbp || again.fbc) post(again);
  }, 1200);
}

/** Gera um event_id único para deduplicação Pixel↔CAPI. */
export function newEventId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* ignore */ }
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Espelha um evento de funil no CAPI server-side (/api/track/event) com o MESMO
 * event_id usado no fbq → o Meta deduplica e fica com a melhor qualidade.
 * Dispare logo após o fbq('track', ...) correspondente, passando o mesmo eventId.
 */
export function sendServerEvent(
  eventName: 'Lead' | 'InitiateCheckout' | 'AddPaymentInfo',
  opts: {
    eventId: string;
    value?: number;
    currency?: string;
    email?: string;
    phone?: string;
    contentName?: string;
    contentCategory?: string;
  },
): void {
  if (typeof window === 'undefined') return;
  try {
    const payload = JSON.stringify({
      session_id: getTrackingSessionId(),
      event_name: eventName,
      event_id: opts.eventId,
      event_source_url: window.location.href.slice(0, 500),
      value: opts.value,
      currency: opts.currency,
      email: opts.email,
      phone: opts.phone,
      content_name: opts.contentName,
      content_category: opts.contentCategory,
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track/event', new Blob([payload], { type: 'application/json' }));
    } else {
      fetch('/api/track/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch { /* best-effort */ }
}

/**
 * Enriquece a identidade com PII conhecida (email/telefone/cpf). Chamar quando o
 * usuário informa esses dados no quiz ou no checkout. O servidor normaliza/hasheia.
 */
export function enrichIdentity(pii: { email?: string; phone?: string; cpf?: string }): void {
  if (typeof window === 'undefined') return;
  const body: Record<string, string> = {};
  if (pii.email && pii.email.trim()) body.email = pii.email.trim();
  if (pii.phone && pii.phone.trim()) body.phone = pii.phone.trim();
  if (pii.cpf && pii.cpf.trim()) body.cpf = pii.cpf.trim();
  if (Object.keys(body).length === 0) return;
  // junta também os sinais de browser atuais (fbp/fbc) p/ reforçar o match
  post({ ...collectIdentity(), ...body });
}
