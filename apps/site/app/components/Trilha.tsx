import Link from 'next/link';

/**
 * Trilha de navegação visível. O schema BreadcrumbList já existe no JSON-LD;
 * mostrar na tela ajuda a leitora que chegou pelo Google direto num artigo
 * profundo a entender onde está e continuar navegando.
 */
export default function Trilha({ itens }: { itens: { nome: string; href?: string }[] }) {
  return (
    <nav aria-label="Você está aqui" style={{ fontSize: '0.85rem', color: 'var(--tinta-suave)' }}>
      <ol style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.45rem', listStyle: 'none', alignItems: 'center' }}>
        {itens.map((i, n) => (
          // O último item é o título do artigo, que no celular quebra em duas
          // linhas e deixa o "›" órfão — sem contar que a leitora já está
          // olhando o mesmo título logo abaixo, em corpo 32. Fica só no
          // desktop; o schema BreadcrumbList continua completo nos dois.
          <li key={i.nome} className={i.href ? undefined : 'trilha-atual'} style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
            {n > 0 && <span aria-hidden style={{ opacity: 0.5 }}>›</span>}
            {i.href ? (
              <Link href={i.href} style={{ color: 'var(--tinta-suave)', padding: '0.35rem 0' }}>{i.nome}</Link>
            ) : (
              <span style={{ color: 'var(--tinta)' }}>{i.nome}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
