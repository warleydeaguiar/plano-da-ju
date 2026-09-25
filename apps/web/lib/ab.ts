/**
 * Sorteio de variante de teste A/B.
 *
 * A regra vive aqui porque agora dois quizzes usam o mesmo mecanismo (o
 * plano-capilar e o fashion-gold), e o painel /experimentos só entende o que
 * estiver escrito no formato `flag_key:side` do campo `ab_variant`.
 *
 * Sticky por sessão: a mesma pessoa cai sempre do mesmo lado enquanto o
 * experimento durar — senão ela veria páginas diferentes a cada recarga e a
 * medição não valeria nada.
 */

export type LadoVariante = 'control' | 'variant'

export interface ExperimentoAtivo {
  id: string
  flag_key: string
  target_step_id: string | null
  traffic_pct: number
  variant_content?: Record<string, unknown> | null
}

/** djb2 — distribuição uniforme e estável entre execuções. */
export function hashStr(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  // `>>> 0` evita o -2147483648, que em JS volta negativo depois do módulo.
  return h >>> 0
}

export function sortearLado(sessionId: string, exp: ExperimentoAtivo): LadoVariante {
  if (!sessionId || !exp?.id) return 'control'
  const pct = typeof exp.traffic_pct === 'number' && exp.traffic_pct >= 0 && exp.traffic_pct <= 100
    ? exp.traffic_pct : 50
  return hashStr(sessionId + exp.id) % 100 < pct ? 'variant' : 'control'
}

/** Rótulo gravado em `ab_variant` — é o que o painel lê. */
export function rotuloVariante(exp: ExperimentoAtivo, lado: LadoVariante): string {
  return `${exp.flag_key}:${lado}`
}
