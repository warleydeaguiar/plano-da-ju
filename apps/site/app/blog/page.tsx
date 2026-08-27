import type { Metadata } from 'next';
import ListaBlog from './ListaBlog';
import { SITE, BLOQUEAR_INDEXACAO } from '@/lib/seo';

export const revalidate = 3600; // literal: o Next analisa este export estaticamente

export const metadata: Metadata = {
  title: 'Blog — comparativos e cuidados com o cabelo | Juliane Cost',
  description: 'Comparativos, listas e guias sobre progressivas, shampoos, tratamentos e cronograma capilar.',
  alternates: { canonical: `${SITE}/blog/` },
  robots: BLOQUEAR_INDEXACAO ? { index: false, follow: false } : { index: true, follow: true },
};

export default async function Blog() {
  return <ListaBlog pagina={1} />;
}
