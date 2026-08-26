import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Grade } from '../../components/CardPost';
import { categoriaPorPath, categorias, listar } from '@/lib/conteudo';
import { metaDaCategoria } from '@/lib/seo';

export const revalidate = 3600; // literal: o Next analisa este export estaticamente
export const dynamicParams = true;

export async function generateStaticParams() {
  const cats = await categorias('product_cat');
  return cats.map((c) => ({ slug: c.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const cat = await categoriaPorPath(`/categoria-produto/${slug}/`);
  return cat ? metaDaCategoria(cat) : {};
}

export default async function PaginaCategoriaProduto({ params }: Props) {
  const { slug } = await params;
  const cat = await categoriaPorPath(`/categoria-produto/${slug}/`);
  if (!cat) notFound();
  // A ligação produto↔categoria do Woo não veio na migração; até ela existir,
  // a página lista o catálogo para não devolver vazio a uma URL indexada.
  const produtos = await listar('product', { limite: 60 });

  return (
    <section style={{ maxWidth: '68rem', margin: '0 auto', padding: '2.5rem 1.25rem 0' }}>
      <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.1rem)', fontWeight: 800 }}>{cat.name}</h1>
      {cat.description && (
        <p style={{ marginTop: '0.75rem', color: 'var(--tinta-suave)', maxWidth: 'var(--largura)' }}>
          {cat.description}
        </p>
      )}
      <div style={{ marginTop: '2rem' }}>
        <Grade itens={produtos} />
      </div>
    </section>
  );
}
