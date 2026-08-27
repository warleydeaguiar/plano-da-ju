import Link from 'next/link';
import { Grade } from '../components/CardPost';
import { listar, contar } from '@/lib/conteudo';

/** Posts por página. 24 cabe numa rolagem de celular sem virar lista infinita. */
export const POR_PAGINA = 24;

export const caminhoDaPagina = (n: number) => (n <= 1 ? '/blog/' : `/blog/pagina/${n}/`);

/**
 * Listagem paginada do blog.
 *
 * A paginação não é enfeite: o /blog/ mostrava só 60 dos 185 posts e não
 * tinha página 2, então 125 artigos existiam apenas no sitemap, sem nenhum
 * link que levasse até eles. O WordPress tinha /page/2/ e /page/3/ e isso se
 * perdeu na migração. Sem caminho de rastreamento o Google visita pouco e
 * indexa menos — era parte do balde "rastreada, mas não indexada".
 */
export default async function ListaBlog({ pagina }: { pagina: number }) {
  const [posts, total] = await Promise.all([
    listar('post', { limite: POR_PAGINA, offset: (pagina - 1) * POR_PAGINA }),
    contar('post'),
  ]);
  const ultima = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <section style={{ maxWidth: '68rem', margin: '0 auto', padding: '2.5rem 1.25rem 0' }}>
      <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.1rem)', fontWeight: 800 }}>
        Blog{pagina > 1 ? ` — página ${pagina}` : ''}
      </h1>
      {pagina === 1 && (
        <p style={{ color: 'var(--tinta-suave)', marginTop: '0.6rem', maxWidth: '44rem' }}>
          Comparativos, listas e guias sobre progressivas, shampoos, tratamentos e cronograma
          capilar — testados e explicados pela Juliane.
        </p>
      )}

      <div style={{ marginTop: '2rem' }}>
        <Grade itens={posts} />
      </div>

      {ultima > 1 && <Paginacao pagina={pagina} ultima={ultima} />}
    </section>
  );
}

/**
 * Todas as páginas ficam visíveis de uma vez quando são poucas. Passando de
 * oito, mostra só a vizinhança mais a primeira e a última — assim o rastreador
 * sempre alcança as pontas em um salto e a barra não estoura no celular.
 */
function numerosVisiveis(pagina: number, ultima: number): (number | '…')[] {
  if (ultima <= 8) return Array.from({ length: ultima }, (_, i) => i + 1);
  const perto = new Set([1, ultima, pagina, pagina - 1, pagina + 1, pagina - 2, pagina + 2]);
  const saida: (number | '…')[] = [];
  let pulou = false;
  for (let n = 1; n <= ultima; n++) {
    if (perto.has(n)) {
      saida.push(n);
      pulou = false;
    } else if (!pulou) {
      saida.push('…');
      pulou = true;
    }
  }
  return saida;
}

function Paginacao({ pagina, ultima }: { pagina: number; ultima: number }) {
  const estiloBase: React.CSSProperties = {
    minWidth: '2.6rem',
    padding: '0.6rem 0.75rem',
    borderRadius: 10,
    border: '1px solid var(--borda)',
    textAlign: 'center',
    fontSize: '0.95rem',
    lineHeight: 1.2,
  };

  return (
    <nav
      aria-label="Páginas do blog"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.5rem',
        justifyContent: 'center',
        alignItems: 'center',
        margin: '2.5rem 0 1rem',
      }}
    >
      {pagina > 1 && (
        <Link href={caminhoDaPagina(pagina - 1)} rel="prev" style={{ ...estiloBase, fontWeight: 600 }}>
          ← Anterior
        </Link>
      )}

      {numerosVisiveis(pagina, ultima).map((n, i) =>
        n === '…' ? (
          <span key={`p${i}`} style={{ ...estiloBase, border: 'none', color: 'var(--tinta-suave)' }}>
            …
          </span>
        ) : n === pagina ? (
          <span
            key={n}
            aria-current="page"
            style={{ ...estiloBase, background: 'var(--rosa, #b76e79)', color: '#fff', fontWeight: 700, borderColor: 'transparent' }}
          >
            {n}
          </span>
        ) : (
          <Link key={n} href={caminhoDaPagina(n)} style={estiloBase}>
            {n}
          </Link>
        ),
      )}

      {pagina < ultima && (
        <Link href={caminhoDaPagina(pagina + 1)} rel="next" style={{ ...estiloBase, fontWeight: 600 }}>
          Próxima →
        </Link>
      )}
    </nav>
  );
}
