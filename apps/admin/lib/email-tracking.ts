/**
 * Helpers de tracking de email — pixel de abertura e link rewrite p/ cliques.
 *
 * Como funciona:
 *  1) Antes de enviar, INSERT em wg_email_sends com status='pending' → ganha um send_id
 *  2) injectTracking() injeta:
 *     - <img> 1x1 invisível apontando p/ /api/email/track/open?s={sendId}&sig=...
 *     - Reescreve todos os href HTTP(S) p/ /api/email/track/click?s={sendId}&u=...&sig=...
 *  3) Envia o HTML modificado via SES
 *  4) UPDATE wg_email_sends com message_id + status='sent' (ou 'error')
 *
 * Segurança: HMAC com EMAIL_TRACKING_SECRET previne tampering nos links
 * (sem isso, qualquer um redirecionaria pra qualquer URL).
 *
 * Caveats conhecidos:
 *  - Gmail/Apple Mail Privacy fazem pré-fetch de imagens server-side,
 *    inflando opens. Sempre apontar isso no UI ("opens incluem
 *    Mail Privacy do Apple/Gmail").
 *  - Clientes que bloqueiam imagens externas (Outlook desktop, alguns
 *    corporativos) não contam abertura.
 */

import { createHmac } from 'crypto'

const TRACKING_DOMAIN = process.env.EMAIL_TRACKING_DOMAIN
  ?? 'https://planodaju.julianecost.com'
const SECRET = process.env.EMAIL_TRACKING_SECRET ?? ''

/** Assina uma string com HMAC-SHA256 → retorna primeiros 16 chars hex (96 bits). */
export function signTracking(payload: string): string {
  if (!SECRET) return '' // sem secret, sai vazio — endpoint não exige (modo dev)
  return createHmac('sha256', SECRET).update(payload).digest('hex').slice(0, 16)
}

export function verifyTracking(payload: string, sig: string): boolean {
  if (!SECRET) return true // dev mode sem secret → aceita tudo
  const expected = signTracking(payload)
  return expected === sig
}

/**
 * Codifica URL em base64url (sem padding, URL-safe).
 * Usamos base64url em vez de encodeURIComponent porque o resultado
 * fica mais compacto e não tem chars que precisam ser escapados.
 */
function b64UrlEncode(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** URL absoluta do pixel de abertura. */
export function pixelUrl(sendId: string): string {
  const sig = signTracking(`open:${sendId}`)
  const sigParam = sig ? `&sig=${sig}` : ''
  return `${TRACKING_DOMAIN}/api/email/track/open?s=${sendId}${sigParam}`
}

/** URL absoluta do click tracker que redireciona pro destino. */
export function trackedLinkUrl(sendId: string, destination: string): string {
  const u = b64UrlEncode(destination)
  const sig = signTracking(`click:${sendId}:${destination}`)
  const sigParam = sig ? `&sig=${sig}` : ''
  return `${TRACKING_DOMAIN}/api/email/track/click?s=${sendId}&u=${u}${sigParam}`
}

/**
 * Injeta o tracking pixel no HTML.
 * - Antes de </body> se existir, senão no final do HTML
 */
function injectPixel(html: string, sendId: string): string {
  const pixel = `<img src="${pixelUrl(sendId)}" width="1" height="1" alt="" style="display:none !important;border:0;outline:0;line-height:0" />`
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${pixel}</body>`)
  }
  return html + pixel
}

/**
 * Reescreve todos os href="http(s)://..." pro click tracker.
 * - Pula: mailto:, tel:, anchors (#), javascript:
 * - Pula links que apontam pro tracking domain (já são nossos)
 * - Pula unsubscribe links (qualquer URL com /unsubscribe)
 */
function rewriteLinks(html: string, sendId: string): string {
  return html.replace(/href="(https?:\/\/[^"]+)"/gi, (match, url: string) => {
    // Pula nossos próprios links de tracking (evita loop infinito)
    if (url.startsWith(TRACKING_DOMAIN + '/api/email/track')) return match
    // Pula unsubscribe
    if (/\/unsubscribe/i.test(url)) return match
    // Pula anchors internos
    if (url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:')) return match
    return `href="${trackedLinkUrl(sendId, url)}"`
  })
}

/** Injeta pixel + reescreve links em uma só passada. */
export function injectTracking(html: string, sendId: string): string {
  return injectPixel(rewriteLinks(html, sendId), sendId)
}
