/**
 * Normaliza o array de tasks de hair_plans para um shape consistente.
 *
 * Por que: a geração por IA produziu DOIS formatos no banco:
 *  - novo  → [{day, title, description}, …]    (esperado pelo código)
 *  - antigo → ["string1", "string2", …]        (quebra qualquer acesso a .title)
 *
 * Sem isso, abrir uma semana com o formato antigo lançava erro
 * (`title.toLowerCase()` em undefined) e a página inteira ia pro fallback
 * "This page couldn't load…".
 */
export type PlanTask = { day: number; title: string; description: string; done: boolean }

export function normalizeTasks(raw: unknown): PlanTask[] {
  if (!Array.isArray(raw)) return []
  return raw.map((t, i) => {
    if (typeof t === 'string') {
      return { day: i + 1, title: t, description: '', done: false }
    }
    if (t && typeof t === 'object') {
      const o = t as Record<string, unknown>
      return {
        day: typeof o.day === 'number' ? o.day : i + 1,
        title: typeof o.title === 'string' ? o.title : '',
        description: typeof o.description === 'string' ? o.description : '',
        done: !!o.done,
      }
    }
    return { day: i + 1, title: '', description: '', done: false }
  })
}
