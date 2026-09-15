/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Lista de quem pediu para não receber mensagens automáticas no WhatsApp
 * oficial (tabela wa_optout, migração 022).
 *
 * A comparação é pelos 8 últimos dígitos: o lead guarda DDD+número, o WhatsApp
 * manda com 55 na frente e às vezes sem o nono dígito. Oito dígitos casam os
 * três formatos; se dois números diferentes terminarem igual, o único efeito é
 * deixar de mandar uma mensagem.
 */
export function finalTelefone(bruto: unknown): string {
  const d = String(bruto ?? '').replace(/\D/g, '');
  return d.length >= 8 ? d.slice(-8) : '';
}

/**
 * Dos telefones informados, os finais que estão bloqueados. Se a consulta
 * falhar, LANÇA: quem chama não deve enviar sem saber — escrever para quem
 * pediu para parar é pior que perder um envio.
 */
export async function telefonesBloqueados(sb: any, telefones: unknown[]): Promise<Set<string>> {
  const finais = [...new Set(telefones.map(finalTelefone).filter(Boolean))];
  if (!finais.length) return new Set();
  const { data, error } = await sb.from('wa_optout').select('final8').in('final8', finais);
  if (error) throw new Error(`wa_optout: ${error.message}`);
  return new Set(((data ?? []) as any[]).map((r) => String(r.final8)));
}

export async function registrarBloqueio(sb: any, telefone: string, origem: string): Promise<void> {
  const final8 = finalTelefone(telefone);
  if (!final8) return;
  const { error } = await sb.from('wa_optout')
    .upsert({ final8, telefone: telefone.replace(/\D/g, ''), origem }, { onConflict: 'final8', ignoreDuplicates: true });
  if (error) throw new Error(`wa_optout: ${error.message}`);
}

// A MENSAGEM INTEIRA precisa ser o pedido: "parar de cair cabelo" não é.
const PEDIDOS = new Set([
  'bloquear mensagens', 'bloquear', 'sair', 'parar', 'pare', 'stop', 'descadastrar',
  'nao quero receber mensagens', 'nao quero mais receber mensagens', 'nao quero mais mensagens',
]);

/** Texto do botão "Bloquear mensagens" ou um pedido curto equivalente. */
export function ehPedidoDeBloqueio(texto: unknown): boolean {
  const t = String(texto ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  return PEDIDOS.has(t);
}
