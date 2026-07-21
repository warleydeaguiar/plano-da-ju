// Contato oficial da Juliane no WhatsApp — é o número conectado ao Chatwoot
// (WhatsApp Cloud API oficial, inbox "WhatsApp - Juliane Cost"). Toda mensagem
// que a cliente manda aqui cai no atendimento. Usar SEMPRE este número no app e
// nos e-mails — nada de números não-oficiais/antigos.
export const JU_WHATSAPP = '553199994001'; // +55 31 9999-4001

/** Link wa.me com mensagem pré-preenchida (default: dúvida sobre o plano). */
export function juWhatsappLink(
  msg = 'Oi Juliane! 💛 Tenho uma dúvida sobre o meu plano capilar e os produtos.',
): string {
  return `https://wa.me/${JU_WHATSAPP}?text=${encodeURIComponent(msg)}`;
}
