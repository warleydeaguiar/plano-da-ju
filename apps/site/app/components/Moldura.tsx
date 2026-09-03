'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NOME_SITE } from '@/lib/seo';

const MENU = [
  { rotulo: 'Início', href: '/' },
  { rotulo: 'Blog', href: '/blog/' },
  { rotulo: 'Produtos', href: '/loja/' },
];

/**
 * Páginas que se apresentam sozinhas, sem a moldura do site.
 *
 * A /links/ é o link da bio do Instagram: quem chega ali veio de um story ou
 * do perfil, já sabe de quem é a página e quer tocar num botão. Menu de
 * navegação e rodapé de blog só empurram os botões para baixo da dobra.
 */
const SEM_MOLDURA = ['/links/'];

export interface LinkRodape { href: string; rotulo: string }

export default function Moldura({ children, atalhos = [], redes = [] }: {
  children: React.ReactNode;
  /** Os mesmos links do link da bio — vêm do conteúdo, editáveis no admin. */
  atalhos?: LinkRodape[];
  redes?: LinkRodape[];
}) {
  const caminho = usePathname();
  if (SEM_MOLDURA.includes(caminho)) return <>{children}</>;

  return (
    <>
      <header
        style={{
          borderBottom: '1px solid var(--borda)',
          background: 'var(--creme)',
          position: 'sticky',
          top: 0,
          zIndex: 20,
        }}
      >
        <nav
          style={{
            maxWidth: '68rem',
            margin: '0 auto',
            padding: '0.85rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <Link href="/" style={{ fontWeight: 700, fontSize: '1.05rem', letterSpacing: '-0.01em' }}>
            {NOME_SITE}
          </Link>
          <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.95rem' }}>
            {MENU.map((m) => (
              <Link key={m.href} href={m.href} style={{ color: 'var(--tinta-suave)' }}>
                {m.rotulo}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      <main>{children}</main>

      <footer
        style={{
          borderTop: '1px solid var(--borda)',
          marginTop: '4rem',
          padding: '2.5rem 1.25rem 2rem',
          background: 'var(--creme)',
          color: 'var(--tinta-suave)',
          fontSize: '0.875rem',
        }}
      >
        <div style={{ maxWidth: '68rem', margin: '0 auto' }}>
          <div style={{
            display: 'grid', gap: '2rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(13rem, 1fr))',
            marginBottom: '2rem',
          }}>
            <div>
              <p style={{ fontWeight: 700, color: 'var(--tinta)', marginBottom: '0.7rem' }}>Navegar</p>
              {MENU.map((m) => (
                <Link key={m.href} href={m.href} style={{ display: 'block', color: 'var(--tinta-suave)', padding: '0.25rem 0' }}>
                  {m.rotulo}
                </Link>
              ))}
            </div>

            {/* Os mesmos atalhos do link da bio do Instagram. Vêm do conteúdo,
                então a Juliane muda no admin e o rodapé acompanha. */}
            {atalhos.length > 0 && (
              <div>
                <p style={{ fontWeight: 700, color: 'var(--tinta)', marginBottom: '0.7rem' }}>Comigo</p>
                {atalhos.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    style={{ display: 'block', color: 'var(--tinta-suave)', padding: '0.25rem 0' }}
                  >
                    {l.rotulo}
                  </a>
                ))}
              </div>
            )}

            {redes.length > 0 && (
              <div>
                <p style={{ fontWeight: 700, color: 'var(--tinta)', marginBottom: '0.7rem' }}>Redes</p>
                {redes.map((r) => (
                  <a
                    key={r.href}
                    href={r.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'block', color: 'var(--tinta-suave)', padding: '0.25rem 0' }}
                  >
                    {r.rotulo}
                  </a>
                ))}
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--borda)', paddingTop: '1.25rem' }}>
            <p style={{ marginBottom: '0.5rem' }}>© {new Date().getFullYear()} {NOME_SITE}</p>
            <p>
              Alguns links desta página são de parceiros. Se você comprar por eles, posso receber
              uma comissão — sem custo nenhum para você.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
