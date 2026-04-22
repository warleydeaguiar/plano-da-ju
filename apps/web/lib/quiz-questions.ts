export interface QuizOption {
  label: string;
  value: string;
  icon?: string;
}

export interface QuizStep {
  id: string;
  type: 'single' | 'multi' | 'scale' | 'text' | 'loading' | 'result';
  question: string;
  subtitle?: string;
  options?: QuizOption[];
  min?: number;
  max?: number;
  placeholder?: string;
}

export const QUIZ_STEPS: QuizStep[] = [
  // Step 0 — Hair type (also shown on landing)
  {
    id: 'hair_type',
    type: 'single',
    question: 'Qual o seu tipo de cabelo?',
    options: [
      { label: 'Crespo', value: 'crespo', icon: '🌀' },
      { label: 'Cacheado', value: 'cacheado', icon: '🫧' },
      { label: 'Ondulado', value: 'ondulado', icon: '〜' },
      { label: 'Liso', value: 'liso', icon: '➖' },
    ],
  },
  // Step 1 — Length
  {
    id: 'hair_length',
    type: 'single',
    question: 'Qual o comprimento do seu cabelo?',
    options: [
      { label: 'Curto (até o queixo)', value: 'curto', icon: '✂️' },
      { label: 'Médio (ombro)', value: 'medio', icon: '〰️' },
      { label: 'Longo (abaixo do ombro)', value: 'longo', icon: '💇‍♀️' },
      { label: 'Muito longo (cintura+)', value: 'muito_longo', icon: '🌿' },
    ],
  },
  // Step 2 — Texture / volume
  {
    id: 'hair_density',
    type: 'single',
    question: 'Seu cabelo é…',
    options: [
      { label: 'Fino e sem volume', value: 'fino', icon: '🪶' },
      { label: 'Normal', value: 'normal', icon: '💆‍♀️' },
      { label: 'Grosso e com volume', value: 'grosso', icon: '💥' },
    ],
  },
  // Step 3 — Porosity
  {
    id: 'porosity',
    type: 'single',
    question: 'Como você descreveria a porosidade do seu cabelo?',
    subtitle: 'Jogue um fio de cabelo num copo d\'água: se afunda rápido = alta; flutua = baixa; fica no meio = normal',
    options: [
      { label: 'Alta porosidade (absorve tudo)', value: 'alta', icon: '🌊' },
      { label: 'Média porosidade', value: 'media', icon: '💧' },
      { label: 'Baixa porosidade (repele água)', value: 'baixa', icon: '🛡️' },
      { label: 'Não sei', value: 'nao_sei', icon: '🤷‍♀️' },
    ],
  },
  // Step 4 — Chemicals
  {
    id: 'chemical_history',
    type: 'single',
    question: 'Seu cabelo tem alguma química?',
    options: [
      { label: 'Não, é virgem', value: 'virgem', icon: '✨' },
      { label: 'Coloração', value: 'colorida', icon: '🎨' },
      { label: 'Descoloração / luzes', value: 'descolorida', icon: '⚡' },
      { label: 'Alisamento / progressiva', value: 'alisada', icon: '💈' },
      { label: 'Permanente', value: 'permanente', icon: '〰️' },
    ],
  },
  // Step 5 — Main problems
  {
    id: 'main_problems',
    type: 'multi',
    question: 'Quais os maiores problemas do seu cabelo? (pode marcar mais de um)',
    options: [
      { label: 'Ressecamento', value: 'ressecamento', icon: '🏜️' },
      { label: 'Frizz', value: 'frizz', icon: '⚡' },
      { label: 'Queda excessiva', value: 'queda', icon: '😢' },
      { label: 'Falta de brilho', value: 'sem_brilho', icon: '🌑' },
      { label: 'Quebra / pontas duplas', value: 'quebra', icon: '✂️' },
      { label: 'Oleosidade', value: 'oleosidade', icon: '💦' },
      { label: 'Caspa / couro sensível', value: 'caspa', icon: '❄️' },
      { label: 'Crescimento lento', value: 'crescimento_lento', icon: '🐢' },
    ],
  },
  // Step 6 — Scalp
  {
    id: 'scalp_type',
    type: 'single',
    question: 'Como é seu couro cabeludo?',
    options: [
      { label: 'Normal', value: 'normal', icon: '😊' },
      { label: 'Oleoso', value: 'oleoso', icon: '💦' },
      { label: 'Seco / com descamação', value: 'seco', icon: '🏜️' },
      { label: 'Sensível / com coceira', value: 'sensivel', icon: '😬' },
    ],
  },
  // Step 7 — Wash frequency
  {
    id: 'wash_frequency',
    type: 'single',
    question: 'Com que frequência você lava o cabelo?',
    options: [
      { label: 'Todo dia', value: 'diario', icon: '📅' },
      { label: 'A cada 2-3 dias', value: '2_3_dias', icon: '📆' },
      { label: 'Uma vez por semana', value: 'semanal', icon: '🗓️' },
      { label: 'A cada 10+ dias', value: '10_dias', icon: '⏳' },
    ],
  },
  // Step 8 — Heat usage
  {
    id: 'heat_usage',
    type: 'single',
    question: 'Você usa calor no cabelo (secador, chapinha, babyliss)?',
    options: [
      { label: 'Sim, com frequência', value: 'frequente', icon: '🔥' },
      { label: 'Às vezes', value: 'as_vezes', icon: '♨️' },
      { label: 'Raramente', value: 'raramente', icon: '❄️' },
      { label: 'Nunca', value: 'nunca', icon: '🚫' },
    ],
  },
  // Step 9 — Current routine
  {
    id: 'current_routine',
    type: 'single',
    question: 'Você já segue alguma rotina capilar?',
    options: [
      { label: 'Sim, faço rotina completa', value: 'rotina_completa', icon: '✅' },
      { label: 'Faço parcialmente', value: 'parcial', icon: '🔄' },
      { label: 'Estou começando agora', value: 'comecando', icon: '🌱' },
      { label: 'Não faço nenhuma rotina', value: 'nenhuma', icon: '❌' },
    ],
  },
  // Step 10 — Products currently used
  {
    id: 'products_used',
    type: 'multi',
    question: 'Quais produtos você já usa? (pode marcar mais de um)',
    options: [
      { label: 'Shampoo comum', value: 'shampoo', icon: '🧴' },
      { label: 'Condicionador', value: 'condicionador', icon: '💧' },
      { label: 'Máscara de hidratação', value: 'mascara', icon: '🫙' },
      { label: 'Leave-in', value: 'leave_in', icon: '✨' },
      { label: 'Óleo capilar', value: 'oleo', icon: '💛' },
      { label: 'Finalizador', value: 'finalizador', icon: '💨' },
      { label: 'Shampoo lowpoo / sem sulfato', value: 'lowpoo', icon: '🌿' },
      { label: 'Nenhum específico', value: 'nenhum', icon: '❓' },
    ],
  },
  // Step 11 — Budget
  {
    id: 'budget_range',
    type: 'single',
    question: 'Qual seu orçamento mensal para produtos capilares?',
    options: [
      { label: 'Até R$50', value: 'baixo', icon: '💚' },
      { label: 'R$50 a R$150', value: 'medio', icon: '💛' },
      { label: 'Acima de R$150', value: 'alto', icon: '💎' },
    ],
  },
  // Step 12 — Goal
  {
    id: 'main_goal',
    type: 'single',
    question: 'Qual seu principal objetivo com o cabelo?',
    options: [
      { label: 'Recuperar a hidratação', value: 'hidratacao', icon: '💧' },
      { label: 'Reduzir o frizz', value: 'anti_frizz', icon: '✨' },
      { label: 'Parar a queda', value: 'anti_queda', icon: '🛡️' },
      { label: 'Crescer mais rápido', value: 'crescimento', icon: '📏' },
      { label: 'Definir os cachos', value: 'definicao', icon: '🌀' },
      { label: 'Recuperar o brilho', value: 'brilho', icon: '⭐' },
    ],
  },
  // Step 13 — Age
  {
    id: 'age_range',
    type: 'single',
    question: 'Qual a sua faixa etária?',
    options: [
      { label: '18–24 anos', value: '18_24', icon: '🌸' },
      { label: '25–34 anos', value: '25_34', icon: '💫' },
      { label: '35–44 anos', value: '35_44', icon: '🌺' },
      { label: '45+ anos', value: '45_mais', icon: '🌟' },
    ],
  },
  // Step 14 — Name
  {
    id: 'name',
    type: 'text',
    question: 'Qual é o seu nome?',
    subtitle: 'Para personalizarmos seu plano',
    placeholder: 'Seu primeiro nome',
  },
  // Step 15 — Email
  {
    id: 'email',
    type: 'text',
    question: 'Qual é o seu e-mail?',
    subtitle: 'Para enviarmos seu plano personalizado',
    placeholder: 'seu@email.com.br',
  },
  // Step 16 — Loading / AI analysis
  {
    id: 'loading',
    type: 'loading',
    question: 'Analisando seu perfil capilar…',
    subtitle: 'A Juliane está revisando suas respostas',
  },
  // Step 17 — Result / Offer
  {
    id: 'result',
    type: 'result',
    question: 'Seu diagnóstico está pronto!',
  },
];

export type QuizAnswers = Record<string, string | string[]>;
