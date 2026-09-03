import Link from 'next/link';
import type { Metadata } from 'next';
import { Grade } from './components/CardPost';
import { FotoAutora, CARGO, REDES } from './components/BoxAutora';
import IconeWhatsapp from './components/IconeWhatsapp';
import { listar } from '@/lib/conteudo';
import { SITE, BLOQUEAR_INDEXACAO } from '@/lib/seo';

export const revalidate = 3600; // literal: o Next analisa este export estaticamente

const PLANO = 'https://planodaju.julianecost.com/quiz';
const GRUPOS = 'https://grupos.julianecost.com/';

// A home herdava só o metadata do layout, que não tem canonical. Sem ele o
// Google escolhe sozinho qual endereço da home é o oficial — e com apex, www e
// variações com parâmetro, ele erra.
export const metadata: Metadata = {
  title: 'Juliane Cost — tricologista: o que realmente funciona no seu cabelo',
  description:
    'Comparativos e avaliações honestas de progressivas, shampoos e tratamentos, testados por '
    + 'uma tricologista. E um plano capilar montado para o seu cabelo.',
  alternates: { canonical: `${SITE}/` },
  robots: BLOQUEAR_INDEXACAO ? { index: false, follow: false } : { index: true, follow: true },
};

const FAIXA = { maxWidth: '68rem', margin: '0 auto', padding: '0 1.25rem' } as const;

