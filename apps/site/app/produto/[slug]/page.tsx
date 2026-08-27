import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import JsonLd from '../../components/JsonLd';
import Avaliacoes from '../../components/Avaliacoes';
import { porPath, todosOsPaths, dimensaoDaImagem, avaliacoesDoProduto } from '@/lib/conteudo';
import { metaDoConteudo, schemaDoProduto } from '@/lib/seo';
import { linkDoProduto } from '@/lib/whatsapp';

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
  const imagemWebp = imagemAvif?.endsWith('.avif') ? imagemAvif.replace(/\.avif$/, '.webp') : (imagemAvif ?? undefined);
  const temPreco = typeof item.price_cents === 'number' && item.price_cents > 0;
  // Foto de produto tem proporção variável, então `aspect-ratio` fixo
  // distorceria. A dimensão real vem do banco.
  const [tamanho, avaliacoes] = await Promise.all([
    dimensaoDaImagem(imagemAvif),
    avaliacoesDoProduto(item.id),
  ]);

  return (
    <>
      <JsonLd dados={schemaDoProduto(item, avaliacoes)} />

      <article style={{ maxWidth: '68rem', margin: '0 auto', padding: '2.5rem 1.25rem 0' }}>
        <div style={{ display: 'grid', gap: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(18rem, 1fr))', alignItems: 'start' }}>
          {imagemAvif && (
            <picture>
              <source srcSet={imagemAvif} type="image/avif" />
              <source srcSet={imagemWebp} type="image/webp" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagemWebp ?? ''}
                alt={item.title}
                decoding="async"
                {...(tamanho ? { width: tamanho.width, height: tamanho.height } : {})}
                style={{ width: '100%', height: 'auto', borderRadius: 14, border: '1px solid var(--borda)', display: 'block' }}
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

            {/* A compra passa pelo WhatsApp da Juliane, não pelo link de
                afiliado direto: ela atende, entende o cabelo da pessoa e manda
                o link com desconto adicional. Num produto de química capilar
                isso evita que a cliente compre o item errado para o fio dela. */}
            <a
              href={linkDoProduto(item.title)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
                marginTop: '1.5rem', background: '#25D366', color: '#0b3d20', fontWeight: 800,
                padding: '1rem 1.5rem', borderRadius: 999, fontSize: '1.05rem', lineHeight: 1.2,
              }}
            >
              <span aria-hidden style={{ fontSize: '1.2rem' }}>💬</span>
              Falar com a Juliane e comprar
            </a>

            <p style={{ marginTop: '0.85rem', fontSize: '0.85rem', color: 'var(--tinta-suave)', textAlign: 'center', lineHeight: 1.5 }}>
              Ela te manda o link com <strong style={{ color: 'var(--tinta)' }}>desconto adicional</strong> e
              tira suas dúvidas antes de você comprar.
            </p>
          </div>
        </div>

        <div
          className="artigo"
          style={{ marginTop: '3rem', maxWidth: 'var(--largura)' }}
          dangerouslySetInnerHTML={{ __html: item.content_clean || '' }}
        />

        <div style={{ maxWidth: 'var(--largura)' }}>
          <Avaliacoes itens={avaliacoes.itens} resumo={avaliacoes.resumo} />
        </div>
      </article>
    </>
  );
}
