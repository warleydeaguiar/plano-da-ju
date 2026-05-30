/**
 * Normalização de PII para Advanced Matching do Meta Pixel.
 *
 * Por que: o Pixel rejeita/marca como "malformado" valores fora do padrão (ex:
 * acentos em nome, telefone curto, email com espaço, sobrenome com vários
 * tokens). Esse helper deixa tudo no formato que o Meta espera ANTES do hash.
 *
 * Regras (oficiais do Meta):
 *  - email: lowercase + trim
 *  - phone: só dígitos, com DDI (no Brasil prefixa '55' se vier sem)
 *  - fn/ln: lowercase, sem acentos, só [a-z0-9], pega 1 token (primeiro/último)
 *  - country: lowercase ISO de 2 letras
 *
 * Retorna SOMENTE chaves com valor válido — chaves inválidas são OMITIDAS
 * (mandar string vazia também é considerado malformado pelo Meta).
 */

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function pixelEmail(s: string | null | undefined): string | undefined {
  const v = (s ?? '').trim().toLowerCase()
  if (!v || !v.includes('@')) return undefined
  return v
}

export function pixelPhone(s: string | null | undefined): string | undefined {
  const digits = (s ?? '').replace(/\D/g, '')
  // Brasil: celular válido tem 10 (fixo c/ DDD) ou 11 (móvel c/ DDD) dígitos.
  // Sem DDI = prefixa '55'. Menos que 10 = OMITE (PII incompleta é pior que ausente).
  if (digits.length === 10 || digits.length === 11) return '55' + digits
  if (digits.length === 12 || digits.length === 13) return digits // já tem DDI
  return undefined
}

export function pixelFirstName(fullName: string | null | undefined): string | undefined {
  if (!fullName) return undefined
  const first = stripAccents(fullName.trim().toLowerCase()).split(/\s+/).filter(Boolean)[0] ?? ''
  const clean = first.replace(/[^a-z0-9]/g, '')
  return clean || undefined
}

export function pixelLastName(fullName: string | null | undefined): string | undefined {
  if (!fullName) return undefined
  const parts = stripAccents(fullName.trim().toLowerCase()).split(/\s+/).filter(Boolean)
  if (parts.length < 2) return undefined
  // Pega só o último token — vários sobrenomes com espaço dão "malformed"
  const last = parts[parts.length - 1].replace(/[^a-z0-9]/g, '')
  return last || undefined
}

/**
 * Monta o objeto de Advanced Matching pronto pra fbq('init', PIXEL_ID, {...}).
 * Só inclui campos válidos.
 */
export function pixelMatchingPayload(opts: {
  email?: string | null
  phone?: string | null
  fullName?: string | null
  country?: string
}): Record<string, string> {
  const out: Record<string, string> = {}
  const em = pixelEmail(opts.email)
  const ph = pixelPhone(opts.phone)
  const fn = pixelFirstName(opts.fullName)
  const ln = pixelLastName(opts.fullName)
  if (em) out.em = em
  if (ph) out.ph = ph
  if (fn) out.fn = fn
  if (ln) out.ln = ln
  out.country = (opts.country ?? 'br').toLowerCase()
  return out
}
