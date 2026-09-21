/**
 * Contato oficial da Juliane no WhatsApp — número ÚNICO do projeto.
 *
 * É o número conectado ao Chatwoot (WhatsApp Cloud API oficial, inbox
 * "WhatsApp - Juliane Cost"): toda mensagem que a cliente manda aqui cai no
 * atendimento. Usar SEMPRE esta constante — nada de número escrito à mão na
 * página, que foi como o site acabou com quatro números diferentes espalhados.
 *
 * ⚠️ Os outros números da operação (os que administram os grupos pelo
 * Evolution) NÃO aparecem para a cliente em lugar nenhum. Banimento em um
 * número de grupo não pode arrastar o canal de atendimento junto.
 *
 * Formato com o nono dígito (13 com DDI), o mesmo que o blog já publica em
 * 294 links. O registro na Cloud API aparece como 553199994001 (sem o nono) —
 * é a mesma linha: o WhatsApp normaliza o nono dígito de número brasileiro.
 */
export const JU_WHATSAPP = '5531999994001';

/** O mesmo número como a cliente lê na tela. */
export const JU_WHATSAPP_EXIBICAO = '(31) 99999-4001';

/** Link wa.me com mensagem pré-preenchida (default: dúvida sobre o plano). */
export function juWhatsappLink(
  msg = 'Oi Juliane! 💛 Tenho uma dúvida sobre o meu plano capilar e os produtos.',
): string {
  return `https://wa.me/${JU_WHATSAPP}?text=${encodeURIComponent(msg)}`;
}
