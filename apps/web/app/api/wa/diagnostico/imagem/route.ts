import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { normalizarParaJpeg, fotoParaIA, LADO_FOTO_IA } from '@/lib/imagem-servidor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/wa/diagnostico/imagem?k=<WA_DIAG_SECRET>
 *
 * Confirma que a conversão de foto funciona NESTE ambiente — o binário do
 * sharp é nativo e pode não subir junto com o deploy. Sem esta checagem,
 * descobriríamos pela cliente que não consegue enviar a foto.
 *
 * Com `&url=<foto>` mede também o preparo da foto para a IA: baixa do storage,
 * reduz para LADO_FOTO_IA e diz quantos tokens de visão aquilo custa. É o jeito
 * de conferir a economia sem esperar uma cliente real enviar foto.
 */
export async function GET(req: NextRequest) {
  const esperado = process.env.WA_DIAG_SECRET;
  if (!esperado || req.nextUrl.searchParams.get('k') !== esperado) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  }
  try {
    // Foto real: exercita o mesmo caminho que a geração de plano usa.
    const url = req.nextUrl.searchParams.get('url');
    if (url) {
      const antes = await fetch(url).then(r => r.arrayBuffer()).catch(() => null);
      const dataUrl = await fotoParaIA(url);
      const b64 = dataUrl?.split(',')[1] ?? '';
      const depois = b64 ? Buffer.from(b64, 'base64') : null;
      const m = depois ? await sharp(depois).metadata() : null;
      // Regra da Anthropic para custo de visão: largura × altura ÷ 750.
      const tokens = m?.width && m?.height ? Math.ceil((m.width * m.height) / 750) : null;
      return NextResponse.json({
        lado_alvo: LADO_FOTO_IA,
        baixou_kb: antes ? Math.round(antes.byteLength / 1024) : null,
        preparou: !!depois,
        saida: m ? { largura: m.width, altura: m.height, kb: Math.round((depois!.length) / 1024) } : null,
        tokens_de_visao: tokens,
      });
    }

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
