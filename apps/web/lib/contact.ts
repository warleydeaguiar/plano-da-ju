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

/**
 * Canal de promoções da Juliane no Instagram.
 *
 * Canal de transmissão (broadcast): a cliente entra e recebe os avisos de
 * promoção sem precisar de grupo nem de o número dela ficar visível para
 * ninguém. É o convite mais barato que existe — não custa mensagem, não
 * depende de janela de 24 h e não corre risco de bloqueio como o WhatsApp.
 */
export const CANAL_IG = 'https://www.instagram.com/channel/AbbP57TAjTc3opIG/';

/**
 * Link de afiliado da Progressiva Fashion Gold na loja da Ybera.
 *
 * É para onde o quiz manda a pessoa depois de deixar os dados (25/09/2026).
 * Antes ela ia direto para o grupo de WhatsApp — e a maior parte não entrava,
 * então o caminho acabava no vazio. Agora a oferta vem primeiro, e o convite
 * do grupo vai depois por WhatsApp e e-mail, com confirmação.
 *
 * `parceiro=13925` é o código de afiliada da Juliane: sem ele a venda não é
 * atribuída. Por isso o link vive aqui, e não copiado em cada tela.
 */
export const LINK_YBERA_FASHION_GOLD =
  'https://www.ybera.com/produto/escova-progressiva-500g-ybera-fashion-gold-150264?parceiro=13925';
