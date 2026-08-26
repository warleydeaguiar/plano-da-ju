/** Utilidades de apresentação do artigo, todas calculadas no servidor. */

export interface ItemIndice {
  id: string;
  texto: string;
}

const decodificar = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');

/**
 * Lê o índice a partir dos H2 que já têm âncora no HTML.
 *
 * As âncoras são gravadas na migração, não montadas aqui — assim elas existem
 * no HTML estático que o Google recebe, e não dependem de script no navegador.
 */
export function extrairIndice(html: string | null): ItemIndice[] {
  if (!html) return [];
  const itens: ItemIndice[] = [];
  for (const m of html.matchAll(/<h2\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/gi)) {
    const texto = decodificar(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (texto) itens.push({ id: m[1], texto });
  }
  return itens;
}

/** Minutos de leitura, arredondando para cima. 200 palavras/min é o padrão. */
export function tempoDeLeitura(palavras: number | null): number {
  return Math.max(1, Math.round((palavras || 0) / 200));
}

/**
 * Divide o artigo em blocos por H2, para intercalar as chamadas no meio do
 * texto em vez de empilhá-las no fim. O corte é sempre antes de um H2, então
 * a chamada nunca parte um parágrafo ao meio.
 */
export function dividirPorSecoes(html: string | null, cortes: number[]): string[] {
  if (!html) return [];
  const partes = html.split(/(?=<h2\b)/i);
  if (partes.length <= 1) return [html];

  const blocos: string[] = [];
  let atual: string[] = [];
  partes.forEach((parte, i) => {
    if (i > 0 && cortes.includes(i)) {
      blocos.push(atual.join(''));
      atual = [];
    }
    atual.push(parte);
  });
  blocos.push(atual.join(''));
  return blocos.filter(Boolean);
}
