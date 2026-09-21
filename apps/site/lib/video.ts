/**
 * Vídeos do YouTube incorporados nos artigos.
 *
 * O Search Console listava 21 vídeos como "não indexados — o vídeo não está em
 * uma página de exibição": o embed existe no HTML, mas nada diz ao Google o que
 * é aquele vídeo. Sem `VideoObject` ele não entra nos resultados de vídeo, que
 * é justamente onde a busca por "como aplicar progressiva" leva a mulher.
 *
 * Os dados vêm do oEmbed público do YouTube (título e miniatura reais, do
 * próprio canal) — nada é inventado aqui. `uploadDate` fica de fora de
 * propósito: o oEmbed não devolve a data do vídeo, e chutar uma data seria
 * exatamente o tipo de dado impreciso que derruba rich result.
 */
export interface VideoIncorporado {
  id: string;
  titulo: string;
  canal: string;
  miniatura: string;
  embedUrl: string;
  pagina: string;
}

/** IDs de vídeo do YouTube que aparecem no HTML, na ordem em que aparecem. */
export function idsDeVideo(html: string | null | undefined): string[] {
  const achados = String(html ?? '').matchAll(
    /(?:youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/|youtu\.be\/|watch\?v=)([A-Za-z0-9_-]{11})/g,
  );
  return [...new Set([...achados].map((m) => m[1]))];
}

/** Título e miniatura reais do vídeo, pelo oEmbed público do YouTube. */
export async function dadosDoVideo(id: string): Promise<{ titulo: string; canal: string; miniatura: string } | null> {
  try {
    // Timeout curto: isto roda no build de 185 posts e dentro do render de
    // cada página. Um oEmbed lento não pode travar a publicação do site — sem
    // resposta, a página simplesmente sai sem o VideoObject.
    const r = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`,
      { next: { revalidate: 86400 }, signal: AbortSignal.timeout(4000) },
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
    if (!j.title) return null;
    return {
      titulo: j.title,
      canal: j.author_name ?? '',
      // A miniatura do oEmbed é a hqdefault; mantemos a que o YouTube devolve.
      miniatura: j.thumbnail_url ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    };
  } catch {
    return null;
  }
}

/** Vídeos de uma página, prontos para virar schema. Vazio se nada for achado. */
export async function videosDaPagina(html: string | null | undefined, paginaUrl: string): Promise<VideoIncorporado[]> {
  const ids = idsDeVideo(html).slice(0, 3); // o Google usa o primeiro; 3 é teto de segurança
  const dados = await Promise.all(ids.map(async (id) => ({ id, d: await dadosDoVideo(id) })));
  return dados
    .filter((x): x is { id: string; d: { titulo: string; canal: string; miniatura: string } } => !!x.d)
    .map(({ id, d }) => ({
      id,
      titulo: d.titulo,
      canal: d.canal,
      miniatura: d.miniatura,
      embedUrl: `https://www.youtube.com/embed/${id}`,
      pagina: paginaUrl,
    }));
}
