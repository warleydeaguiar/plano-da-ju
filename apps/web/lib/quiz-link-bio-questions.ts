// Link na Bio PRO — quiz de coleta pra Juliane montar a bio do cliente.
// Mesmo padrão declarativo do quiz do Plano Capilar (lib/quiz-questions.ts):
// array de steps tipados + `showIf` pra branching condicional por profissão.

import { PROFISSOES, temStepExtra } from './quiz-link-bio-profissoes';

export interface LinkBioQuizOption {
  id: string;
  label: string;
  emoji?: string;
  descricao?: string;
  /** Página de exemplo (etapa de estilo). */
  exemplo?: string;
  /** Degradê CSS da miniatura (etapa de estilo). */
  preview?: string;
}

export interface LinkBioQuizStep {
  id: string;
  kind: 'info' | 'single' | 'textarea' | 'estilo' | 'contact' | 'photo' | 'checkout';
  title: string;
  subtitle?: string;
  /** Lista "o que você recebe" (etapa info). */
  itens?: string[];
  options?: LinkBioQuizOption[];
  placeholder?: string;
  ctaText?: string;
  showIf?: (a: Record<string, string>) => boolean;
}

export const PRECO_TEXTO = 'R$ 19,90';

const PROFISSAO_OPTIONS: LinkBioQuizOption[] = Object.entries(PROFISSOES).map(([id, p]) => ({
  id,
  label: p.label,
  emoji: p.emoji,
}));

const EXEMPLO = 'https://julianecost.com';

/** Os estilos são as próprias bios da Juliane — servem de vitrine e de briefing. */
export const ESTILOS: LinkBioQuizOption[] = [
  { id: 'video', label: 'Vídeo de fundo', descricao: 'Um vídeo seu em tela cheia atrás dos botões.', exemplo: `${EXEMPLO}/bio/`, preview: 'linear-gradient(160deg,#3a2a35,#8a5a6e 55%,#d9a7b5)' },
  { id: 'editorial', label: 'Editorial', descricao: 'Elegante, estilo revista, foto em arco.', exemplo: `${EXEMPLO}/bio1/`, preview: 'linear-gradient(160deg,#f5efe6,#e8dccd 60%,#8e3b4f)' },
  { id: 'noir', label: 'Noir', descricao: 'Fundo escuro, brilho e detalhes dourados.', exemplo: `${EXEMPLO}/bio2/`, preview: 'linear-gradient(160deg,#08070b,#3b1f4a 55%,#f2c58a)' },
  { id: 'mosaico', label: 'Mosaico', descricao: 'Blocos coloridos com foto, vídeo e produtos.', exemplo: `${EXEMPLO}/bio3/`, preview: 'linear-gradient(160deg,#ffe3d3,#eadfff 50%,#d9f5e6)' },
  { id: 'livre', label: 'Escolha por mim', descricao: 'A Juliane decide o que combina mais com você.', preview: 'linear-gradient(160deg,#ff8fb1,#ee5d8a 50%,#b5398f)' },
];

