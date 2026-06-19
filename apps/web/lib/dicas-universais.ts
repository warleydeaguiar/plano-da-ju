// Dicas universais da Ju — valem pra TODAS as clientes (extraídas do e-book
// "Cuidados Capilares — Dicas da Ju"). Conteúdo estático e reutilizável:
// aparece na aba Dicas do plano e (depois) no e-mail de plano pronto / recuperação.

export interface DicaUniversal {
  emoji: string;
  titulo: string;
  itens: string[];
}

export const DICAS_UNIVERSAIS: DicaUniversal[] = [
  {
    emoji: '🪮',
    titulo: 'Penteando o cabelo da forma certa',
    itens: [
      'Comece sempre desembaraçando pelas pontas e suba até a raiz.',
      'Use pentes de dentes largos ou escovas com cerdas macias.',
      'Evite pentear os cabelos secos, especialmente se forem cacheados ou crespos.',
      'Seja delicada: forçar o pente pode causar quebra dos fios.',
    ],
  },
  {
    emoji: '🚿',
    titulo: 'Lavagem adequada dos fios',
    itens: [
      'Lave o cabelo pelo menos 3 vezes por semana para manter o couro cabeludo limpo.',
      'Use água morna (nunca quente!) para evitar o ressecamento.',
      'Massageie o couro cabeludo com as pontas dos dedos para ativar a circulação.',
    ],
  },
  {
    emoji: '💧',
    titulo: 'Hidratação de dentro pra fora',
    itens: [
      'Beba bastante água ao longo do dia.',
      'Um corpo hidratado reflete em fios mais brilhantes e saudáveis.',
    ],
  },
  {
    emoji: '🥗',
    titulo: 'Alimentação equilibrada',
    itens: [
      'Inclua frutas, legumes, verduras e fontes de proteínas na sua rotina alimentar.',
      'Vitaminas como A, C, D, E, ferro e ômega 3 são essenciais para cabelos fortes.',
    ],
  },
  {
    emoji: '💊',
    titulo: 'Suplementação pode ajudar',
    itens: [
      'Consulte um profissional de saúde para verificar a necessidade de suplementos como biotina, colágeno ou complexo B.',
      'A suplementação correta acelera o crescimento e reduz a queda capilar.',
    ],
  },
  {
    emoji: '✂️',
    titulo: 'Cortar os fios regularmente',
    itens: [
      'Se o cabelo estiver danificado: corte a cada 3 meses.',
      'Se as pontas estiverem saudáveis: corte a cada 6 meses para manter o formato e a saúde.',
    ],
  },
  {
    emoji: '🌙',
    titulo: 'Pequenos hábitos que fazem a diferença',
    itens: [
      'Durma com fronha de cetim para evitar o atrito que causa frizz.',
      'Evite prender o cabelo molhado.',
      'Deixe o couro cabeludo respirar, evitando o uso constante de bonés e lenços.',
    ],
  },
];
