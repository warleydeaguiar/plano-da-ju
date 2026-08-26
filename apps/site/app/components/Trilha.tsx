import Link from 'next/link';

/**
 * Trilha de navegação visível. O schema BreadcrumbList já existe no JSON-LD;
 * mostrar na tela ajuda a leitora que chegou pelo Google direto num artigo
 * profundo a entender onde está e continuar navegando.
 */
export default function Trilha({ itens }: { itens: { nome: string; href?: string }[] }) {
  return (
    <nav aria-label="Você está aqui" style={{ fontSize: '0.85rem', color: 'var(--tinta-suave)' }}>
      <ol style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', listStyle: 'none' }}>
        {itens.map((i, n) => (
          <li key={i.nome} style={{ display: 'flex', gap: '0.4rem' }}>
            {n > 0 && <span aria-hidden>›</span>}
            {i.href ? (
              <Link href={i.href} style={{ color: 'var(--tinta-suave)' }}>{i.nome}</Link>
            ) : (
              <span style={{ color: 'var(--tinta)' }}>{i.nome}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
