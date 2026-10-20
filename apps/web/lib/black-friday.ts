/**
 * BLACK FRIDAY 2026 no funil dos grupos (quiz /quiz/fashion-gold) — pedido do
 * Warley em 20/10/2026: "estamos começando a falar de Black Friday".
 *
 * Duas fases, pelo relógio de Brasília, e liga/desliga SOZINHO:
 *   esquenta  20/10 → 26/11  "as ofertas da Black saem primeiro no grupo"
 *   black     27/11 → 30/11  "a Black Friday está acontecendo no grupo" (sexta + fim de semana + Cyber Monday)
 *   null      01/12 em diante — o funil volta ao normal sem ninguém precisar lembrar.
 *
 * Só muda as datas aqui. A mesma regra está copiada em
 * apps/admin/lib/black-friday.ts (e-mail do convite do grupo) — manter iguais.
 */
export type FaseBF = 'esquenta' | 'black' | null

const BR = 3 * 3600_000 // UTC−3, sem horário de verão
export const BF_INICIO_ESQUENTA = Date.parse('2026-10-20T00:00:00Z') + BR
export const BF_INICIO_BLACK = Date.parse('2026-11-27T00:00:00Z') + BR
export const BF_FIM = Date.parse('2026-12-01T00:00:00Z') + BR

export function faseBF(agora: number = Date.now()): FaseBF {
  if (agora < BF_INICIO_ESQUENTA || agora >= BF_FIM) return null
  return agora < BF_INICIO_BLACK ? 'esquenta' : 'black'
}

/** Quanto falta para a Black começar (0 se já começou). */
export function faltaParaBlack(agora: number = Date.now()) {
  const ms = Math.max(0, BF_INICIO_BLACK - agora)
  return {
    ms,
    dias: Math.floor(ms / 86400_000),
    horas: Math.floor((ms % 86400_000) / 3600_000),
    minutos: Math.floor((ms % 3600_000) / 60_000),
    segundos: Math.floor((ms % 60_000) / 1000),
  }
}

/** Frase curta para as mensagens de WhatsApp em texto livre ('' fora da campanha). */
export function linhaBFWhatsapp(agora: number = Date.now()): string {
  const f = faseBF(agora)
  if (f === 'esquenta') {
    const d = faltaParaBlack(agora).dias
    return `🖤 E a Black Friday da Ybera está chegando${d > 1 ? ` (faltam ${d} dias)` : ''}: as ofertas vão sair primeiro no grupo.`
  }
  if (f === 'black') return '🖤 A Black Friday da Ybera está acontecendo AGORA no grupo — corre que as ofertas são por tempo limitado.'
  return ''
}
