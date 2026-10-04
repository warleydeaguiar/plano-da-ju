// Link na Bio PRO — catálogo de profissões/áreas.
//
// Adicionar uma profissão nova = uma entrada aqui + os steps correspondentes
// em `quiz-link-bio-questions.ts` (cada step condicional usa `temStepExtra`
// pra decidir se aparece) — sem mexer na navegação do quiz.

export interface ProfissaoInfo {
  label: string;
  emoji: string;
  /** ids dos steps extras (em quiz-link-bio-questions.ts) que só aparecem pra essa profissão */
  stepsExtra: string[];
}

export const PROFISSOES: Record<string, ProfissaoInfo> = {
  empresario: { label: 'Empresário(a)', emoji: '💼', stepsExtra: ['nome_negocio', 'segmento_negocio'] },
  advogado: { label: 'Advogado(a)', emoji: '⚖️', stepsExtra: ['oab', 'areas_juridicas'] },
  medico: { label: 'Médico(a)', emoji: '🩺', stepsExtra: ['crm', 'especialidade_medica'] },
  dentista: { label: 'Dentista', emoji: '🦷', stepsExtra: ['cro', 'especialidade_odonto'] },
  fonoaudiologo: { label: 'Fonoaudiólogo(a)', emoji: '🗣️', stepsExtra: ['crfa', 'publico_atendido'] },
  esteticista: { label: 'Esteticista / Beleza', emoji: '💅', stepsExtra: ['servicos_beleza'] },
  influenciador: { label: 'Influenciador(a) / Criador(a) de conteúdo', emoji: '🎥', stepsExtra: ['nicho_conteudo'] },
  outro: { label: 'Outra área', emoji: '✨', stepsExtra: ['area_outra'] },
};

/** true se o step `stepId` pertence à lista de steps extras da profissão escolhida. */
export function temStepExtra(profissaoId: string | string[] | undefined, stepId: string): boolean {
  const pid = Array.isArray(profissaoId) ? profissaoId[0] : profissaoId;
  if (!pid) return false;
  return PROFISSOES[pid]?.stepsExtra.includes(stepId) ?? false;
}
