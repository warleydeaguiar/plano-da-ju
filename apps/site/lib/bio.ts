import { porPath } from './conteudo';

/**
 * Dados do link da bio, compartilhados por /bio e pelas variações /bio1–3.
 *
 * Os links vêm do conteúdo, não de uma lista no código: a Juliane muda ordem,
 * texto e destino pelo editor do admin (registro `/bio/`) e todas as versões
 * acompanham sem deploy.
 */

// Servidas pela CDN da Vercel (apps/site/public/midia-bio), não pelo Storage:
// a VPS do Supabase tem 1 núcleo e o vídeo levava ~4s; com o vídeo baixando
// em paralelo as fotos chegavam a estourar o tempo no navegador. São peças do
// desenho, não conteúdo editável — moram junto com o código.
const MIDIA = '/midia-bio';
export const VIDEO_FUNDO = `${MIDIA}/video-fundo.mp4`;
export const POSTER_FUNDO = `${MIDIA}/video-fundo-poster.jpg`;
export const RETRATO = `${MIDIA}/juliane-retrato`;
export const RETRATO_STORY = `${MIDIA}/juliane-story`;
export const FOTO_KIT = `${MIDIA}/kit-fashion-gold`;
export const FOTO_AVATAR = `${MIDIA}/juliane-avatar`;

export interface LinkBio {
  href: string;
  rotulo: string;
  emoji: string | null;
}

const REDES_CONHECIDAS = /instagram\.com|tiktok\.com|youtube\.com|youtu\.be|facebook\.com|kwai/i;

/** Emoji solto no começo do rótulo vira ícone; o texto fica limpo. */
const EMOJI_NA_FRENTE = /^\s*([\p{Extended_Pictographic}️‍]+)\s*/u;

const NOMEADAS: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…',
  ndash: '–', mdash: '—', rsquo: '’', ldquo: '“', rdquo: '”',
};

const semTags = (html: string) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/gi, (inteiro, nome) => NOMEADAS[String(nome).toLowerCase()] ?? inteiro)
    .replace(/\s+/g, ' ')
    .trim();

export function extrairLinks(html: string | null): { principais: LinkBio[]; redes: LinkBio[] } {
  const principais: LinkBio[] = [];
  const redes: LinkBio[] = [];
  const vistos = new Set<string>();

  for (const m of (html || '').matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    // No HTML o `&` de query string vem escrito `&amp;`/`&#038;` — sem decodificar,
    // link de afiliado com 2+ parâmetros perde o da comissão.
    const href = m[1].trim().replace(/&amp;|&#0?38;/gi, '&');
    const bruto = semTags(m[2]);
    if (!href || !bruto || vistos.has(href)) continue;
    vistos.add(href);

    const emoji = bruto.match(EMOJI_NA_FRENTE);
    const link: LinkBio = {
      href,
      rotulo: bruto.replace(EMOJI_NA_FRENTE, '').trim() || bruto,
      emoji: emoji ? emoji[1] : null,
    };
    (REDES_CONHECIDAS.test(href) ? redes : principais).push(link);
  }
  return { principais, redes };
}

export async function carregarBio() {
  const item = await porPath('/bio/');
  return extrairLinks(item?.content_clean ?? null);
}

export const ehWhatsapp = (href: string) => /wa\.me|api\.whatsapp\.com/.test(href);
export const ehExterno = (href: string) => !href.startsWith('/');
