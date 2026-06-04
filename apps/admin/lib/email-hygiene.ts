/**
 * Higiene de e-mail — corrige typos previsíveis de domínio e valida a sintaxe,
 * pra REDUZIR BOUNCE em envios (o Amazon SES é rígido: bounce alto suspende a conta).
 *
 * Funções puras, sem dependências. Use:
 *   - na captação de leads (corrigir/recusar antes de gravar)
 *   - antes de qualquer broadcast (filtrar inválidos da audiência)
 */

// ── Correções de domínio (typo digitado -> domínio correto), tudo lowercase ──
// IMPORTANTE: `yahoo.com.br` é MANTIDO (Yahoo Brasil é legítimo). Já os globais
// gmail/hotmail/outlook NÃO têm versão .com.br de consumidor -> corrigimos.
const DOMAIN_FIXES: Record<string, string> = {
  // gmail
  'gmai.com': 'gmail.com', 'gmial.com': 'gmail.com', 'gmil.com': 'gmail.com', 'gamil.com': 'gmail.com',
  'gmaill.com': 'gmail.com', 'gmail.co': 'gmail.com', 'gmail.con': 'gmail.com', 'gmail.cm': 'gmail.com',
  'gmail.comm': 'gmail.com', 'gmail.com.br': 'gmail.com', 'gnail.com': 'gmail.com', 'g-mail.com': 'gmail.com',
  'gmail.col': 'gmail.com', 'gmal.com': 'gmail.com', 'gmail.om': 'gmail.com', 'gmail.cpm': 'gmail.com',
  'gmaul.com': 'gmail.com', 'gimail.com': 'gmail.com', 'gmaio.com': 'gmail.com', 'gmsil.com': 'gmail.com',
  'gmali.com': 'gmail.com', 'gmail.ccom': 'gmail.com', 'gmailcom': 'gmail.com', 'gmail.coml': 'gmail.com',
  'hmail.com': 'gmail.com', 'gemail.com': 'gmail.com', 'gmail.combr': 'gmail.com', 'gmaill.com.br': 'gmail.com',
  // hotmail
  'hotmail.con': 'hotmail.com', 'hotmial.com': 'hotmail.com', 'hotmai.com': 'hotmail.com', 'hotmail.co': 'hotmail.com',
  'hotmail.com.br': 'hotmail.com', 'hotmil.com': 'hotmail.com', 'hotmaill.com': 'hotmail.com', 'htomail.com': 'hotmail.com',
  'hotnail.com': 'hotmail.com', 'hormail.com': 'hotmail.com', 'hotamail.com': 'hotmail.com', 'hotmail.cm': 'hotmail.com',
  'hotmail.om': 'hotmail.com', 'hitmail.com': 'hotmail.com', 'hotmaul.com': 'hotmail.com', 'rotmail.com': 'hotmail.com',
  'hotmailcom': 'hotmail.com', 'hotmaul.com.br': 'hotmail.com', 'hotmal.com': 'hotmail.com', 'hotmail.comm': 'hotmail.com',
  // outlook
  'outlook.con': 'outlook.com', 'outlok.com': 'outlook.com', 'outloo.com': 'outlook.com', 'outlook.com.br': 'outlook.com',
  'outllok.com': 'outlook.com', 'hotlook.com': 'outlook.com', 'outlook.co': 'outlook.com', 'outlook.cm': 'outlook.com',
  'outlook.om': 'outlook.com', 'outook.com': 'outlook.com', 'oytlook.com': 'outlook.com', 'outlookcom': 'outlook.com',
  // yahoo (mantém yahoo.com.br!)
  'yaho.com': 'yahoo.com', 'yahoo.con': 'yahoo.com', 'yahoo.co': 'yahoo.com', 'yhaoo.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com', 'yahou.com': 'yahoo.com', 'yaoo.com': 'yahoo.com', 'yahoo.cm': 'yahoo.com',
  // icloud / live / msn
  'icloud.con': 'icloud.com', 'iclod.com': 'icloud.com', 'icloud.co': 'icloud.com', 'iclould.com': 'icloud.com',
  'live.con': 'live.com', 'live.co': 'live.com', 'msn.con': 'msn.com',
  // brasileiros comuns
  'bol.com': 'bol.com.br', 'uol.com': 'uol.com.br', 'ig.com': 'ig.com.br', 'terra.com': 'terra.com.br',
  'globo.com.br': 'globo.com',
}

// TLDs finais obviamente errados -> corretos (aplicado só quando o domínio não
// caiu numa regra acima). Conservador de propósito.
const TLD_FIXES: Array<[RegExp, string]> = [
  [/\.con$/, '.com'],
  [/\.cmo$/, '.com'],
  [/\.ocm$/, '.com'],
  [/\.vom$/, '.com'],
  [/\.xom$/, '.com'],
  [/\.comm$/, '.com'],
  [/\.co\.$/, '.com'],
]

