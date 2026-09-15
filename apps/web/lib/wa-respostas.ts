import { ehPedidoDeBloqueio } from '@/lib/wa-optout';

export type TipoResposta = 'botao_concluir' | 'botao_duvida' | 'bloqueio' | 'automatica' | 'recusa' | 'humana';

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

/** Classifica a mensagem que a pessoa mandou depois da mensagem de inscrição. */
export function classificarResposta(texto: unknown): TipoResposta {
  const t = normalizar(texto);
  if (t === 'quero concluir') return 'botao_concluir';
  if (t === 'tenho uma duvida') return 'botao_duvida';
  if (ehPedidoDeBloqueio(texto)) return 'bloqueio';
  if (AUTOMATICA.test(t)) return 'automatica';
  if (RECUSA.test(t)) return 'recusa';
  return 'humana';
}
