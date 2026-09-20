import { ehPedidoDeBloqueio } from '@/lib/wa-optout';

export type TipoResposta = 'botao_concluir' | 'botao_duvida' | 'bloqueio' | 'cortesia' | 'automatica' | 'recusa' | 'humana';

const normalizar = (texto: unknown) =>
  String(texto ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();

// Resposta automática de OUTRA empresa: metade dos leads tem WhatsApp Business
// com saudação automática, e isso chegava como "respondeu" — e virava cupom.
const AUTOMATICA = /(agradece (o )?(seu )?contato|agradecemos (o |pelo )?(seu )?(contato|interesse)|seja (muito )?bem.?vind|horario de atendimento|atendimento (e|é) de|como (podemos|posso) (te )?ajudar|ja ja (vamos|te)|mensagem automatica|fora do (nosso )?horario|retornaremos|em breve (te )?respond|estamos indisponiveis|nao estou disponivel|assim que possivel)/;

// Recusa explícita. "Estou sem condições" e "não tenho dinheiro agora" NÃO
// entram aqui de propósito: é objeção de preço, e o cupom de R$14,90 serve.
const RECUSA = /(nao quero|nao tenho interesse|nao me interessa|cancela|numero errado|nao (e|é) (da|do|meu|minha)|foi engano|nao pedi|nao fiz|para de (mandar|enviar)|me tira|golpe|spam)/;

// Menina de UGC que recebeu o plano de CORTESIA e mesmo assim foi cobrada
// ("eu ganhei o plano com a Bianca"). Acontece quando a cortesia é ativada
// depois do envio, ou com e-mail errado no cadastro. Ela não deve receber mais
// nada da régua de cobrança — e a conversa precisa de olho humano.
//
// ⚠️ Exige SEMPRE um sinal de gratuidade (ganhei / cortesia / grátis / UGC /
// permuta). Só "recebi o plano" não basta: "paguei e não recebi o plano" é
// cliente pagante reclamando de entrega, e tratá-la como cortesia seria
// responder "não é para você pagar nada" para quem já pagou.
const CORTESIA_GRATIS = /(ganhei|cortesia|gratis|gratuit|de graca|nao paguei|sem pagar|permuta|brinde|sou (ugc|creator|parceira)|fiz (o )?ugc|(com|pela|da) bianca)/;
// Se a mensagem fala em pagamento dela ou em algo que NÃO chegou, não é
// cortesia — é atendimento.
const NEGACAO_CORTESIA = /(paguei|pago|comprei|nao recebi|nao chegou|nao consigo|nao veio|nao libero|cade|cobranca|estorno|reembolso)/;

/** Classifica a mensagem que a pessoa mandou depois da mensagem de inscrição. */
export function classificarResposta(texto: unknown): TipoResposta {
  const t = normalizar(texto);
  if (t === 'quero concluir') return 'botao_concluir';
  if (t === 'tenho uma duvida') return 'botao_duvida';
  if (ehPedidoDeBloqueio(texto)) return 'bloqueio';
  if (CORTESIA_GRATIS.test(t) && !NEGACAO_CORTESIA.test(t)) return 'cortesia';
  if (AUTOMATICA.test(t)) return 'automatica';
  if (RECUSA.test(t)) return 'recusa';
  return 'humana';
}
