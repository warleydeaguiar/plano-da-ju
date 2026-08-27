import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ListaBlog, { POR_PAGINA, caminhoDaPagina } from '../../ListaBlog';
import { contar } from '@/lib/conteudo';
import { SITE, BLOQUEAR_INDEXACAO } from '@/lib/seo';

export const revalidate = 3600; // literal: o Next analisa este export estaticamente

const numero = (n: string) => (/^[1-9]\d*$/.test(n) ? Number(n) : NaN);

async function ultimaPagina() {
  return Math.max(1, Math.ceil((await contar('post')) / POR_PAGINA));
}

/**
 * Gera as páginas no build para que existam como HTML pronto — é o caminho
 * pelo qual o rastreador chega nos artigos que nenhuma outra página linka.
 */
export async function generateStaticParams() {
  const ultima = await ultimaPagina();
  // A página 1 é /blog/, não /blog/pagina/1/ — duas URLs com a mesma lista
  // seria conteúdo duplicado.
  return Array.from({ length: Math.max(0, ultima - 1) }, (_, i) => ({ n: String(i + 2) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ n: string }>;
}): Promise<Metadata> {
  const { n } = await params;
  const pagina = numero(n);
  return {
    title: `Blog — página ${pagina} | Juliane Cost`,
    description:
      'Comparativos, listas e guias sobre progressivas, shampoos, tratamentos e cronograma capilar.',
    alternates: { canonical: `${SITE}${caminhoDaPagina(pagina)}` },
    robots: BLOQUEAR_INDEXACAO ? { index: false, follow: false } : { index: true, follow: true },
  };
}

export default async function PaginaDoBlog({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params;
  const pagina = numero(n);
  // Página 1 tem endereço próprio (/blog/) e página inexistente não pode
  // responder 200 com lista vazia: o Google trataria como conteúdo raso.
  if (!Number.isFinite(pagina) || pagina < 2 || pagina > (await ultimaPagina())) notFound();
  return <ListaBlog pagina={pagina} />;
}
