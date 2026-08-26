import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import JsonLd from '../../components/JsonLd';
import { porPath, todosOsPaths } from '@/lib/conteudo';
import { metaDoConteudo, schemaDoProduto } from '@/lib/seo';

export const revalidate = 3600; // literal: o Next analisa este export estaticamente
export const dynamicParams = true;

export async function generateStaticParams() {
  const produtos = await todosOsPaths('product');
  return produtos
    .filter((p) => p.path.startsWith('/produto/'))
    .map((p) => ({ slug: p.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = await porPath(`/produto/${slug}/`);
  return item ? metaDoConteudo(item) : {};
}

const reais = (centavos: number) => `R$ ${(centavos / 100).toFixed(2).replace('.', ',')}`;

export default async function PaginaProduto({ params }: Props) {
  const { slug } = await params;
  const item = await porPath(`/produto/${slug}/`);
  if (!item) notFound();

  const imagemAvif = item.og_image || item.featured_image_url;
  const imagemWebp = imagemAvif?.endsWith(".avif") ? imagemAvif.replace(/\.avif$/, ".webp") : (imagemAvif ?? undefined);
  const temPreco = typeof item.price_cents === 'number' && item.price_cents > 0;

  return (
    <>
      <JsonLd dados={schemaDoProduto(item)} />

      <article style={{ maxWidth: '68rem', margin: '0 auto', padding: '2.5rem 1.25rem 0' }}>
        <div style={{ display: 'grid', gap: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(18rem, 1fr))', alignItems: 'start' }}>
          {imagemAvif && (
            <picture>
              <source srcSet={imagemAvif} type="image/avif" />
              <source srcSet={imagemWebp} type="image/webp" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagemWebp ?? ""}
                alt={item.title}
                decoding="async"
                style={{ width: '100%', borderRadius: 14, border: '1px solid var(--borda)', display: 'block' }}
              />
            </picture>
          )}

          <div>
            <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.1rem)', fontWeight: 800, lineHeight: 1.2 }}>
              {item.title}
            </h1>

            {temPreco && (
              <p style={{ marginTop: '1rem', display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
                {item.price_original_cents && item.price_original_cents > item.price_cents! && (
                  <span style={{ color: 'var(--tinta-suave)', textDecoration: 'line-through' }}>
                    {reais(item.price_original_cents)}
                  </span>
                )}
                <span style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--rosa)' }}>
                  {reais(item.price_cents!)}
                </span>
              </p>
            )}

            {item.affiliate_url && (
              <a
                href={item.affiliate_url}
                target="_blank"
                rel="sponsored noopener noreferrer"
                style={{
                  display: 'block', textAlign: 'center', marginTop: '1.5rem',
                  background: 'var(--rosa)', color: '#fff', fontWeight: 700,
                  padding: '0.95rem 1.5rem', borderRadius: 999, fontSize: '1.02rem',
                }}
              >
                Ver na loja oficial
              </a>
            )}

            <p style={{ marginTop: '0.85rem', fontSize: '0.8rem', color: 'var(--tinta-suave)', textAlign: 'center' }}>
              Você é levada ao site do parceiro para finalizar a compra.
            </p>
          </div>
        </div>

        <div
          className="artigo"
          style={{ marginTop: '3rem', maxWidth: 'var(--largura)' }}
          dangerouslySetInnerHTML={{ __html: item.content_clean || '' }}
        />
      </article>
    </>
  );
}
