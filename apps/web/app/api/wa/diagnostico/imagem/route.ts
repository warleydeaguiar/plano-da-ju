import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { normalizarParaJpeg } from '@/lib/imagem-servidor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/wa/diagnostico/imagem?k=<WA_DIAG_SECRET>
 *
 * Confirma que a conversão de foto funciona NESTE ambiente — o binário do
 * sharp é nativo e pode não subir junto com o deploy. Sem esta checagem,
 * descobriríamos pela cliente que não consegue enviar a foto.
 */
export async function GET(req: NextRequest) {
  const esperado = process.env.WA_DIAG_SECRET;
  if (!esperado || req.nextUrl.searchParams.get('k') !== esperado) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  }
  try {
    const png = await sharp({ create: { width: 2400, height: 3200, channels: 3, background: '#c8a' } }).png().toBuffer();
    const jpeg = await normalizarParaJpeg(png);
    const meta = jpeg ? await sharp(jpeg).metadata() : null;
    return NextResponse.json({
      sharp: sharp.versions.sharp,
      heic: sharp.format.heif?.input?.buffer === true,
      conversao_ok: !!jpeg,
      saida: meta ? { formato: meta.format, largura: meta.width, altura: meta.height, kb: Math.round((jpeg!.length) / 1024) } : null,
    });
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
