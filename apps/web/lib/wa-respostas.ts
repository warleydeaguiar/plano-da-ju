import { ehPedidoDeBloqueio } from '@/lib/wa-optout';

export type TipoResposta = 'botao_concluir' | 'botao_duvida' | 'botao_plano_wa' | 'botao_diagnostico' | 'botao_entrei_grupo' | 'botao_nao_entrei' | 'botao_quer_grupo' | 'bloqueio' | 'cortesia' | 'automatica' | 'recusa' | 'humana';

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
  // Botão da mensagem de compra: é a cliente pedindo o plano por aqui — e,
  // como ela é quem escreve, abre a janela de 24 h.
  if (t === 'pode enviar por aqui') return 'botao_plano_wa';
  // Botão da primeira mensagem da régua: ela pediu o diagnóstico do quiz. Quem
  // responde é a atendente — aqui só abrimos a janela e marcamos a fila.
  if (t === 'quero meu diagnostico') return 'botao_diagnostico';
  // Botões da confirmação de entrada no grupo. Qualquer um dos dois é uma
  // mensagem DELA: abre a janela de 24 h, e é dentro dela que a conversa sobre
  // o cabelo acontece — em texto livre, sem template e sem custo por mensagem.
  // Confirmação da vaga: o convite não manda o link de cara, pergunta antes.
  // Quem toca aqui está pedindo o link — e o toque abre a janela de 24 h.
  if (t === 'quero entrar no grupo') return 'botao_quer_grupo';
  if (t === 'consegui entrar') return 'botao_entrei_grupo';
  if (t === 'nao consegui entrar') return 'botao_nao_entrei';
  if (t === 'tenho uma duvida') return 'botao_duvida';
  if (ehPedidoDeBloqueio(texto)) return 'bloqueio';
  if (CORTESIA_GRATIS.test(t) && !NEGACAO_CORTESIA.test(t)) return 'cortesia';
  if (AUTOMATICA.test(t)) return 'automatica';
  if (RECUSA.test(t)) return 'recusa';
  return 'humana';
}