// Domínios descartáveis/temporários (baixa qualidade, alto risco). Recusados.
const DISPOSABLE = new Set<string>([
  'mailinator.com', 'yopmail.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com',
  'temp-mail.org', 'trashmail.com', 'getnada.com', 'sharklasers.com', 'maildrop.cc',
  'fakeinbox.com', 'throwawaymail.com', 'dispostable.com', 'mailnesia.com', 'mintemail.com',
])

// Domínios/locais de teste óbvios -> inválidos
const JUNK_DOMAINS = new Set<string>([
  'teste.com', 'test.com', 'example.com', 'exemplo.com', 'email.com', 'mail.com', 'aaa.com',
  'asd.com', 'asdf.com', 'abc.com', 'gmail.com.com', 'naotenho.com', 'naotem.com', 'sement.com',
])

const EMAIL_RE = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/

export type EmailCheck = {
  valid: boolean
  email: string        // versão limpa/corrigida (lowercase, sem espaços)
  corrected: boolean   // true se houve correção de typo
  reason?: string      // motivo da recusa (quando !valid)
}

/** Limpa e corrige um e-mail (não decide validade). */
export function cleanEmail(raw: string | null | undefined): string {
  if (!raw) return ''
  let e = String(raw).trim().toLowerCase()
  // remove espaços internos e caracteres invisíveis comuns (zero-width, BOM, nbsp)
  e = e.replace(/\s+/g, '').replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
  // erros de digitação comuns na "arroba"
  e = e.replace(/@{2,}/g, '@')
  const at = e.lastIndexOf('@')
  if (at === -1) return e
  let local = e.slice(0, at)
  let domain = e.slice(at + 1)
  // remove pontos duplicados e pontos nas bordas do domínio
  domain = domain.replace(/\.{2,}/g, '.').replace(/^\.+|\.+$/g, '')
  // correção de domínio inteiro
  if (DOMAIN_FIXES[domain]) {
    domain = DOMAIN_FIXES[domain]
  } else {
    // correção só do TLD final
    for (const [re, rep] of TLD_FIXES) {
      if (re.test(domain)) { domain = domain.replace(re, rep); break }
    }
    // re-tenta o mapa após corrigir TLD
    if (DOMAIN_FIXES[domain]) domain = DOMAIN_FIXES[domain]
  }
  local = local.replace(/^\.+|\.+$/g, '').replace(/\.{2,}/g, '.')
  return `${local}@${domain}`
}

/** Limpa, corrige e valida. Use no envio pra descartar inválidos. */
export function validateEmail(raw: string | null | undefined): EmailCheck {
  const original = String(raw ?? '').trim().toLowerCase().replace(/\s+/g, '')
  const email = cleanEmail(raw)
  const corrected = !!email && email !== original

  if (!email) return { valid: false, email, corrected, reason: 'vazio' }
  if (email.length > 254) return { valid: false, email, corrected, reason: 'muito longo' }
  if (!EMAIL_RE.test(email)) return { valid: false, email, corrected, reason: 'sintaxe inválida' }

  const domain = email.slice(email.lastIndexOf('@') + 1)
  const local = email.slice(0, email.lastIndexOf('@'))
  if (local.length > 64) return { valid: false, email, corrected, reason: 'parte local muito longa' }
  if (DISPOSABLE.has(domain)) return { valid: false, email, corrected, reason: 'domínio descartável' }
  if (JUNK_DOMAINS.has(domain)) return { valid: false, email, corrected, reason: 'domínio de teste/lixo' }
  // TLD plausível
  const tld = domain.slice(domain.lastIndexOf('.') + 1)
  if (tld.length < 2 || /\d/.test(tld)) return { valid: false, email, corrected, reason: 'TLD inválido' }

  return { valid: true, email, corrected }
}

/** Filtra uma lista de e-mails, retornando válidos (corrigidos), inválidos e stats. */
export function partitionEmails(emails: Array<string | null | undefined>): {
  valid: string[]
  invalid: Array<{ email: string; reason: string }>
  correctedCount: number
} {
  const valid: string[] = []
  const invalid: Array<{ email: string; reason: string }> = []
  let correctedCount = 0
  const seen = new Set<string>()
  for (const raw of emails) {
    const c = validateEmail(raw)
    if (c.corrected) correctedCount++
    if (!c.valid) { invalid.push({ email: c.email || String(raw ?? ''), reason: c.reason || 'inválido' }); continue }
    if (seen.has(c.email)) continue
    seen.add(c.email)
    valid.push(c.email)
  }
  return { valid, invalid, correctedCount }
}
