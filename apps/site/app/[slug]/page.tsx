import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import JsonLd from '../components/JsonLd';
import Indice from '../components/Indice';
import Trilha from '../components/Trilha';
import BoxAutora from '../components/BoxAutora';
import { ChamadaPlano, ChamadaGrupos } from '../components/Chamadas';
import { Grade } from '../components/CardPost';
import { porPath, todosOsPaths, relacionados } from '@/lib/conteudo';
import { metaDoConteudo, schemaDoPost } from '@/lib/seo';
import { extrairIndice, tempoDeLeitura, dividirPorSecoes } from '@/lib/artigo';

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
  const indice = ehPost ? extrairIndice(item.content_clean) : [];
  const minutos = tempoDeLeitura(item.word_count);
  const sugestoes = ehPost ? await relacionados(item.path) : [];

  // Chamada no meio do texto, não empilhada no fim: a leitora chega aqui com
  // uma dúvida específica e o plano responde justamente a ela. O corte cai
  // sempre antes de um H2, então nunca parte um parágrafo.
  const cortePlano = indice.length >= 5 ? Math.ceil(indice.length / 2) : 0;
  const blocos = ehPost && cortePlano
    ? dividirPorSecoes(item.content_clean, [cortePlano])
    : [item.content_clean || ''];

  return (
    <>
      {ehPost && <JsonLd dados={schemaDoPost(item)} />}

      <article style={{ maxWidth: 'var(--largura)', margin: '0 auto', padding: '1.5rem 1.25rem 0' }}>
        <Trilha
          itens={[
            { nome: 'Início', href: '/' },
            ...(ehPost ? [{ nome: 'Blog', href: '/blog/' }] : []),
            { nome: item.title },
          ]}
        />

        <h1
          style={{
            fontSize: 'clamp(1.7rem, 4.6vw, 2.4rem)',
            fontWeight: 800,
            lineHeight: 1.16,
            letterSpacing: '-0.018em',
            marginTop: '1.1rem',
          }}
        >
          {item.title}
        </h1>

        {ehPost && publicado && (
          <div
            style={{
              marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem 1rem',
              fontSize: '0.875rem', color: 'var(--tinta-suave)',
              paddingBottom: '1.25rem', borderBottom: '1px solid var(--borda)',
            }}
          >
            <BoxAutora compacto />
            <span>{publicado}</span>
            {atualizado && atualizado !== publicado && <span>Atualizado em {atualizado}</span>}
            <span>{minutos} min de leitura</span>
          </div>
        )}

        {indice.length > 0 && <Indice itens={indice} />}

        <div className="artigo" style={{ marginTop: '1.75rem' }} dangerouslySetInnerHTML={{ __html: blocos[0] }} />

        {blocos.length > 1 && (
          <>
            <ChamadaPlano utm="meio-artigo" />
            <div className="artigo" dangerouslySetInnerHTML={{ __html: blocos[1] }} />
          </>
        )}

        {ehPost && (
          <>
            {blocos.length === 1 && <ChamadaPlano utm="fim-artigo" />}
            <ChamadaGrupos utm="fim-artigo" />
            <BoxAutora />
          </>
        )}
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
