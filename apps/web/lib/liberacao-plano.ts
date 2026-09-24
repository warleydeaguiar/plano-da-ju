/**
 * Quando o plano fica visível para a cliente.
 *
 * Quem PAGOU passa pela consulta no WhatsApp: o plano nasce retido e **só abre
 * quando alguém da equipe clica em "Liberar plano" no painel**. Não existe mais
 * prazo que solta sozinho — a consulta é o produto, e um prazo automático
 * transformava a espera em mera formalidade. Quem recebeu de graça (parceria
 * UGC ou presente) não tem consulta para fazer, e o plano abre como sempre.
 *
 * Vive aqui porque vários caminhos diferentes geram, regeneram e leem o plano —
 * a regra precisa ser a mesma em todos, senão a retenção vira sorte.
 *
 * Contrato de `plan_released_at`:
 *   null                → retido, esperando a liberação manual;
 *   data no futuro      → abre sozinho naquela hora (só cortesia usa isso);
 *   data no passado     → aberto.
 */

export interface PerfilLiberacao {
  subscription_type?: string | null;
  is_gift?: boolean | null;
  plan_released_at?: string | null;
}

export function ehAcessoGratuito(perfil: PerfilLiberacao): boolean {
  return perfil?.subscription_type === 'parceria' || perfil?.is_gift === true;
}

/**
 * Momento em que o plano deve ficar visível, em ISO — ou `null` quando ele
 * depende da liberação manual (toda cliente pagante).
 */
export function liberarEm(
  perfil: PerfilLiberacao,
  esperaCortesiaMs: number,
  agora = Date.now(),
): string | null {
  if (!ehAcessoGratuito(perfil)) return null;
  return new Date(agora + esperaCortesiaMs).toISOString();
}

/**
 * O plano está visível para esta cliente agora?
 *
 * Para quem pagou, ausência de data significa RETIDO. É o contrário do que o
 * app assumia antes ("sem data = liberado"), e é justamente essa inversão que
 * garante que nenhum caminho novo de geração libere sem querer: para abrir,
 * alguém precisa ter gravado a data.
 */
export function planoVisivel(perfil: PerfilLiberacao, agora = Date.now()): boolean {
  const bruto = perfil?.plan_released_at;
  if (!bruto) return ehAcessoGratuito(perfil);
  const quando = new Date(bruto).getTime();
  return Number.isFinite(quando) ? quando <= agora : ehAcessoGratuito(perfil);
}
