import Link from 'next/link';
import type { Conteudo } from '@/lib/conteudo';

const NOMEADAS: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  hellip: '…', ndash: '–', mdash: '—', rsquo: '\u2019', ldquo: '\u201c', rdquo: '\u201d',
};

/**
 * Tira as tags e decodifica a entidade. O resumo vem do WordPress já
 * codificado; sem decodificar, o React escapa o `&` de novo e o visitante lê
 * "&#8211;" na tela em vez do travessão.
 */
const semTags = (html: string | null, limite = 150) => {
  if (!html) return '';
  const t = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/gi, (inteiro, nome) => NOMEADAS[String(nome).toLowerCase()] ?? inteiro)
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > limite ? `${t.slice(0, limite).trimEnd()}…` : t;
};

/**
 * Card de listagem. A imagem usa <picture> em vez de next/image de propósito:
 * os arquivos já foram convertidos para AVIF e WebP na migração, então otimizar
 * de novo em runtime só custaria transformação sem ganho.
 */
export default function CardPost({ item }: { item: Conteudo }) {
  const imagemAvif = item.og_image || item.featured_image_url;
  const imagemWebp = imagemAvif?.endsWith(".avif") ? imagemAvif.replace(/\.avif$/, ".webp") : (imagemAvif ?? undefined);
  const resumo = semTags(item.excerpt_html) || item.seo_description || '';

  return (
    <article
      style={{
        border: '1px solid var(--borda)',
        borderRadius: 12,
        overflow: 'hidden',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Link href={item.path} style={{ display: 'block' }}>
        {imagemAvif ? (
          <picture>
            <source srcSet={imagemAvif} type="image/avif" />
            <source srcSet={imagemWebp} type="image/webp" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagemWebp ?? ""}
              alt={item.title}
              loading="lazy"
              decoding="async"
              style={{ width: '100%', aspectRatio: '16 / 10', objectFit: 'cover', display: 'block' }}
            />
          </picture>
        ) : (
          <div style={{ width: '100%', aspectRatio: '16 / 10', background: 'var(--rosa-claro)' }} />
        )}
      </Link>

      <div style={{ padding: '0.9rem 1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <h3 style={{ fontSize: '1.02rem', fontWeight: 700, lineHeight: 1.3 }}>
          <Link href={item.path}>{item.title}</Link>
        </h3>
        {resumo && (
          <p style={{ fontSize: '0.9rem', color: 'var(--tinta-suave)', lineHeight: 1.55 }}>{resumo}</p>
        )}
        {typeof item.price_cents === 'number' && item.price_cents > 0 && (
          <p style={{ fontWeight: 700, color: 'var(--rosa)' }}>
            R$ {(item.price_cents / 100).toFixed(2).replace('.', ',')}
          </p>
        )}
      </div>
    </article>
  );
}

export function Grade({ itens }: { itens: Conteudo[] }) {
  return (
    <div
      style={{
        display: 'grid',
        gap: '1.25rem',
        gridTemplateColumns: 'repeat(auto-fill, minmax(15rem, 1fr))',
      }}
    >
      {itens.map((i) => (
        <CardPost key={i.id} item={i} />
      ))}
    </div>
  );
}