/** Título de seção com um link "ver todos" à direita. */
function TituloSecao({ titulo, apoio, href, verTodos }: {
  titulo: string; apoio?: string; href?: string; verTodos?: string;
}) {
  return (
    <div style={{ marginBottom: '1.4rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem' }}>
        <h2 style={{ fontSize: 'clamp(1.25rem, 3vw, 1.6rem)', fontWeight: 800, letterSpacing: '-0.01em' }}>
          {titulo}
        </h2>
        {href && (
          <Link href={href} style={{ color: 'var(--rosa)', fontSize: '0.9rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {verTodos ?? 'ver todos'} →
          </Link>
        )}
      </div>
      {apoio && (
        <p style={{ color: 'var(--tinta-suave)', marginTop: '0.4rem', maxWidth: '46rem', lineHeight: 1.55 }}>
          {apoio}
        </p>
      )}
    </div>
  );
}

export default async function Home() {
  const [maisLidos, recentes, produtos] = await Promise.all([
    // Por tráfego: é a seção que a leitora nova deve ver primeiro, porque são
    // os textos que já provaram responder o que ela veio procurar.
    listar('post', { limite: 6, por: 'trafego' }),
    listar('post', { limite: 9 }),
    listar('product', { limite: 8, por: 'trafego' }),
  ]);

  // O que já está entre os mais lidos não repete logo abaixo em "recentes".
  const jaMostrados = new Set(maisLidos.map((p) => p.path));
  const ultimos = recentes.filter((p) => !jaMostrados.has(p.path)).slice(0, 6);

  return (
    <>
      {/* ─────────────────────────────────────────────────────────── herói */}
      <section
        style={{
          background: 'linear-gradient(165deg, var(--rosa-claro) 0%, var(--creme) 60%)',
          borderBottom: '1px solid var(--borda)',
          padding: '3.5rem 0 3rem',
        }}
      >
        <div style={{ ...FAIXA, display: 'grid', gap: '2rem', gridTemplateColumns: 'minmax(0, 1fr)' }}>
          <div>
            <p style={{
              fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.09em',
              textTransform: 'uppercase', color: 'var(--rosa)', marginBottom: '0.75rem',
            }}>
              Juliane Cost · Tricologista
            </p>
            <h1 style={{
              fontSize: 'clamp(1.9rem, 5.5vw, 3rem)', fontWeight: 800,
              lineHeight: 1.1, letterSpacing: '-0.025em', maxWidth: '18ch',
            }}>
              O que realmente funciona no seu cabelo
            </h1>
            <p style={{
              marginTop: '1.1rem', color: 'var(--tinta-suave)',
              fontSize: '1.06rem', lineHeight: 1.6, maxWidth: '38rem',
            }}>
              Eu testo progressiva, shampoo e tratamento antes de indicar, e escrevo o que
              descobri sem enrolação. Se você quer parar de gastar no produto errado,
              começa por aqui.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1.75rem' }}>
              <a
                href={PLANO}
                style={{
                  padding: '0.95rem 1.5rem', borderRadius: 14, background: 'var(--rosa)',
                  color: '#fff', fontWeight: 700, fontSize: '1rem',
                  boxShadow: '0 8px 20px rgba(196,120,143,0.3)',
                }}
              >
                Montar meu plano capilar
              </a>
              <a
                href={GRUPOS}
                style={{
                  padding: '0.95rem 1.5rem', borderRadius: 14, background: '#fff',
                  border: '1px solid var(--borda)', color: 'var(--tinta)',
                  fontWeight: 700, fontSize: '1rem',
                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                }}
              >
                <IconeWhatsapp tamanho={18} />
                Entrar no grupo de promoções
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────── confiança */}
      <section style={{ borderBottom: '1px solid var(--borda)', background: '#fff', padding: '1.4rem 0' }}>
        <div style={{
          ...FAIXA, display: 'flex', flexWrap: 'wrap', gap: '1.5rem 2.5rem',
          justifyContent: 'center', textAlign: 'center',
        }}>
          {[
            { n: '+30 mil', t: 'mulheres já cuidam do cabelo comigo' },
            { n: '185', t: 'comparativos e guias publicados' },
            { n: '47', t: 'produtos testados e avaliados' },
          ].map((x) => (
            <div key={x.t}>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--rosa)' }}>{x.n}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--tinta-suave)' }}>{x.t}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ──────────────────────────────────────────────────── mais lidos */}
      <section style={{ ...FAIXA, marginTop: '3.25rem' }}>
        <TituloSecao
          titulo="Os mais lidos"
          apoio="Os textos que mais gente procura aqui — começa por eles se você não sabe por onde começar."
          href="/blog/"
        />
        <Grade itens={maisLidos} />
      </section>

      {/* ───────────────────────────────────────────────────── do blog */}
      {ultimos.length > 0 && (
        <section style={{ ...FAIXA, marginTop: '3.25rem' }}>
          <TituloSecao titulo="Últimos do blog" href="/blog/" verTodos="ver o blog" />
          <Grade itens={ultimos} />
        </section>
      )}

      {/* ───────────────────────────────────────────────────── produtos */}
      <section style={{ ...FAIXA, marginTop: '3.25rem' }}>
        <TituloSecao
          titulo="Produtos que eu indico"
          apoio="Os mais procurados pelas leitoras. Clicando, você fala comigo no WhatsApp e eu te mando o link com desconto adicional."
          href="/loja/"
          verTodos="ver a loja"
        />
        <Grade itens={produtos} />
      </section>

      {/* ────────────────────────────────────────────────────────── bio */}
      <section style={{ marginTop: '3.5rem', background: 'var(--creme)', borderTop: '1px solid var(--borda)', borderBottom: '1px solid var(--borda)', padding: '3rem 0' }}>
        <div style={{ ...FAIXA, display: 'flex', gap: '1.75rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <FotoAutora tamanho={132} />
          <div style={{ flex: 1, minWidth: '17rem' }}>
            <h2 style={{ fontSize: 'clamp(1.25rem, 3vw, 1.6rem)', fontWeight: 800, letterSpacing: '-0.01em' }}>
              Quem escreve aqui
            </h2>
            <p style={{ color: 'var(--rosa)', fontWeight: 600, fontSize: '0.92rem', marginTop: '0.35rem' }}>
              {CARGO}
            </p>
            <p style={{ marginTop: '0.9rem', color: 'var(--tinta-suave)', lineHeight: 1.65, maxWidth: '44rem' }}>
              Sou a Juliane. Passo o dia entre o consultório e os produtos que chegam para eu
              testar — e o que aprendo vira texto aqui. Não indico nada que eu não usaria, e
              quando um produto famoso não entrega, eu escrevo isso também. Mais de 30 mil
              mulheres já montaram a rotina do cabelo comigo.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '1.25rem' }}>
              {REDES.map((r) => (
                <a
                  key={r.url}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '0.55rem 1rem', borderRadius: 999, background: '#fff',
                    border: '1px solid var(--borda)', color: 'var(--tinta-suave)',
                    fontSize: '0.85rem', fontWeight: 600,
                  }}
                >
                  {r.nome}
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────── chamada final */}
      <section style={{ ...FAIXA, marginTop: '3.5rem', marginBottom: '1rem' }}>
        <div style={{
          background: 'linear-gradient(140deg, var(--rosa-claro), var(--creme))',
          border: '1px solid var(--borda)', borderRadius: 20,
          padding: 'clamp(1.75rem, 5vw, 2.75rem)', textAlign: 'center',
        }}>
          <h2 style={{ fontSize: 'clamp(1.35rem, 3.5vw, 1.9rem)', fontWeight: 800, letterSpacing: '-0.015em', maxWidth: '24ch', margin: '0 auto' }}>
            Cansada de comprar produto que não funciona?
          </h2>
          <p style={{ color: 'var(--tinta-suave)', marginTop: '0.85rem', maxWidth: '38rem', margin: '0.85rem auto 0', lineHeight: 1.6 }}>
            Responde algumas perguntas sobre o seu cabelo e eu monto um plano de 90 dias com o
            que você já tem em casa — e só o que faltar mesmo entra na lista de compras.
          </p>
          <a
            href={PLANO}
            style={{
              display: 'inline-block', marginTop: '1.5rem',
              padding: '1rem 1.9rem', borderRadius: 14, background: 'var(--rosa)',
              color: '#fff', fontWeight: 700, fontSize: '1.02rem',
              boxShadow: '0 8px 22px rgba(196,120,143,0.32)',
            }}
          >
            Quero o meu plano capilar
          </a>
        </div>
      </section>
    </>
  );
}
