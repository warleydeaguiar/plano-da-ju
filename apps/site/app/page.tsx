import Link from 'next/link';
import type { Metadata } from 'next';
import { Grade } from './components/CardPost';
import { listar } from '@/lib/conteudo';
import { SITE, BLOQUEAR_INDEXACAO } from '@/lib/seo';

export const revalidate = 3600; // literal: o Next analisa este export estaticamente

// A home herdava só o metadata do layout, que não tem canonical. Sem ele o
// Google escolhe sozinho qual endereço da home é o oficial — e com apex, www e
// variações com parâmetro, ele erra.
export const metadata: Metadata = {
  alternates: { canonical: `${SITE}/` },
  robots: BLOQUEAR_INDEXACAO ? { index: false, follow: false } : { index: true, follow: true },
};

export default async function Home() {
  const [posts, produtos] = await Promise.all([
    listar('post', { limite: 12 }),
    listar('product', { limite: 8 }),
  ]);

  return (
    <>
      <section style={{ maxWidth: '68rem', margin: '0 auto', padding: '3rem 1.25rem 0' }}>
        <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 2.6rem)', fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.02em', maxWidth: '30ch' }}>
          Qual produto realmente funciona no seu cabelo?
        </h1>
        <p style={{ marginTop: '1rem', color: 'var(--tinta-suave)', fontSize: '1.05rem', maxWidth: 'var(--largura)' }}>
          Comparativos e avaliações honestas de progressivas, shampoos e tratamentos — testados e
          explicados, sem enrolação.
        </p>
      </section>

      <section style={{ maxWidth: '68rem', margin: '3rem auto 0', padding: '0 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Últimos comparativos</h2>
          <Link href="/blog/" style={{ color: 'var(--rosa)', fontSize: '0.9rem' }}>ver todos</Link>
        </div>
        <Grade itens={posts} />
      </section>

      <section style={{ maxWidth: '68rem', margin: '3.5rem auto 0', padding: '0 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Produtos que eu indico</h2>
          <Link href="/loja/" style={{ color: 'var(--rosa)', fontSize: '0.9rem' }}>ver todos</Link>
        </div>
        <Grade itens={produtos} />
      </section>
    </>
  );
}
