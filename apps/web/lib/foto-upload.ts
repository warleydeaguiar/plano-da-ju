/**
 * Preparo da foto no navegador, antes de subir.
 *
 * O bucket `hair-photos` aceita só JPEG, PNG e WebP, com teto de tamanho. A
 * foto do iPhone é HEIC — e é aí que a cliente ficava travada: a conversão era
 * tentada por `createImageBitmap`, que falha com HEIC em vários navegadores, e
 * o código então subia o ARQUIVO ORIGINAL, que o storage recusava. A mensagem
 * falava em "verifique a conexão", quando o problema nunca foi a conexão.
 *
 * Aqui a conversão tem duas tentativas (bitmap e, se falhar, <img>, que o
 * Safari decodifica nativamente para HEIC) e, quando nenhuma funciona, o envio
 * para com um aviso que diz o que fazer — em vez de falhar no meio do caminho.
 */
const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp'];

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
    // Sem conversão: só passa adiante se o arquivo já for de um tipo aceito e
    // couber. Mandar um HEIC de 12 MB era garantia de erro lá na frente.
    if (TIPOS_ACEITOS.includes(file.type) && file.size <= 9 * 1024 * 1024) return file;
    avisarFalhaDeFoto('nao_consegui_decodificar', file, 'preparo');
    throw new FotoNaoSuportada(
      'Não consegui abrir essa foto aqui. Tente escolher outra imagem ou tirar uma foto nova pela câmera do aplicativo.',
    );
  }

  const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
  if (!blob) {
    if (TIPOS_ACEITOS.includes(file.type) && file.size <= 9 * 1024 * 1024) return file;
    avisarFalhaDeFoto('toBlob_vazio', file, 'preparo');
    throw new FotoNaoSuportada('Não consegui preparar essa foto. Tente tirar uma foto nova pela câmera do aplicativo.');
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
