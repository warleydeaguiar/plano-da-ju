// Copy DINÂMICA do funil por perfil de cabelo. Fonte ÚNICA: edite as frases aqui.
// A partir das respostas do quiz decide: nome do plano + argumentos + prova social
// + imagem Antes/Depois. Reforça "isso é feito EXATAMENTE pro seu caso".
//
// Nome do plano = por TIPO (crespo/cacheado/ondulado/liso), com override de LOIRA.
// Imagem Antes/Depois = pelo maior INCÔMODO/situação (loira, queda, química...).

export interface FunilCopy {
  perfil: string;         // chave interna (crespo/cacheado/ondulado/liso/loira/default)
  tipoLabel: string;      // "cabelo cacheado"
  planoNome: string;      // "Plano Cacheado dos Sonhos"
  kicker: string;         // eyebrow curto
  dor: string;            // framing da dor específica
  promessa: string;       // transformação prometida
  provaSocial: string;    // "+3.500 mulheres cacheadas..."
  argumento: string;      // o "específico > genérico"
}

const s = (v: unknown) => String(v ?? '').toLowerCase();
const arr = (v: unknown) => Array.isArray(v) ? v.map(x => s(x)) : (v != null && v !== '' ? [s(v)] : []);

// ── Copy por TIPO (edite as frases aqui) ─────────────────────────────────────
const PORTIPO: Record<string, Omit<FunilCopy, 'perfil'>> = {
  crespo: {
    tipoLabel: 'cabelo crespo',
    planoNome: 'Plano Crespo dos Sonhos',
    kicker: 'Plano pro seu cabelo crespo',
    dor: 'Crespo que resseca, encolhe e quebra não é falta de cuidado — é falta do cronograma certo pra ELE.',
    promessa: 'definição, hidratação e crescimento com força, sem quebra',
    provaSocial: '+3.500 mulheres de cabelo crespo já recuperaram os fios',
    argumento: 'Isso é pro seu crespo — não uma receita genérica que serve pra todo mundo e não resolve pra ninguém.',
  },
  cacheado: {
    tipoLabel: 'cabelo cacheado',
    planoNome: 'Plano Cacheado dos Sonhos',
    kicker: 'Plano pros seus cachos',
    dor: 'Cachos sem definição e com frizz não voltam com produto aleatório — voltam com nutrição e o cronograma do cacheado.',
    promessa: 'cachos marcados, com brilho e sem frizz',
    provaSocial: '+3.500 mulheres cacheadas já recuperaram os cachos',
    argumento: 'Isso é pros seus cachos — não uma solução genérica igual pra todo tipo de cabelo.',
  },
  ondulado: {
    tipoLabel: 'cabelo ondulado',
    planoNome: 'Plano Ondulado dos Sonhos',
    kicker: 'Plano pro seu cabelo ondulado',
    dor: 'Onda que some, raiz oleosa e ponta seca ao mesmo tempo? Ondulado pede equilíbrio — não receita de liso nem de cacho.',
    promessa: 'ondas definidas e leves, sem frizz e sem peso',
    provaSocial: '+3.500 mulheres de cabelo ondulado já recuperaram os fios',
    argumento: 'Isso é pro seu ondulado — não uma receita genérica que ignora que seu cabelo é único.',
  },
  liso: {
    tipoLabel: 'cabelo liso',
    planoNome: 'Plano Liso dos Sonhos',
    kicker: 'Plano pro seu cabelo liso',
    dor: 'Liso que engordura na raiz e resseca nas pontas não precisa de mais produto — precisa do cuidado certo pro fio liso.',
    promessa: 'raiz leve, brilho e pontas saudáveis',
    provaSocial: '+3.500 mulheres de cabelo liso já recuperaram os fios',
    argumento: 'Isso é pro seu liso — não uma solução genérica igual pra todo tipo de cabelo.',
  },
  // Override de LOIRA (cor = loiro) — público de dor altíssima
  loira: {
    tipoLabel: 'cabelo loiro',
    planoNome: 'Plano Loira dos Sonhos',
    kicker: 'Plano pro seu cabelo loiro',
    dor: 'Loiro que fica amarelado, ressecado e quebradiço não é culpa sua — é falta do cuidado certo pra cabelo descolorido.',
    promessa: 'loiro iluminado, hidratado e forte, sem quebra',
    provaSocial: '+3.500 loiras já recuperaram os fios',
    argumento: 'Isso é pro seu loiro — não uma receita genérica que ignora o que a descoloração faz no fio.',
  },
};

const DEFAULT: Omit<FunilCopy, 'perfil'> = {
  tipoLabel: 'seu cabelo',
  planoNome: 'Plano dos Sonhos',
  kicker: 'Seu plano personalizado',
  dor: 'Cabelo ressecado, sem brilho e quebrando não é falta de cuidado — é falta do cronograma certo pro SEU caso.',
  promessa: 'fios fortes, hidratados e com brilho de verdade',
  provaSocial: '+3.500 mulheres já recuperaram os fios',
  argumento: 'Isso é pro SEU cabelo — não uma solução genérica igual pra todo mundo.',
};

export function getFunilCopy(qa: Record<string, unknown> | null | undefined): FunilCopy {
  const q = qa ?? {};
  const cor = s(q.cor);
  const tipo = s(q.tipo);

  // Loira ganha de tudo (dor mais forte); senão, pelo tipo; senão, default.
  const perfil = cor.includes('loiro') ? 'loira'
    : (['crespo', 'cacheado', 'ondulado', 'liso'].includes(tipo) ? tipo : 'default');
  const base = PORTIPO[perfil] ?? DEFAULT;

  return { perfil, ...base };
}
