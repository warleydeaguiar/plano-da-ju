import type { Metadata } from 'next';
import { Grade } from '../components/CardPost';
import { listar } from '@/lib/conteudo';
import { SITE, BLOQUEAR_INDEXACAO } from '@/lib/seo';

export const revalidate = 3600; // literal: o Next analisa este export estaticamente

export const metadata: Metadata = {
  title: 'Produtos que eu indico — Juliane Cost',
  description: 'Os produtos de cabelo e cuidados que eu uso, testo e indico, com avaliação honesta.',
  alternates: { canonical: `${SITE}/loja/` },
  robots: BLOQUEAR_INDEXACAO ? { index: false, follow: false } : { index: true, follow: true },
};

export default async function Loja() {
  const produtos = await listar('product', { limite: 100, por: 'trafego' });
  return (
    <section style={{ maxWidth: '68rem', margin: '0 auto', padding: '2.5rem 1.25rem 0' }}>
      <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.1rem)', fontWeight: 800 }}>Produtos que eu indico</h1>
      <p style={{ marginTop: '0.75rem', color: 'var(--tinta-suave)', maxWidth: 'var(--largura)' }}>
        Cada produto aqui tem uma análise minha. A compra é feita no site do parceiro.
      </p>
      <div style={{ marginTop: '2rem' }}>
        <Grade itens={produtos} />
      </div>
    </section>
  );
}
