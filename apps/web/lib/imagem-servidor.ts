import sharp from 'sharp';

/**
 * Converte qualquer foto que a cliente mandar para um JPEG que o resto do
 * sistema sabe ler.
 *
 * A regra é "aceite tudo, normalize aqui": o navegador dela pode falhar na
 * conversão (HEIC do iPhone é o caso comum) e não faz sentido devolver o
 * problema para ela. O original vai embora depois que o JPEG está salvo —
 * ninguém precisa dele, e a análise do cabelo não lê HEIC.
 *
 * `rotate()` sem argumento aplica a orientação do EXIF: sem isso, foto tirada
 * de lado chega deitada para a análise e para a cliente.
 */
export const MIME_NORMALIZADO = 'image/jpeg';

export async function normalizarParaJpeg(
  entrada: Uint8Array | Buffer,
  maxDim = 1600,
  quality = 82,
): Promise<Buffer | null> {
  try {
    return await sharp(Buffer.from(entrada), { failOn: 'none' })
      .rotate()
      .resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
  } catch {
    return null;
  }
}

/** Já é um JPEG pronto? Evita reprocessar o que o navegador já converteu. */
export function pareceJpeg(mime?: string | null, nome?: string | null): boolean {
  const m = (mime ?? '').toLowerCase();
  if (m === 'image/jpeg' || m === 'image/jpg') return true;
  return /\.jpe?g$/i.test(nome ?? '');
}

/**
 * Lado máximo da foto enviada para a IA analisar o cabelo.
 *
 * As fotos ficam guardadas em 1600px, mas a análise não precisa disso: num
 * teste com a mesma foto em 1600, 1024 e 768px (24/09/2026), os scores de
 * frizz, brilho, hidratação e pontas, a porosidade e o produto âncora saíram
 * IDÊNTICOS nos três — e a imagem responde por metade do custo de cada plano.
 * A 768px a conta cai ~28% por plano sem mudar uma vírgula do diagnóstico.
 */
export const LADO_FOTO_IA = 768;

/**
 * Foto pronta para mandar à IA, como data URL.
 *
 * Devolve `null` quando não dá para baixar ou converter — quem chama usa a URL
 * original nesse caso. Economizar custo nunca pode custar uma geração.
 */
export async function fotoParaIA(url: string, timeoutMs = 15_000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    let bytes: Buffer;
    try {
      const r = await fetch(url, { signal: controller.signal });
      if (!r.ok) return null;
      bytes = Buffer.from(await r.arrayBuffer());
    } finally {
      clearTimeout(t);
    }
    const jpeg = await normalizarParaJpeg(bytes, LADO_FOTO_IA, 80);
    return jpeg ? `data:${MIME_NORMALIZADO};base64,${jpeg.toString('base64')}` : null;
  } catch {
    return null;
  }
}
