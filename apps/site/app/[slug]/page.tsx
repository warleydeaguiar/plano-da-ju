import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import JsonLd from '../components/JsonLd';
import Indice from '../components/Indice';
import Trilha from '../components/Trilha';
import Faq from '../components/Faq';
import BoxAutora from '../components/BoxAutora';
import CabecalhoPost from '../components/CabecalhoPost';
import { ChamadaPlano, ChamadaGrupos } from '../components/Chamadas';
import { Grade } from '../components/CardPost';
import { porPath, todosOsPaths, relacionados, faqDoPost, dataDeAtualizacao } from '@/lib/conteudo';
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
  const indice = ehPost ? extrairIndice(item.content_clean) : [];
  const [sugestoes, faq] = ehPost
    ? await Promise.all([relacionados(item.path), faqDoPost(item.id)])
    : [[], []];

  // Chamada no meio do texto, não empilhada no fim: a leitora chega aqui com
  // uma dúvida específica e o plano responde justamente a ela. O corte cai
  // sempre antes de um H2, então nunca parte um parágrafo.
  const cortePlano = ehPost && indice.length >= 5 ? Math.ceil(indice.length / 2) : 0;
  const blocos = cortePlano
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
            fontWeight: 800, lineHeight: 1.16,
            letterSpacing: '-0.018em', marginTop: '1.1rem',
          }}
        >
          {item.title}
        </h1>

        {ehPost && (
          <CabecalhoPost
            publicado={dataBr(item.published_at)}
            atualizado={dataBr(dataDeAtualizacao(item))}
            minutos={tempoDeLeitura(item.word_count)}
            capaAvif={item.og_image || item.featured_image_url}
            titulo={item.title}
          />
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
            <Faq itens={faq} />
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
