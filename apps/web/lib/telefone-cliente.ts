/**
 * Telefone do cliente para a cobrança.
 *
 * A Pagar.me RECUSA a ordem PIX sem telefone ("At least one customer phone is
 * required") — e a recusa é silenciosa para a cliente: a ordem nasce `failed`,
 * o QR nunca vem e a tela fica esperando. O quiz sempre coleta telefone, mas
 * quem abre a /oferta em outro aparelho (link do e-mail, do WhatsApp) chega
 * sem nada no navegador e manda vazio.
 *
 * Por isso, antes de criar a cobrança, procuramos o telefone no banco pelo
 * e-mail: primeiro o perfil, depois o lead mais recente do quiz.
 */
export async function telefoneDoCliente(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  doPedido: string | null | undefined,
  email: string | null | undefined,
): Promise<string> {
  const limpo = (v: unknown) => String(v ?? '').replace(/\D/g, '');
  const valido = (d: string) => (d.length >= 10 && d.length <= 13 ? d : '');

  const doForm = valido(limpo(doPedido));
  if (doForm) return doForm;

  const e = String(email ?? '').toLowerCase().trim();
  if (!e) return '';

  const { data: perfil } = await sb.from('profiles').select('phone').eq('email', e).maybeSingle();
  const doPerfil = valido(limpo(perfil?.phone));
  if (doPerfil) return doPerfil;

  const { data: lead } = await sb.from('wg_quiz_leads')
    .select('phone').ilike('email', e).not('phone', 'is', null)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  return valido(limpo(lead?.phone));
}
