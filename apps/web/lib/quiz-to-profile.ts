/**
 * Extrai campos individuais de quiz_answers (jsonb) pras colunas dedicadas
 * de profiles (hair_type, porosity, chemical_history, main_problems, etc.)
 *
 * Isso é o que faz as queries do app (matching de stories, painel admin)
 * funcionarem, já que elas leem as colunas, não o jsonb.
 */
export interface ExtractedQuizFields {
  hair_type:         string | null;
  porosity:          string | null;
  chemical_history:  string | null;
  main_problems:     string[];
  quiz_completed_at: string;
}

export function extractFieldsFromQuiz(quiz: Record<string, unknown> | null | undefined): ExtractedQuizFields {
  const empty: ExtractedQuizFields = {
    hair_type:         null,
    porosity:          null,
    chemical_history:  null,
    main_problems:     [],
    quiz_completed_at: new Date().toISOString(),
  };
  if (!quiz || typeof quiz !== 'object') return empty;

  const tipo = typeof quiz.tipo === 'string' ? quiz.tipo : null;
  const porosidade = typeof quiz.porosidade === 'string' ? quiz.porosidade : null;

  // quimica pode ser string ou array (multi-select)
  const quimicaRaw = quiz.quimica;
  const chemical_history: string | null = Array.isArray(quimicaRaw)
    ? quimicaRaw.filter(q => q && q !== 'nenhuma').join(',') || 'nenhuma'
    : typeof quimicaRaw === 'string'
      ? quimicaRaw
      : null;

  // incomoda é multi-select
  const incomodaRaw = quiz.incomoda;
  const main_problems: string[] = Array.isArray(incomodaRaw)
    ? incomodaRaw.filter((x): x is string => typeof x === 'string')
    : typeof incomodaRaw === 'string' && incomodaRaw
      ? [incomodaRaw]
      : [];

  return {
    hair_type:         tipo,
    porosity:          porosidade,
    chemical_history,
    main_problems,
    quiz_completed_at: new Date().toISOString(),
  };
}
