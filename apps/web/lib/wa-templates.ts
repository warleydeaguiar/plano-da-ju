/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * O template está APROVADO **e** na categoria UTILITY?
 *
 * Existe porque a Meta aprova em categoria diferente da pedida, sem avisar: a
 * v3 da mensagem de inscrição foi pedida como UTILITY e aprovada como
 * MARKETING, que custa ~9× mais (US$ 0,0625 contra US$ 0,0068 por mensagem no
 * Brasil). Sem esta checagem, o cron passaria a gastar ~R$ 4.400/mês no lugar
 * de ~R$ 480, e ninguém perceberia até a fatura.
 *
 * Resposta guardada por 10 minutos: o cron roda a cada 5 e não precisa
 * perguntar à Meta a cada envio.
 */
const cache = new Map<string, { ate: number; ok: boolean }>();

export async function templateUtilitarioAprovado(nome: string): Promise<boolean> {
  const agora = Date.now();
  const guardado = cache.get(nome);
  if (guardado && guardado.ate > agora) return guardado.ok;

  const token = process.env.WHATSAPP_TOKEN;
  const waba = process.env.WHATSAPP_WABA_ID || '616707188181921';
  let ok = false;
  if (token) {
    try {
      const r = await fetch(
        `https://graph.facebook.com/v21.0/${waba}/message_templates`
        + `?fields=name,status,category&limit=100&access_token=${encodeURIComponent(token)}`,
        { next: { revalidate: 0 } },
      );
      const j: any = await r.json();
      const t = (j?.data ?? []).find((x: any) => x?.name === nome);
      ok = t?.status === 'APPROVED' && t?.category === 'UTILITY';
    } catch { ok = false; }
  }
  cache.set(nome, { ate: agora + 10 * 60_000, ok });
  return ok;
}
