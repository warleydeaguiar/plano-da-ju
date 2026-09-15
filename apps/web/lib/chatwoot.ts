/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Responder dentro da conversa do Chatwoot.
 *
 * Mandar pela Graph API direto entrega a mensagem, mas ela NÃO aparece no
 * Chatwoot: a equipe veria a pergunta da cliente sem saber que já respondemos,
 * e responderia de novo.
 *
 * ⚠️ O cabeçalho precisa ser `api-access-token`, com HÍFEN. Com underline o
 * nginx descarta e o Chatwoot devolve 401 — era por isso que a API parecia
 * quebrada vista de fora.
 * ⚠️ A URL usa o display_id da conversa, que é o campo `id` do `conversation`
 * que chega no nosso webhook (Conversations::EventDataPresenter#push_data).
 */
function config() {
  const url = process.env.CHATWOOT_URL;
  const token = process.env.CHATWOOT_API_TOKEN;
  const conta = process.env.CHATWOOT_ACCOUNT_ID ?? '2';
  return url && token ? { url: url.replace(/\/+$/, ''), token, conta } : null;
}

export async function responderNoChatwoot(displayId: unknown, texto: string): Promise<boolean> {
  const c = config();
  if (!c || !displayId) return false;
  try {
    const r = await fetch(`${c.url}/api/v1/accounts/${c.conta}/conversations/${displayId}/messages`, {
      method: 'POST',
      headers: { 'api-access-token': c.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: texto, message_type: 'outgoing', private: false }),
    });
    return r.ok;
  } catch { return false; }
}

/**
 * Marca a conversa para a equipe achar. O endpoint de labels SUBSTITUI a lista,
 * então lemos as atuais antes de somar — senão marcar uma tira as outras.
 */
export async function marcarConversa(displayId: unknown, rotulo: string): Promise<boolean> {
  const c = config();
  if (!c || !displayId) return false;
  const base = `${c.url}/api/v1/accounts/${c.conta}/conversations/${displayId}/labels`;
  const h = { 'api-access-token': c.token, 'Content-Type': 'application/json' };
  try {
    const atual = await fetch(base, { headers: h }).then(r => (r.ok ? r.json() : null)).catch(() => null);
    const lista: string[] = Array.isArray(atual?.payload) ? atual.payload : [];
    if (lista.includes(rotulo)) return true;
    const r = await fetch(base, { method: 'POST', headers: h, body: JSON.stringify({ labels: [...lista, rotulo] }) });
    return r.ok;
  } catch { return false; }
}

/** Envia texto livre pelo WhatsApp oficial. Plano B quando o Chatwoot não responde. */
export async function enviarTextoWhatsApp(telefone: string, texto: string): Promise<boolean> {
  const token = process.env.WHATSAPP_TOKEN;
  const pid = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !pid || !telefone) return false;
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${pid}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', to: telefone, type: 'text',
        text: { preview_url: true, body: texto },
      }),
    });
    return r.ok;
  } catch { return false; }
}

/** Responde na conversa; se o Chatwoot falhar, manda direto pelo WhatsApp. */
export async function responder(displayId: unknown, telefone: string, texto: string): Promise<'chatwoot' | 'whatsapp' | 'falhou'> {
  if (await responderNoChatwoot(displayId, texto)) return 'chatwoot';
  return (await enviarTextoWhatsApp(telefone, texto)) ? 'whatsapp' : 'falhou';
}
