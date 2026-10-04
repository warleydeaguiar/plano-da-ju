// Link na Bio PRO — quiz de coleta pra Juliane montar a bio do cliente.
// Mesmo padrão declarativo do quiz do Plano Capilar (lib/quiz-questions.ts):
// array de steps tipados + `showIf` pra branching condicional por profissão.

import { PROFISSOES, temStepExtra } from './quiz-link-bio-profissoes';

export interface LinkBioQuizOption {
  id: string;
  label: string;
  emoji?: string;
}

export interface LinkBioQuizStep {
  id: string;
  kind: 'info' | 'single' | 'textarea' | 'photo' | 'contact' | 'checkout';
  title: string;
  subtitle?: string;
  options?: LinkBioQuizOption[];
  placeholder?: string;
  ctaText?: string;
  /** Opcional: deixa a resposta de texto pular se não for obrigatória. */
  obrigatorio?: boolean;
  showIf?: (a: Record<string, string>) => boolean;
}

const PROFISSAO_OPTIONS: LinkBioQuizOption[] = Object.entries(PROFISSOES).map(([id, p]) => ({
  id,
  label: p.label,
  emoji: p.emoji,
}));

export const LINK_BIO_QUIZ_STEPS: LinkBioQuizStep[] = [
  {
    id: 'intro',
    kind: 'info',
    title: 'Vamos criar o seu Link na Bio',
    subtitle:
      'Em poucos minutos eu monto uma bio bonita e profissional pra você, do jeito que a minha faz sucesso. Só preciso te conhecer um pouco.',
    ctaText: 'Começar',
  },
  {
    id: 'profissao',
    kind: 'single',
    title: 'Qual é a sua área?',
    subtitle: 'Assim eu já adapto as perguntas e o estilo da sua bio.',
    options: PROFISSAO_OPTIONS,
  },

  // ── perguntas condicionais por profissão ──────────────────────────
  {
    id: 'nome_negocio',
    kind: 'textarea',
    title: 'Qual o nome do seu negócio?',
    placeholder: 'Ex.: Studio Bella Estética',
    showIf: (a) => temStepExtra(a.profissao, 'nome_negocio'),
  },
  {
    id: 'segmento_negocio',
    kind: 'textarea',
    title: 'O que seu negócio vende ou oferece?',
    placeholder: 'Conte em poucas palavras',
    showIf: (a) => temStepExtra(a.profissao, 'segmento_negocio'),
  },
  {
    id: 'oab',
    kind: 'textarea',
    title: 'Qual a sua OAB?',
    placeholder: 'Ex.: OAB/SP 123.456',
    showIf: (a) => temStepExtra(a.profissao, 'oab'),
  },
  {
    id: 'areas_juridicas',
    kind: 'textarea',
    title: 'Quais áreas do direito você atua?',
    placeholder: 'Ex.: Família, Trabalhista, Cível',
    showIf: (a) => temStepExtra(a.profissao, 'areas_juridicas'),
  },
  {
    id: 'crm',
    kind: 'textarea',
    title: 'Qual o seu CRM?',
    placeholder: 'Ex.: CRM/SP 123456',
    showIf: (a) => temStepExtra(a.profissao, 'crm'),
  },
  {
    id: 'especialidade_medica',
    kind: 'textarea',
    title: 'Qual sua especialidade?',
    placeholder: 'Ex.: Dermatologia',
    showIf: (a) => temStepExtra(a.profissao, 'especialidade_medica'),
  },
  {
    id: 'cro',
    kind: 'textarea',
    title: 'Qual o seu CRO?',
    placeholder: 'Ex.: CRO/SP 12345',
    showIf: (a) => temStepExtra(a.profissao, 'cro'),
  },
  {
    id: 'especialidade_odonto',
    kind: 'textarea',
    title: 'Qual sua especialidade?',
    placeholder: 'Ex.: Ortodontia, Implantes',
    showIf: (a) => temStepExtra(a.profissao, 'especialidade_odonto'),
  },
  {
    id: 'crfa',
    kind: 'textarea',
    title: 'Qual o seu CRFa?',
    placeholder: 'Ex.: CRFa 12345',
    showIf: (a) => temStepExtra(a.profissao, 'crfa'),
  },
  {
    id: 'publico_atendido',
    kind: 'textarea',
    title: 'Qual público você atende?',
    placeholder: 'Ex.: Crianças, adultos, terceira idade',
    showIf: (a) => temStepExtra(a.profissao, 'publico_atendido'),
  },
  {
    id: 'servicos_beleza',
    kind: 'textarea',
    title: 'Quais serviços você oferece?',
    placeholder: 'Ex.: Design de sobrancelha, extensão de cílios',
    showIf: (a) => temStepExtra(a.profissao, 'servicos_beleza'),
  },
  {
    id: 'nicho_conteudo',
    kind: 'textarea',
    title: 'Qual seu nicho de conteúdo?',
    placeholder: 'Ex.: Moda, maternidade, finanças',
    showIf: (a) => temStepExtra(a.profissao, 'nicho_conteudo'),
  },
  {
    id: 'area_outra',
    kind: 'textarea',
    title: 'Conte um pouco sobre o que você faz',
    placeholder: 'Sua área de atuação',
    showIf: (a) => temStepExtra(a.profissao, 'area_outra'),
  },

  // ── perguntas gerais (todas as profissões) ────────────────────────
  {
    id: 'objetivo',
    kind: 'textarea',
    title: 'O que você mais quer que apareça na sua bio?',
    placeholder: 'Ex.: botão de agendamento, portfólio, depoimentos...',
  },
  {
    id: 'links_redes',
    kind: 'textarea',
    title: 'Quais links você quer incluir?',
    subtitle: 'Instagram, WhatsApp, site, cardápio, o que for.',
    placeholder: 'Cole os links aqui, um por linha',
  },
  {
    id: 'foto',
    kind: 'photo',
    title: 'Envie uma foto sua',
    subtitle: 'De preferência uma foto de rosto, bem iluminada — é a que vai aparecer na sua bio.',
  },
  {
    id: 'contato',
    kind: 'contact',
    title: 'Quase lá! Seus dados de contato',
    subtitle: 'Pra eu te enviar a bio prontinha.',
  },
  {
    id: 'pagamento',
    kind: 'checkout',
    title: 'Finalizar pedido',
    subtitle: 'Taxa única de R$ 19,90 — sem mensalidade.',
  },
];
