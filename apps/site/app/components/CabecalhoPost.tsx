import { FotoAutora, CARGO } from './BoxAutora';

/**
 * Cabeçalho do artigo: crédito da autora de um lado, data e tempo de leitura
 * do outro, e a imagem de capa logo abaixo.
 *
 * A capa recebe `fetchPriority="high"` e fica fora do lazy-load porque ela é o
 * maior elemento acima da dobra — é ela que o navegador mede como LCP, a
 * métrica de Core Web Vitals que mais pesa em ranking.
 */
export default function CabecalhoPost({
  publicado,
  atualizado,
  minutos,
  capaAvif,
  titulo,
}: {
  publicado: string | null;
  atualizado: string | null;
  minutos: number;
  capaAvif: string | null;
  titulo: string;
}) {
  const capaWebp = capaAvif?.endsWith('.avif') ? capaAvif.replace(/\.avif$/, '.webp') : capaAvif;

  return (
    <>
      <div
        style={{
          display: 'flex', flexWrap: 'wrap', gap: '1rem 1.5rem',
          alignItems: 'center', justifyContent: 'space-between',
          marginTop: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
          <FotoAutora tamanho={46} />
          <div>
            <p style={{ fontWeight: 700, lineHeight: 1.25 }}>Juliane Cost</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--tinta-suave)', lineHeight: 1.3, maxWidth: '28ch' }}>
              {CARGO}
            </p>
          </div>
        </div>

        <div style={{ fontSize: '0.85rem', color: 'var(--tinta-suave)', textAlign: 'right', lineHeight: 1.7 }}>
          {publicado && <div>{publicado}</div>}
          {atualizado && atualizado !== publicado && <div>Atualizado em {atualizado}</div>}
          <div>{minutos} min de leitura</div>
        </div>
      </div>

      {capaAvif && (
        <picture>
          <source srcSet={capaAvif} type="image/avif" />
          <source srcSet={capaWebp ?? ''} type="image/webp" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={capaWebp ?? ''}
            alt={titulo}
            fetchPriority="high"
            decoding="async"
            style={{
              width: '100%', aspectRatio: '16 / 9', objectFit: 'cover',
              borderRadius: 16, display: 'block', marginTop: '1.75rem',
              background: 'var(--rosa-claro)',
            }}
          />
        </picture>
      )}
    </>
  );
}
