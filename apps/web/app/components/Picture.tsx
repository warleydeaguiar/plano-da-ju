'use client';

/**
 * <Picture> — serve AVIF quando o navegador aceita, WebP como segunda opção e o
 * arquivo original como último recurso.
 *
 * Por que não trocar direto o src pra .avif: AVIF só existe no Safari a partir do
 * iOS 16. Num iPhone mais antigo a imagem simplesmente NÃO aparece — e imagem
 * quebrada no meio do funil custa venda. Com <picture> o navegador escolhe o que
 * ele sabe abrir, então ninguém fica sem imagem.
 *
 * Use passando o caminho do arquivo ORIGINAL; os irmãos .avif/.webp são deduzidos.
 */
export default function Picture({
  src, alt, className, style, width, height, loading = 'lazy', fetchPriority,
}: {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  width?: number;
  height?: number;
  loading?: 'lazy' | 'eager';
  fetchPriority?: 'high' | 'low' | 'auto';
}) {
  const base = src.replace(/\.(png|jpe?g|webp)$/i, '');
  return (
    <picture>
      <source srcSet={`${base}.avif`} type="image/avif" />
      <source srcSet={`${base}.webp`} type="image/webp" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={className}
        style={style}
        width={width}
        height={height}
        loading={loading}
        fetchPriority={fetchPriority}
        decoding="async"
      />
    </picture>
  );
}
