/**
 * WhatsApp de atendimento da Juliane.
 *
 * A compra dos produtos passa por aqui, não pelo link de afiliado direto: ela
 * prefere atender, entender o cabelo da pessoa e mandar o link com desconto
 * adicional. Para um produto de química capilar isso é mais do que venda —
 * é a chance de evitar que a cliente compre a coisa errada para o fio dela.
 *
 * O número vive só neste arquivo. O conteúdo importado do WordPress trazia
 * QUATRO números diferentes espalhados em 14 páginas, um deles até malformado
 * (`553171445597`, com um dígito a menos), e todos apontando para telefones
 * que não são mais atendidos.
 */
export const WHATSAPP_NUMERO = '5531999994001';

/**
 * Link de conversa já com a mensagem escrita.
 *
 * Quem chega precisa só apertar enviar: no celular, qualquer texto a mais
 * entre o clique e a mensagem é gente que desiste no meio.
 */
export function linkWhatsApp(mensagem: string): string {
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensagem)}`;
}

/** Mensagem que já diz qual produto a pessoa estava vendo. */
export function mensagemDoProduto(nomeDoProduto: string): string {
  return (
    `Oi, tudo bem? Estou interessada no produto ${nomeDoProduto}. ` +
    'Você poderia me enviar o link para comprar com desconto adicional?'
  );
}

export function linkDoProduto(nomeDoProduto: string): string {
  return linkWhatsApp(mensagemDoProduto(nomeDoProduto));
}
