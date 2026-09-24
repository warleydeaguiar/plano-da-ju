import Link from 'next/link';
import type { Conteudo } from '@/lib/conteudo';

/**
 * Card da vitrine de produtos.
 *
 * Existe separado do CardPost porque a loja estava usando o card do blog: cada
 * produto vinha com foto da autora, credencial e a data de publicação — e uma
 * data de 2023 num produto faz a loja parecer abandonada. Aqui fica só o que
 * ajuda a escolher: a foto inteira, o nome e o preço quando existe.
 *
 * A foto usa `contain` sobre fundo claro em vez de `cover`: produto é frasco
 * vertical, e recortar para caber num 16/10 cortava justamente o rótulo.
 */
export default function CardProduto({ item }: { item: Conteudo }) {
  const avif = item.og_image || item.featured_image_url;
  const webp = avif?.endsWith('.avif') ? avif.replace(/\.avif$/, '.webp') : (avif ?? undefined);
  const preco = typeof item.price_cents === 'number' && item.price_cents > 0
    ? `R$ ${(item.price_cents / 100).toFixed(2).replace('.', ',')}`
    : null;

  return (
    <Link
      href={item.path}
      className="card-produto"
      style={{
        display: 'flex', flexDirection: 'column', height: '100%',
        borderRadius: 16, overflow: 'hidden', background: '#fff',
        border: '1px solid var(--borda)', textDecoration: 'none', color: 'inherit',
      }}
    >
      {/* Fundo branco, não rosa: metade das fotos do fornecedor já vem com fundo
          branco recortado, e sobre o rosa cada uma virava um quadrado claro
          dentro de outro — a grade ficava suja. */}
      <div style={{ background: '#fff', padding: '0.65rem 0.65rem 0' }}>
        {webp ? (
          <picture>
            <source srcSet={avif ?? undefined} type="image/avif" />
            <source srcSet={webp} type="image/webp" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={webp}
              alt={item.title}
              loading="lazy"
              decoding="async"
              style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'contain', display: 'block' }}
            />
          </picture>
        ) : (
          <div style={{ width: '100%', aspectRatio: '1 / 1' }} />
        )}
      </div>

      <div style={{ padding: '0.8rem 0.85rem 0.95rem', display: 'flex', flexDirection: 'column', flex: 1, gap: '0.35rem' }}>
        <h3
          style={{
            fontSize: '0.92rem', fontWeight: 700, lineHeight: 1.35, margin: 0,
            // Duas linhas no máximo: com o nome inteiro, um card ficava o dobro
            // do vizinho e a grade desalinhava.
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}
        >
          {item.title}
        </h3>

        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem' }}>
          {preco
            ? <span style={{ fontWeight: 800, color: 'var(--rosa)', fontSize: '1rem' }}>{preco}</span>
            : <span style={{ fontSize: '0.8rem', color: 'var(--tinta-suave)' }}>Ver análise</span>}
          <span aria-hidden style={{ color: 'var(--rosa)', fontWeight: 700 }}>→</span>
        </div>
      </div>
    </Link>
  );
}

export function GradeProdutos({ itens }: { itens: Conteudo[] }) {
  return (
    <div
      style={{
        display: 'grid',
        gap: '0.85rem',
        // 2 colunas no celular (onde está 87% do tráfego) e até 4 no desktop.
        // Com o mínimo de 16rem do card do blog, só cabia UMA por tela: a
        // vitrine tinha 23 mil pixels de altura para 47 produtos.
        gridTemplateColumns: 'repeat(auto-fill, minmax(9.5rem, 1fr))',
      }}
    >
      {itens.map((i) => <CardProduto key={i.id} item={i} />)}
    </div>
  );
}
