/**
 * Corrige typos ÓBVIOS de e-mail antes de usar (evita rejeição na PagarMe e
 * contas criadas com e-mail inválido). Conservador: só mexe no que é claramente
 * errado — nunca "adivinha" domínios legítimos.
 *
 * Ex.: "escritorio@grupojacomini.co,.br" → "escritorio@grupojacomini.com.br"
 *      "maria@gmail.con" → "maria@gmail.com"
 */

// Domínios de provedores conhecidos digitados errado → correto.
const DOMAIN_FIXES: Record<string, string> = {
  // Gmail
  'gmail.co': 'gmail.com', 'gmail.con': 'gmail.com', 'gmail.cm': 'gmail.com',
  'gmail.comm': 'gmail.com', 'gmail.cpm': 'gmail.com', 'gmail.vom': 'gmail.com',
  'gmail.xom': 'gmail.com', 'gmail.om': 'gmail.com', 'gmail.col': 'gmail.com',
  'gmail.copm': 'gmail.com', 'gmail.combr': 'gmail.com', 'gmail.com.br': 'gmail.com',
  'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmaill.com': 'gmail.com',
  'gmail.coml': 'gmail.com', 'gmail.cop': 'gmail.com', 'gamil.com': 'gmail.com',
  // Hotmail
  'hotmail.co': 'hotmail.com', 'hotmail.con': 'hotmail.com', 'hotmai.com': 'hotmail.com',
  'hotmail.cm': 'hotmail.com', 'hotmail.comm': 'hotmail.com', 'hotmial.com': 'hotmail.com',
  'hotmail.om': 'hotmail.com', 'hotmail.co.br': 'hotmail.com', 'hotmail.combr': 'hotmail.com',
  'hotamil.com': 'hotmail.com', 'hitmail.com': 'hotmail.com',
  // Outlook / Live
  'outlook.co': 'outlook.com', 'outlook.con': 'outlook.com', 'outlook.cm': 'outlook.com',
  'outlok.com': 'outlook.com', 'outllook.com': 'outlook.com',
  'live.co': 'live.com', 'live.con': 'live.com',
  // Yahoo
  'yahoo.co': 'yahoo.com', 'yahoo.con': 'yahoo.com', 'yaho.com': 'yahoo.com',
  'yahoo.cm': 'yahoo.com', 'yahoo.comm': 'yahoo.com',
  // iCloud
  'icloud.co': 'icloud.com', 'icloud.con': 'icloud.com', 'iclod.com': 'icloud.com',
  'icloud.cm': 'icloud.com',
  // BR
  'bol.com': 'bol.com.br', 'uol.com': 'uol.com.br',
}

const EMAIL_RE = /^[^\s@]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

export function isValidEmailFormat(email: string): boolean {
  return EMAIL_RE.test(String(email ?? '').trim())
}

export function normalizeEmail(raw: string): { email: string; corrected: boolean } {
  const original = String(raw ?? '').trim()
  let e = original.toLowerCase().replace(/\s+/g, '') // sem espaços
  e = e.replace(/,/g, '.')             // vírgula → ponto (typo comum)
  e = e.replace(/@{2,}/g, '@')         // @@ → @
  e = e.replace(/\.{2,}/g, '.')        // .. → .
  e = e.replace(/^[.@]+|[.@]+$/g, '')  // lixo nas pontas

  const at = e.lastIndexOf('@')
  if (at > 0) {
    const local = e.slice(0, at)
    let domain = e.slice(at + 1)
    if (DOMAIN_FIXES[domain]) {
      domain = DOMAIN_FIXES[domain]
    } else {
      // Genéricos SEGUROS (TLDs que não existem → o certo é óbvio).
      domain = domain
        .replace(/\.con$/, '.com')     // .con → .com
        .replace(/\.co\.br$/, '.com.br') // .co.br não existe → .com.br
        .replace(/\.comm$/, '.com')    // .comm → .com
    }
    e = `${local}@${domain}`
  }

  return { email: e, corrected: e !== original.toLowerCase().replace(/\s+/g, '') }
}
