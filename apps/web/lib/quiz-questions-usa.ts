// Quiz Plano Capilar — versão EUA (brasileiras morando nos Estados Unidos).
//
// Reaproveita TODAS as perguntas de diagnóstico do quiz brasileiro (mesmo motor,
// mesmas respostas → o plano é gerado igual) e troca só as telas de COPY, que é
// onde mora o argumento de venda. As dores específicas desse público:
//   • não sabe QUAL produto comprar nos EUA (prateleira gigante, marcas que ela
//     não conhece, e o que ela usava no Brasil não existe lá)
//   • a ÁGUA americana (dura, com muito cálcio/cloro) que resseca e opaca o fio
//   • as amigas americanas e latinas perguntando o que ela usa no cabelo
import { QUIZ_STEPS, type QuizStep } from './quiz-questions';

/** Slug próprio — mantém as métricas do funil EUA separadas do Brasil. */
export const USA_QUIZ_SLUG = 'plano-capilar-usa';

// Telas de copy reescritas para o público dos EUA (mesmos ids do quiz BR, pra
// não quebrar o motor nem a leitura das respostas).
const USA_OVERRIDES: Record<string, Partial<QuizStep>> = {
  info_juliane: {
    title: 'Feito para brasileiras que moram nos EUA',
    body: 'Os planos capilares são desenvolvidos pessoalmente por mim, **Juliane Cost**.\n\nEu sei exatamente a dificuldade que é cuidar do cabelo morando fora: prateleira cheia de marca que você não conhece, o produto que você usava no Brasil não existe aí, e ninguém te explica o que serve pro SEU fio.\n\nPor isso o seu plano só indica **produtos fáceis de comprar nos Estados Unidos** — dos que você acha no mercado, na farmácia ou na Amazon.',
  },
  info_3500: {
    title: 'A água daí está acabando com o seu cabelo',
    body: 'E ninguém te avisou: a **água dos Estados Unidos é dura** — cheia de cálcio, magnésio e cloro. Ela deixa um resíduo no fio que vai deixando o cabelo opaco, áspero, ressecado e embaraçado, por mais que você lave.\n\nÉ por isso que tanta brasileira sente o cabelo mudar depois que se muda. **Não é o seu cabelo que piorou — é a água.**\n\nNo seu plano eu te mostro exatamente como neutralizar isso com o que você encontra aí.',
  },
  info_bio: {
    title: 'Quem vai cuidar do seu cabelo daí',
    body: 'Tricologista, com anos de experiência e mais de 2.800 mulheres atendidas — muitas delas morando fora do Brasil.\n\nEu monto o seu plano olhando a sua foto e as suas respostas, e indico o que comprar **aí nos Estados Unidos**, com opção mais em conta.',
  },
  // Nos EUA as canetas são MUITO mais difundidas e as marcas são outras
  // (Wegovy e Zepbound quase não existem no Brasil). Compound/telehealth também
  // é comum lá, então entra como opção.
  caneta_emagrecedora: {
    title: 'Você está usando alguma caneta emagrecedora?',
    subtitle: 'Como Ozempic, Wegovy, Mounjaro, Zepbound ou compounded. Fica entre nós — é só pra eu entender o seu caso. 💗',
  },
  info_depoimentos: {
    title: 'Brasileiras nos EUA que recuperaram o cabelo',
    body: '"Me mudei pra Flórida e meu cabelo virou palha. Produto barato aí tem de monte, mas eu não sabia o que comprar — e ninguém fala da água. Depois do plano da Ju mudou tudo. Agora as americanas e as latinas do trabalho vivem me perguntando qual produto eu uso." — **Camila, Orlando/FL**\n\n"Passei um ano comprando errado no Target e jogando dinheiro fora. A Ju me disse exatamente o que pegar e como resolver a questão da água. Meu cabelo voltou a ter brilho." — **Fernanda, Boston/MA**',
    ctaText: 'Também quero ter resultados',
  },
};

/** Perguntas do quiz EUA = as mesmas do BR, com as telas de copy trocadas. */
export const USA_QUIZ_STEPS: QuizStep[] = QUIZ_STEPS.map(step => {
  const ov = USA_OVERRIDES[step.id];
  return ov ? { ...step, ...ov } : step;
});
