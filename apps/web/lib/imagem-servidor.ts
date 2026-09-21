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
