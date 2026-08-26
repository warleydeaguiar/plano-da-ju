import Link from 'next/link';
import type { Conteudo } from '@/lib/conteudo';
import { FotoAutora } from './BoxAutora';
import { tempoDeLeitura } from '@/lib/artigo';

const NOMEADAS: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  hellip: '…', ndash: '–', mdash: '—', rsquo: '’', ldquo: '“', rdquo: '”',
};

/**
 * Tira as tags e decodifica a entidade. O resumo vem do WordPress já
 * codificado; sem decodificar, o React escapa o `&` de novo e o visitante lê
 * "&#8211;" na tela em vez do travessão.
 */
const semTags = (html: string | null, limite = 130) => {
  if (!html) return '';
  const t = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/gi, (inteiro, nome) => NOMEADAS[String(nome).toLowerCase()] ?? inteiro)
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > limite ? `${t.slice(0, limite).trimEnd()}…` : t;
};

const dataCurta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : null;

const ROTULO: Record<string, string> = { post: 'Blog da Juliane', product: 'Produto indicado', page: '' };

/**
 * Card de listagem.
 *
 * O rodapé com foto, nome e credencial da autora repete em toda listagem de
 * propósito: é o mesmo sinal de E-E-A-T do artigo, e faz a leitora associar o
 * conteúdo a uma tricologista antes mesmo de clicar.
 *
 * A imagem usa <picture> em vez de next/image porque os arquivos já foram
 * convertidos para AVIF e WebP na migração — otimizar de novo em runtime só
 * custaria transformação sem ganho.
 */
export default function CardPost({ item }: { item: Conteudo }) {
  const imagemAvif = item.og_image || item.featured_image_url;
  const imagemWebp = imagemAvif?.endsWith('.avif') ? imagemAvif.replace(/\.avif$/, '.webp') : (imagemAvif ?? undefined);
  const resumo = semTags(item.excerpt_html) || semTags(item.seo_description);
  const minutos = tempoDeLeitura(item.word_count);
  const data = dataCurta(item.published_at);
  const rotulo = ROTULO[item.kind] ?? '';

  return (
    <article
      style={{
        border: '1px solid var(--borda)', borderRadius: 14, overflow: 'hidden',
        background: '#fff', display: 'flex', flexDirection: 'column',
      }}
    >
      <Link href={item.path} style={{ display: 'block' }}>
        {imagemAvif ? (
          <picture>
            <source srcSet={imagemAvif} type="image/avif" />
            <source srcSet={imagemWebp} type="image/webp" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagemWebp ?? ''}
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

      <div style={{ padding: '1rem 1.1rem 1.1rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem',
            fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.07em',
            textTransform: 'uppercase', color: 'var(--tinta-suave)',
          }}
        >
          <span>{rotulo}</span>
          {item.kind === 'post' && <span style={{ whiteSpace: 'nowrap' }}>{minutos} min</span>}
        </div>

        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, lineHeight: 1.3, marginTop: '0.55rem' }}>
          <Link href={item.path}>{item.title}</Link>
        </h3>

        {resumo && (
          <p style={{ fontSize: '0.9rem', color: 'var(--tinta-suave)', lineHeight: 1.55, marginTop: '0.5rem' }}>
            {resumo}
          </p>
        )}

        {typeof item.price_cents === 'number' && item.price_cents > 0 && (
          <p style={{ fontWeight: 800, color: 'var(--rosa)', marginTop: '0.6rem' }}>
            R$ {(item.price_cents / 100).toFixed(2).replace('.', ',')}
          </p>
        )}

        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem',
            marginTop: 'auto', paddingTop: '0.9rem', borderTop: '1px solid var(--borda)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0 }}>
            <FotoAutora tamanho={34} />
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 700, lineHeight: 1.2 }}>Juliane Cost</p>
              <p style={{ fontSize: '0.72rem', color: 'var(--tinta-suave)', lineHeight: 1.2 }}>Tricologista</p>
            </div>
          </div>
          {data && (
            <span style={{ fontSize: '0.75rem', color: 'var(--tinta-suave)', whiteSpace: 'nowrap' }}>{data}</span>
          )}
        </div>
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
        gridTemplateColumns: 'repeat(auto-fill, minmax(16rem, 1fr))',
      }}
    >
      {itens.map((i) => (
        <CardPost key={i.id} item={i} />
      ))}
    </div>
  );
}
