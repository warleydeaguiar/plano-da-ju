/**
 * Quando o plano fica visível para a cliente.
 *
 * Quem PAGOU passa pela consulta no WhatsApp: o plano nasce retido e a Juliane
 * solta no painel (ou o prazo solta sozinho). Quem recebeu de graça — parceria
 * UGC ou presente — não tem consulta para fazer, e o plano abre como sempre.
 *
 * Vive aqui porque três caminhos diferentes geram plano (a geração normal, o
 * cron de quem não mandou foto e o de planos travados) e a regra precisa ser a
 * mesma nos três — senão a retenção vira sorte.
 */
export const DIAS_ATE_LIBERAR_SOZINHO = 3;

export function ehAcessoGratuito(perfil: { subscription_type?: string | null; is_gift?: boolean | null }): boolean {
  return perfil?.subscription_type === 'parceria' || perfil?.is_gift === true;
}

/** Momento em que o plano deve ficar visível, em ISO. */
export function liberarEm(
  perfil: { subscription_type?: string | null; is_gift?: boolean | null },
  esperaCortesiaMs: number,
  agora = Date.now(),
): string {
  const ms = ehAcessoGratuito(perfil)
    ? esperaCortesiaMs
    : DIAS_ATE_LIBERAR_SOZINHO * 24 * 60 * 60 * 1000;
  return new Date(agora + ms).toISOString();
}
