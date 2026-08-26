import type { ItemIndice } from '@/lib/artigo';

/**
 * Índice do artigo.
 *
 * Num site cujo conteúdo é "Top 10 melhores X", o índice faz duas coisas: dá à
 * leitora um atalho para o produto que ela veio ver, e dá ao Google âncoras
 * que ele pode exibir como sublinks do resultado. Sai renderizado no HTML —
 * nada montado por script depois.
 */
export default function Indice({ itens }: { itens: ItemIndice[] }) {
  if (itens.length < 3) return null; // com 2 seções o índice atrapalha mais do que ajuda

  return (
    <nav
      aria-label="Índice do artigo"
      style={{
        border: '1px solid var(--borda)',
        background: '#fff',
        borderRadius: 14,
        padding: '1.25rem 1.4rem',
        margin: '2rem 0',
      }}
    >
      <p style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.8rem' }}>Neste artigo</p>
      <ol style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', listStyle: 'none' }}>
        {itens.map((i, n) => (
          <li key={i.id} style={{ display: 'flex', gap: '0.6rem', lineHeight: 1.45 }}>
            <span style={{ color: 'var(--rosa)', fontWeight: 700, minWidth: '1.4rem' }}>{n + 1}.</span>
            <a href={`#${i.id}`} style={{ color: 'var(--tinta)', textDecoration: 'none' }}>
              {i.texto}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
