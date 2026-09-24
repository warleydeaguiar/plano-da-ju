/**
 * Preparo da foto no navegador, antes de subir.
 *
 * Converter aqui é bom porque encolhe a imagem: sobe mais rápido no 4G da
 * cliente e economiza trabalho do servidor. Mas não é obrigatório — quando o
 * navegador não dá conta (HEIC do iPhone é o caso comum), o arquivo sobe como
 * veio e o SERVIDOR converte para JPEG e descarta o original.
 *
 * Duas tentativas de conversão: `createImageBitmap` e, se falhar, `<img>`, que
 * é o caminho que o Safari decodifica para HEIC.
 */
export class FotoNaoSuportada extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'FotoNaoSuportada';
  }
}

async function desenhar(file: File, maxDim: number): Promise<HTMLCanvasElement | null> {
  const ajustar = (w: number, h: number) => {
    const escala = Math.min(1, maxDim / Math.max(w, h));
    return { w: Math.round(w * escala), h: Math.round(h * escala) };
  };

  // 1ª tentativa: createImageBitmap (rápido, respeita a orientação EXIF).
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const { w, h } = ajustar(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(bitmap, 0, 0, w, h);
      bitmap.close?.();
      return canvas;
    }
    bitmap.close?.();
  } catch { /* cai para a segunda tentativa */ }

  // 2ª tentativa: <img>. É o caminho que funciona com HEIC no Safari/iOS, onde
  // o sistema decodifica o formato para a tag de imagem.
  try {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((ok, falhou) => {
        const el = new Image();
        el.onload = () => ok(el);
        el.onerror = () => falhou(new Error('decode'));
        el.src = url;
      });
      const { w, h } = ajustar(img.naturalWidth, img.naturalHeight);
      if (!w || !h) return null;
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, w, h);
      return canvas;
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch { return null; }
}

/**
 * Devolve SEMPRE um JPEG que o storage aceita — ou lança `FotoNaoSuportada`
 * com um texto que a cliente entende.
 */
export async function prepararFoto(file: File, maxDim = 1600, quality = 0.82): Promise<File> {
  const canvas = await desenhar(file, maxDim);

  if (!canvas) {
    // Sem conversão aqui, segue o original: o servidor converte para JPEG e
    // descarta o que veio (lib/imagem-servidor). O único limite que resta é o
    // tamanho do bucket.
    //
    // Isto NÃO é falha — é o caminho normal desde que passamos a aceitar
    // qualquer formato. Registrar como aviso enchia o painel de erros (150 em
    // 7 dias, contra 4 erros de verdade) e ainda dizia "a cliente não
    // conseguiu enviar a foto", o que era mentira: ela conseguiu.
    if (file.size <= 25 * 1024 * 1024) return file;
    throw new FotoNaoSuportada(
      'Essa foto é muito pesada (acima de 25 MB). Tente tirar uma foto nova pela câmera do aplicativo.',
    );
  }

  const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
  if (!blob) {
    avisarFalhaDeFoto('toBlob_vazio', file, 'preparo');
    if (file.size <= 25 * 1024 * 1024) return file;
    throw new FotoNaoSuportada('Essa foto é muito pesada (acima de 25 MB). Tente tirar uma foto nova pela câmera do aplicativo.');
  }

  const nome = (file.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg';
  return new File([blob], nome, { type: 'image/jpeg' });
}

/**
 * Conta ao servidor que a foto não passou.
 *
 * É o que faltava para enxergar o problema: a falha acontecia inteira dentro
 * do navegador da cliente e nunca deixava rastro do nosso lado.
 */
export function avisarFalhaDeFoto(motivo: string, file?: File | null, etapa?: string): void {
  try {
    const corpo = JSON.stringify({
      motivo, etapa: etapa ?? '',
      tipo: file?.type || '(sem tipo)',
      tamanho: file?.size ?? null,
    });
    // keepalive: o envio sobrevive à troca de tela logo depois do erro.
    void fetch('/api/meu-plano/falha-foto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: corpo,
      keepalive: true,
    }).catch(() => {});
  } catch { /* avisar é melhor esforço: nunca pode atrapalhar a cliente */ }
}

/** Erro de upload traduzido: o motivo real, não "verifique a conexão". */
export function motivoDoErroDeUpload(err: unknown): string {
  const msg = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  if (msg.includes('mime') || msg.includes('invalid_mime') || msg.includes('not allowed')) {
    return 'Esse formato de foto não é aceito. Tente tirar uma foto nova pela câmera do aplicativo.';
  }
  if (msg.includes('too large') || msg.includes('payload') || msg.includes('exceeded')) {
    return 'Essa foto é muito pesada. Tente tirar uma foto nova pela câmera do aplicativo.';
  }
  return 'Não consegui enviar sua foto agora. Verifique a conexão e tente de novo.';
}
