// Quiz Plano Capilar — TODAS as 32 telas exatas conforme screenshots enviados pela cliente
// Mantém os textos COMO ENVIADOS (não corrigir ortografia/acentuação)

export interface QuizOption {
  id: string;
  label: string;
  /** trecho em **bold** dentro do label (markdown) */
  /** cor do swatch (apenas para a pergunta 'cor') */
  color?: string;
}

export interface QuizStep {
  id: string;
  kind:
    | 'single'
    | 'multi'
    | 'textarea'
    | 'info'
    | 'loading'
    | 'phone'
    | 'name_email'
    | 'level'
    | 'plan_ready'
    | 'mini_testi';
  title: string;
  /** chamada introdutória (com **bold** *italic*) — só na primeira pergunta */
  intro?: string;
  /** subtítulo (info / capture / textarea / etc) */
  subtitle?: string;
  /** texto secundário (info screens longos) */
  body?: string;
  /** identificador do conteúdo de mídia (info screens) */
  media?: 'juliane_video' | 'before_after' | 'juliane_bio' | 'depoimentos';
  options?: QuizOption[];
  /** texto do CTA */
  ctaText?: string;
  /** placeholder de input (textarea/phone/name_email) */
  placeholder?: string;
}

export const QUIZ_STEPS: QuizStep[] = [
  // ── 0
  {
    id: 'tipo',
    kind: 'single',
    title: 'Qual seu tipo de cabelo',
    intro: 'Descubra o **Plano Ideal** e *personalizado* para Você Recuperar seu cabelo em **90 Dias**',
    options: [
      { id: 'crespo',   label: 'Crespo' },
      { id: 'cacheado', label: 'Cacheado' },
      { id: 'ondulado', label: 'Ondulado' },
      { id: 'liso',     label: 'Liso' },
    ],
  },
  // ── 1
  {
    id: 'cor',
    kind: 'single',
    title: 'Qual a cor do seu cabelo?',
    options: [
      { id: 'preto',          label: 'Preto',           color: '#1a1410' },
      { id: 'castanho_claro', label: 'Castanho claro',  color: '#a07550' },
      { id: 'castanho_esc',   label: 'Castanho Escuro', color: '#4a2f1f' },
      { id: 'ruivo',          label: 'Ruivo',           color: '#b04a2a' },
      { id: 'loiro',          label: 'Loiro',           color: '#d8b878' },
    ],
  },
  // ── 2
  {
    id: 'idade',
    kind: 'single',
    title: 'Qual sua idade?',
    options: [
      { id: '13_18', label: '13 a 18 anos' },
      { id: '19_30', label: '19 a 30 anos' },
      { id: '31_50', label: '31 a 50 anos' },
      { id: '51',    label: '+ de 51 anos' },
    ],
  },
  // ── 3
  {
    id: 'incomoda',
    kind: 'multi',
    title: 'O que mais te incomoda no seu cabelo hoje?',
    options: [
      { id: 'pontas', label: 'Pontas Ralas' },
      { id: 'frizz',  label: 'Frizz' },
      { id: 'cresc',  label: 'Falta de crescimento' },
      { id: 'queda',  label: 'Queda de cabelo' },
      { id: 'volume', label: 'Muito Volume' },
      { id: 'quebra', label: 'Quebradiços' },
    ],
  },
  // ── 4
  {
    id: 'quimica',
    kind: 'multi',
    title: 'Quais tipos de quimica voce fez nos ultimos 6 meses?',
    options: [
      { id: 'progressiva', label: 'Progressiva com formol' },
      { id: 'descolor',    label: 'Descolorante' },
      { id: 'tintura',     label: 'Tintura' },
      { id: 'relax',       label: 'Relaxamento' },
      { id: 'botox',       label: 'Botox ou Selagem' },
      { id: 'decap',       label: 'Decapagem' },
      { id: 'mechas',      label: 'Mechas/Luzes/' },
      { id: 'nenhuma',     label: 'Nenhuma' },
    ],
  },
  // ── 5 — info
  {
    id: 'info_juliane',
    kind: 'info',
    title: 'Planos Personalizados',
    body: 'Os planos capilares são desenvolvidos pessoalmente por mim **Juliane Cost**.\n\nFormada em Tricologia, e com anos de experiência, e muitos casos de sucesso! Você será a próxima',
    media: 'juliane_video',
    ctaText: 'Continuar',
  },
  // ── 6 — info
  {
    id: 'info_3500',
    kind: 'info',
    title: '3500 mulheres já usaram nosso plano capilar',
    body: 'Já foram avaliadas por nós e conseguiram o cabelo dos seus sonhos',
    media: 'before_after',
    ctaText: 'Continuar',
  },
  // ── 7
  {
    id: 'corte_quimico',
    kind: 'single',
    title: 'Já teve corte quimico?',
    options: [
      { id: 'sim', label: 'Sim' },
      { id: 'nao', label: 'Não' },
    ],
  },
  // ── 8
  {
    id: 'espessura',
    kind: 'single',
    title: 'Como você descreveria a espessura do seu fio?',
    options: [
      { id: 'fino',   label: 'Fino' },
      { id: 'medio',  label: 'Médio' },
      { id: 'grosso', label: 'Grosso' },
    ],
  },
  // ── 9
  {
    id: 'oleosidade',
    kind: 'single',
    title: 'Seu cabelo é mais seco, oleoso ou normal?',
    options: [
      { id: 'seco',   label: 'Seco' },
      { id: 'normal', label: 'Normal' },
      { id: 'oleoso', label: 'Oleoso' },
    ],
  },
  // ── 10
  {
    id: 'porosidade',
    kind: 'single',
    title: 'Você percebe que seu cabelo é poroso?',
    options: [
      { id: 'sim_absorve', label: 'Sim, absorve muita água e seca rápido' },
      { id: 'nao_demora',  label: 'Não, demora para absorver água' },
      { id: 'nao_sei',     label: 'Não sei' },
    ],
  },
  // ── 11
  {
    id: 'caspa',
    kind: 'single',
    title: 'Você tem caspa ou coceira no couro cabeludo?',
    options: [
      { id: 'sim_freq', label: 'Sim, frequentemente' },
      { id: 'as_vezes', label: 'Às vezes' },
      { id: 'nao',      label: 'Não' },
    ],
  },
  // ── 12
  {
    id: 'elasticidade',
    kind: 'single',
    title: 'Seus fios estão quebradiços ou elásticos?',
    options: [
      { id: 'quebradicos', label: 'Quebradicos' },
      { id: 'elasticos',   label: 'Elasticos' },
      { id: 'normais',     label: 'Normais' },
    ],
  },
  // ── 13
  {
    id: 'lavagem',
    kind: 'single',
    title: 'Com que frequência você lava o cabelo?',
    options: [
      { id: 'todo_dia', label: 'Todo dia' },
      { id: '2_3_sem',  label: '2-3 vezes por semana' },
      { id: 'menos_2',  label: 'Menos de 2 vezes por semana' },
    ],
  },
  // ── 14
  {
    id: 'calor',
    kind: 'multi',
    title: 'Você utiliza fontes de calor?',
    options: [
      { id: 'secador',  label: 'Secador' },
      { id: 'chapinha', label: 'Chapinha' },
      { id: 'babyliss', label: 'Babyliss' },
      { id: 'nenhum',   label: 'Não, não uso nenhum' },
    ],
  },
  // ── 15
  {
    id: 'cronograma',
    kind: 'single',
    title: 'Você faz cronograma capilar?',
    options: [
      { id: 'sim',     label: 'Sim' },
      { id: 'nao',     label: 'Não' },
      { id: 'nao_sei', label: 'Não sei o que é' },
    ],
  },
  // ── 16
  {
    id: 'crescimento_desigual',
    kind: 'single',
    title: 'Alguma área do cabelo tem crescimento desigual ou falhas?',
    options: [
      { id: 'sim', label: 'Sim' },
      { id: 'nao', label: 'Não' },
    ],
  },
  // ── 17
  {
    id: 'sol_piscina',
    kind: 'single',
    title: 'Você expõe seu cabelo ao sol, piscina ou mar frequentemente?',
    options: [
      { id: 'sim', label: 'Sim' },
      { id: 'nao', label: 'Não' },
    ],
  },
  // ── 18
  {
    id: 'agua',
    kind: 'single',
    title: 'Quantos litros de agua você bebe por dia?',
    options: [
      { id: '1',  label: '1 Litro' },
      { id: '2',  label: '2 Litros' },
      { id: '3',  label: '3 Litros' },
      { id: '4+', label: '4 litros ou mais' },
    ],
  },
  // ── 19
  {
    id: 'protetor',
    kind: 'single',
    title: 'Você usa protetor térmico ou solar no cabelo?',
    options: [
      { id: 'sim', label: 'Sim' },
      { id: 'nao', label: 'Não' },
    ],
  },
  // ── 20
  {
    id: 'como_plano',
    kind: 'single',
    title: 'Como você quer seu plano?',
    subtitle: 'Isso serve para que a Ju monte o plano do seu jeitinho. Pense na sua parte financeira.',
    options: [
      { id: 'sem_dinheiro',  label: 'Não posso comprar nenhum produto novo **(Caso você esteja sem dinheiro para investir)**' },
      { id: 'aproveitar',    label: 'Quero aproveitar os produtos que tenho e comprar o mínimo possível' },
      { id: 'trocar_todos',  label: 'Posso trocar todos os meus produtos **(Se a ju achar necessário)**' },
    ],
  },
  // ── 21
  {
    id: 'produtos_casa',
    kind: 'textarea',
    title: 'Quais produtos voce já tem em casa?',
    subtitle: 'Liste os produtos',
    placeholder: 'Produtos que você já tem',
    ctaText: 'Continuar',
  },
  // ── 22
  {
    id: 'cortes',
    kind: 'single',
    title: 'Com que frequência você faz cortes?',
    options: [
      { id: '1_2',         label: 'A cada 1-2 meses' },
      { id: '3_6',         label: 'A cada 3-6 meses' },
      { id: 'menos_1_ano', label: 'Menos de uma vez por ano' },
    ],
  },
  // ── 23
  {
    id: 'areas',
    kind: 'multi',
    title: 'Quais áreas do seu cabelo mais te preocupam?',
    options: [
      { id: 'couro',       label: 'Couro cabeludo' },
      { id: 'comprimento', label: 'Comprimento' },
      { id: 'pontas',      label: 'Pontas' },
    ],
  },
  // ── 24 — info bio Juliane
  {
    id: 'info_bio',
    kind: 'info',
    title: 'Quem está por trás do seu plano?',
    media: 'juliane_bio',
    ctaText: 'Continuar',
  },
  // ── 25 — info depoimentos
  {
    id: 'info_depoimentos',
    kind: 'info',
    title: 'Resultados de quem aplicou meu plano personalizado',
    media: 'depoimentos',
    ctaText: 'Também quero ter resultados',
  },
  // ── 26 — loading
  {
    id: 'loading',
    kind: 'loading',
    title: 'Analisando seu perfil com base em suas respostas',
  },
  // ── 27 — telefone
  {
    id: 'phone',
    kind: 'phone',
    title: 'Para qual número devo enviar seu plano?',
    subtitle: 'DDD + telefone...',
    placeholder: 'Digite seu telefone...',
    ctaText: 'Continuar',
  },
  // ── 28 — nome + email
  {
    id: 'name_email',
    kind: 'name_email',
    title: 'Como devo te chamar?',
    ctaText: 'Continuar',
  },
  // ── 29 — nível resultado
  {
    id: 'level',
    kind: 'level',
    title: 'O nível de cuidados e rotina com seu cabelo é',
    ctaText: 'Continuar',
  },
  // ── 30 — plano pronto
  {
    id: 'plan_ready',
    kind: 'plan_ready',
    title: 'Seu Plano está pronto',
    subtitle: 'Com base nas suas respostas, esperamos que você recupere a saúde dos seus fios, aumente o volume, tenha mais hidratação e menos oleosidade desnecessária',
    ctaText: 'Continuar',
  },
  // ── 31 — mini depoimentos
  {
    id: 'mini_testi',
    kind: 'mini_testi',
    title: 'Você será a próxima transformação',
    ctaText: 'Continuar',
  },
];

export type QuizAnswers = Record<string, string | string[]>;