export const LINK_BIO_QUIZ_STEPS: LinkBioQuizStep[] = [
  {
    id: 'intro',
    kind: 'info',
    title: 'Seu link na bio feito pela Juliane',
    subtitle: 'Do mesmo jeito que a minha: bonita, com a sua cara e com os botões certos pra quem chega do Instagram.',
    itens: [
      'Bio personalizada para a sua profissão',
      'Botões pra WhatsApp, agendamento, site, redes e o que mais precisar',
      'Você escolhe o estilo — dá pra ver exemplos no caminho',
      `Pagamento único de ${PRECO_TEXTO}, sem mensalidade`,
    ],
    ctaText: 'Quero a minha',
  },
  {
    id: 'profissao',
    kind: 'single',
    title: 'Qual é a sua área?',
    subtitle: 'Assim eu já adapto as perguntas e o estilo da sua bio.',
    options: PROFISSAO_OPTIONS,
  },

  // ── perguntas condicionais por profissão ──────────────────────────
  { id: 'nome_negocio', kind: 'textarea', title: 'Qual o nome do seu negócio?', placeholder: 'Ex.: Studio Bella Estética', showIf: (a) => temStepExtra(a.profissao, 'nome_negocio') },
  { id: 'segmento_negocio', kind: 'textarea', title: 'O que seu negócio vende ou oferece?', placeholder: 'Conte em poucas palavras', showIf: (a) => temStepExtra(a.profissao, 'segmento_negocio') },
  { id: 'oab', kind: 'textarea', title: 'Qual a sua OAB?', placeholder: 'Ex.: OAB/SP 123.456', showIf: (a) => temStepExtra(a.profissao, 'oab') },
  { id: 'areas_juridicas', kind: 'textarea', title: 'Quais áreas do direito você atua?', placeholder: 'Ex.: Família, Trabalhista, Cível', showIf: (a) => temStepExtra(a.profissao, 'areas_juridicas') },
  { id: 'crm', kind: 'textarea', title: 'Qual o seu CRM?', placeholder: 'Ex.: CRM/SP 123456', showIf: (a) => temStepExtra(a.profissao, 'crm') },
  { id: 'especialidade_medica', kind: 'textarea', title: 'Qual sua especialidade?', placeholder: 'Ex.: Dermatologia', showIf: (a) => temStepExtra(a.profissao, 'especialidade_medica') },
  { id: 'cro', kind: 'textarea', title: 'Qual o seu CRO?', placeholder: 'Ex.: CRO/SP 12345', showIf: (a) => temStepExtra(a.profissao, 'cro') },
  { id: 'especialidade_odonto', kind: 'textarea', title: 'Qual sua especialidade?', placeholder: 'Ex.: Ortodontia, Implantes', showIf: (a) => temStepExtra(a.profissao, 'especialidade_odonto') },
  { id: 'crfa', kind: 'textarea', title: 'Qual o seu CRFa?', placeholder: 'Ex.: CRFa 12345', showIf: (a) => temStepExtra(a.profissao, 'crfa') },
  { id: 'publico_atendido', kind: 'textarea', title: 'Qual público você atende?', placeholder: 'Ex.: Crianças, adultos, terceira idade', showIf: (a) => temStepExtra(a.profissao, 'publico_atendido') },
  { id: 'servicos_beleza', kind: 'textarea', title: 'Quais serviços você oferece?', placeholder: 'Ex.: Design de sobrancelha, extensão de cílios', showIf: (a) => temStepExtra(a.profissao, 'servicos_beleza') },
  { id: 'nicho_conteudo', kind: 'textarea', title: 'Qual seu nicho de conteúdo?', placeholder: 'Ex.: Moda, maternidade, finanças', showIf: (a) => temStepExtra(a.profissao, 'nicho_conteudo') },
  { id: 'area_outra', kind: 'textarea', title: 'Conte um pouco sobre o que você faz', placeholder: 'Sua área de atuação', showIf: (a) => temStepExtra(a.profissao, 'area_outra') },

  // ── contato cedo: quem desiste depois daqui ainda pode ser chamada ──
  {
    id: 'contato',
    kind: 'contact',
    title: 'Pra quem eu mando a sua bio?',
    subtitle: 'Seu nome, e-mail e WhatsApp. Você não paga nada agora.',
  },
  {
    id: 'estilo',
    kind: 'estilo',
    title: 'Qual estilo tem mais a sua cara?',
    subtitle: 'Toque em "ver exemplo" pra abrir cada uma.',
    options: ESTILOS,
  },
  {
    id: 'objetivo',
    kind: 'textarea',
    title: 'O que não pode faltar na sua bio?',
    placeholder: 'Ex.: botão de agendamento, portfólio, depoimentos…',
  },
  {
    id: 'links_redes',
    kind: 'textarea',
    title: 'Quais links você quer incluir?',
    subtitle: 'Comece pelo seu @ do Instagram. WhatsApp, site, cardápio — o que for.',
    placeholder: 'Um por linha',
  },
  {
    id: 'foto',
    kind: 'photo',
    title: 'Envie uma foto sua',
    subtitle: 'De preferência de rosto, bem iluminada — é a que vai aparecer na bio. Se não tiver agora, pode mandar depois pelo WhatsApp.',
  },
  {
    id: 'pagamento',
    kind: 'checkout',
    title: 'Último passo',
    subtitle: `Taxa única de ${PRECO_TEXTO} — sem mensalidade.`,
  },
];
