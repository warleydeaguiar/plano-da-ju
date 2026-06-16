// Envio de mensagens pelo número OFICIAL (WhatsApp Cloud API / Graph).
// Mensagens business-initiated (fora da janela de 24h) exigem TEMPLATE aprovado
// pela Meta. Tolerante a falha — retorna {ok:false,error} em vez de lançar.
const GRAPH = 'https://graph.facebook.com/v21.0';

export async function sendWhatsAppTemplate(opts: {
  to: string;                 // número internacional (ex: 5531999999999)
  template: string;           // nome do template aprovado
  lang?: string;              // default pt_BR
  bodyParams?: string[];      // variáveis {{1}}, {{2}}... do corpo
  urlButtonParam?: string;    // sufixo dinâmico do botão URL ({{1}}), se houver
}): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.WHATSAPP_TOKEN;
  const pid = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !pid || !opts.to) return { ok: false, error: 'no_token_or_phone' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const components: any[] = [];
  if (opts.bodyParams?.length) {
    components.push({ type: 'body', parameters: opts.bodyParams.map(t => ({ type: 'text', text: t })) });
  }
  if (opts.urlButtonParam) {
    components.push({ type: 'button', sub_type: 'url', index: 0, parameters: [{ type: 'text', text: opts.urlButtonParam }] });
  }

  try {
    const res = await fetch(`${GRAPH}/${pid}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: opts.to,
        type: 'template',
        template: { name: opts.template, language: { code: opts.lang ?? 'pt_BR' }, components },
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
