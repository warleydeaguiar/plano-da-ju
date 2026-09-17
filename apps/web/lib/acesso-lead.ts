import { finalTelefone } from './wa-optout';

export type TipoAcesso = 'pago' | 'cortesia';

/**
 * Quem já tem o plano — por e-mail OU por telefone.
 *
 * A checagem por e-mail sozinha não basta: a cortesia da parceria é cadastrada
 * à mão e já veio com o e-mail errado (hormail.com, gamil.com). Nesses casos a
 * menina ganhou o plano e recebeu "finalize sua inscrição" cobrando o que era
 * dela. O telefone casa pelos 8 últimos dígitos (ignora DDI e nono dígito).
 *
 * Distingue PAGO de CORTESIA porque o motivo importa na leitura depois — não
 * contar 80 cortesias como 80 vendas.
 */
export async function acessoDosLeads(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  leads: { email?: string | null; phone?: string | null }[],
): Promise<(lead: { email?: string | null; phone?: string | null }) => TipoAcesso | null> {
  const emails = [...new Set(leads.map((l) => (l.email ?? '').toLowerCase().trim()).filter(Boolean))];
  const finais = [...new Set(leads.map((l) => finalTelefone(l.phone ?? '')).filter(Boolean))];

  const porEmail = new Map<string, TipoAcesso>();
  if (emails.length) {
    const { data } = await sb.from('profiles')
      .select('email, subscription_type')
      .in('email', emails)
      .eq('subscription_status', 'active');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const p of ((data ?? []) as any[])) {
      const e = String(p.email ?? '').toLowerCase().trim();
      const tipo: TipoAcesso = p.subscription_type === 'parceria' ? 'cortesia' : 'pago';
      if (e && !(porEmail.get(e) === 'pago')) porEmail.set(e, tipo);
    }
  }

  const porTelefone = new Map<string, TipoAcesso>();
  if (finais.length) {
    const { data, error } = await sb.rpc('leads_com_acesso', { p_finais: finais });
    // Fail-closed não serve aqui (bloquearia a régua inteira), mas o erro não
    // pode passar calado: sem esta checagem volta a cobrar cortesia.
    if (error) console.error('[acesso-lead] leads_com_acesso falhou:', error.message);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of ((data ?? []) as any[])) {
      const f = String(r.final8 ?? '');
      const tipo: TipoAcesso = r.tipo === 'cortesia' ? 'cortesia' : 'pago';
      if (f && !(porTelefone.get(f) === 'pago')) porTelefone.set(f, tipo);
    }
  }

  return (lead) => {
    const e = (lead.email ?? '').toLowerCase().trim();
    const f = finalTelefone(lead.phone ?? '');
    return (e && porEmail.get(e)) || (f && porTelefone.get(f)) || null;
  };
}
