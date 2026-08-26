import type { Metadata } from 'next';
import { Grade } from '../components/CardPost';
import { listar } from '@/lib/conteudo';
import { SITE, BLOQUEAR_INDEXACAO } from '@/lib/seo';

export const revalidate = 3600; // literal: o Next analisa este export estaticamente

export const metadata: Metadata = {
  title: 'Blog — comparativos e cuidados com o cabelo | Juliane Cost',
  description: 'Comparativos, listas e guias sobre progressivas, shampoos, tratamentos e cronograma capilar.',
  alternates: { canonical: `${SITE}/blog/` },
  robots: BLOQUEAR_INDEXACAO ? { index: false, follow: false } : { index: true, follow: true },
};

export default async function Blog() {
  const posts = await listar('post', { limite: 60 });
  return (
    <section style={{ maxWidth: '68rem', margin: '0 auto', padding: '2.5rem 1.25rem 0' }}>
      <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.1rem)', fontWeight: 800 }}>Blog</h1>
      <div style={{ marginTop: '2rem' }}>
        <Grade itens={posts} />
      </div>
    </section>
  );
}
