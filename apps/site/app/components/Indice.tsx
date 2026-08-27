import type { ItemIndice } from '@/lib/artigo';

/**
 * Índice do artigo.
 *
 * Num site cujo conteúdo é "Top 10 melhores X", o índice faz duas coisas: dá à
 * leitora um atalho para o produto que ela veio ver, e dá ao Google âncoras
 * que ele pode exibir como sublinks do resultado.
 *
 * Vem RECOLHIDO. Aberto, um índice de 16 seções ocupava 757px — quase uma tela
 * inteira de celular — e empurrava a primeira palavra do texto para 1.417px de
 * rolagem. Como 87% do tráfego é celular, o padrão é o que serve o celular.
 * Fechado o conteúdo continua no HTML, então o Google lê os links do mesmo
 * jeito.
 */
export default function Indice({ itens }: { itens: ItemIndice[] }) {
  if (itens.length < 3) return null; // com 2 seções o índice atrapalha mais do que ajuda

  return (
    <details
      className="indice"
      style={{
        border: '1px solid var(--borda)',
        background: '#fff',
        borderRadius: 14,
        padding: '0.9rem 1.1rem',
        margin: '1.5rem 0',
      }}
    >
      <summary
        style={{
          fontWeight: 700, fontSize: '0.98rem', cursor: 'pointer', listStyle: 'none',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem',
          // 44px é o mínimo que o dedo acerta sem errar
          minHeight: 30, padding: '0.35rem 0',
        }}
      >
        <span>
          Neste artigo{' '}
          <span style={{ color: 'var(--tinta-suave)', fontWeight: 500 }}>
            · {itens.length} seções
          </span>
        </span>
        <span aria-hidden style={{ color: 'var(--rosa)', flexShrink: 0, fontSize: '1.1rem' }}>+</span>
      </summary>

      <nav aria-label="Índice do artigo">
        <ol style={{ display: 'flex', flexDirection: 'column', listStyle: 'none', marginTop: '0.5rem' }}>
          {itens.map((i, n) => (
            <li key={i.id}>
              <a
                href={`#${i.id}`}
                style={{
                  display: 'flex', gap: '0.6rem', lineHeight: 1.4,
                  color: 'var(--tinta)', textDecoration: 'none',
                  // alvo de toque confortável, sem inchar o bloco
                  padding: '0.6rem 0', minHeight: 44, alignItems: 'center',
                }}
              >
                <span style={{ color: 'var(--rosa)', fontWeight: 700, minWidth: '1.5rem', flexShrink: 0 }}>
                  {n + 1}.
                </span>
                {i.texto}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </details>
  );
}
