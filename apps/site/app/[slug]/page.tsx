import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import JsonLd from '../components/JsonLd';
import { Grade } from '../components/CardPost';
import { porPath, todosOsPaths, relacionados } from '@/lib/conteudo';
import { metaDoConteudo, schemaDoPost } from '@/lib/seo';

export const revalidate = 3600; // literal: o Next analisa este export estaticamente
export const dynamicParams = true;

/**
 * Rota raiz do WordPress: post e página compartilham /{slug}/. É por isso que
 * ela busca por `path` em vez de por tipo — a URL indexada é a chave, e o tipo
 * só decide o que renderizar depois.
 */
export async function generateStaticParams() {
  const [posts, paginas] = await Promise.all([todosOsPaths('post'), todosOsPaths('page')]);
  return [...posts, ...paginas]
    .filter((p) => p.path.split('/').filter(Boolean).length === 1)
    .map((p) => ({ slug: p.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = await porPath(`/${slug}/`);
  return item ? metaDoConteudo(item) : {};
}

function dataBr(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default async function Pagina({ params }: Props) {
  const { slug } = await params;
  const item = await porPath(`/${slug}/`);
  if (!item) notFound();

  const ehPost = item.kind === 'post';
  const publicado = dataBr(item.published_at);
  const atualizado = dataBr(item.modified_at);
  const sugestoes = ehPost ? await relacionados(item.path) : [];

  return (
    <>
      {ehPost && <JsonLd dados={schemaDoPost(item)} />}

      <article style={{ maxWidth: 'var(--largura)', margin: '0 auto', padding: '2.5rem 1.25rem 0' }}>
        <h1 style={{ fontSize: 'clamp(1.6rem, 4.5vw, 2.3rem)', fontWeight: 800, lineHeight: 1.18, letterSpacing: '-0.015em' }}>
          {item.title}
        </h1>

        {ehPost && publicado && (
          <p style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: 'var(--tinta-suave)' }}>
            Por Juliane Cost · {publicado}
            {atualizado && atualizado !== publicado && ` · atualizado em ${atualizado}`}
          </p>
        )}

        <div
          className="artigo"
          style={{ marginTop: '2rem' }}
          dangerouslySetInnerHTML={{ __html: item.content_clean || '' }}
        />
      </article>

      {sugestoes.length > 0 && (
        <section style={{ maxWidth: '68rem', margin: '4rem auto 0', padding: '0 1.25rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem' }}>
            Continue lendo
          </h2>
          <Grade itens={sugestoes} />
        </section>
      )}
    </>
  );
}
