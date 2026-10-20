/**
 * BLACK FRIDAY 2026 — cópia de apps/web/lib/black-friday.ts (manter iguais as datas).
 * Aqui serve ao e-mail do convite do grupo (variáveis {bf_assunto} e {bf_paragrafo}
 * em email-personalization.ts): na campanha entram, fora dela ficam vazias — o
 * e-mail volta ao normal sozinho em 01/12.
 */
export type FaseBF = 'esquenta' | 'black' | null

const BR = 3 * 3600_000
export const BF_INICIO_ESQUENTA = Date.parse('2026-10-20T00:00:00Z') + BR
export const BF_INICIO_BLACK = Date.parse('2026-11-27T00:00:00Z') + BR
export const BF_FIM = Date.parse('2026-12-01T00:00:00Z') + BR

export function faseBF(agora: number = Date.now()): FaseBF {
  if (agora < BF_INICIO_ESQUENTA || agora >= BF_FIM) return null
  return agora < BF_INICIO_BLACK ? 'esquenta' : 'black'
}

export function varsBlackFriday(agora: number = Date.now()): { bf_assunto: string; bf_paragrafo: string } {
  const f = faseBF(agora)
  const caixa = (html: string) =>
    `<div style="margin:0 0 20px 0;padding:16px 18px;background:#111111;border-radius:12px;color:#FFFFFF;">${html}</div>`
  if (f === 'esquenta') {
    const dias = Math.floor(Math.max(0, BF_INICIO_BLACK - agora) / 86400_000)
    return {
      bf_assunto: ' — a Black Friday sai lá primeiro 🖤',
      bf_paragrafo: caixa(
        '<p style="margin:0 0 4px 0;font-size:13px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#C9A45C;">Esquenta Black Friday Ybera</p>'
        + `<p style="margin:0;font-size:15px;line-height:1.6;color:#F3EEE4;">${dias > 1 ? `Faltam ${dias} dias para a Black Friday. ` : ''}As ofertas da Black vão sair <strong style="color:#FFFFFF;">primeiro no grupo</strong> — quem está lá vê antes de todo mundo.</p>`,
      ),
    }
  }
  if (f === 'black') {
    return {
      bf_assunto: ' — a Black Friday já começou 🖤',
      bf_paragrafo: caixa(
        '<p style="margin:0 0 4px 0;font-size:13px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#C9A45C;">Black Friday Ybera</p>'
        + '<p style="margin:0;font-size:15px;line-height:1.6;color:#F3EEE4;">As ofertas da Black Friday estão no grupo <strong style="color:#FFFFFF;">agora</strong> — e são por tempo limitado.</p>',
      ),
    }
  }
  return { bf_assunto: '', bf_paragrafo: '' }
}
