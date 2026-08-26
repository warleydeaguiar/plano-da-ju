import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import JsonLd from './components/JsonLd';
import { SITE, NOME_SITE, BLOQUEAR_INDEXACAO, schemaDoSite } from '@/lib/seo';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: 'Juliane Cost — cuidados com o cabelo, avaliações e comparativos',
    template: '%s',
  },
  description:
    'Comparativos e avaliações de produtos para cabelo: progressivas, shampoos, ' +
    'tratamentos e cronograma capilar, testados e explicados pela Juliane Cost.',
  robots: BLOQUEAR_INDEXACAO ? { index: false, follow: false } : { index: true, follow: true },
};

const MENU = [
  { rotulo: 'Início', href: '/' },
  { rotulo: 'Blog', href: '/blog/' },
  { rotulo: 'Produtos', href: '/loja/' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <JsonLd dados={schemaDoSite()} />

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
            <Link
              href="/"
              style={{ fontWeight: 700, fontSize: '1.05rem', letterSpacing: '-0.01em' }}
            >
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
            padding: '2rem 1.25rem',
            color: 'var(--tinta-suave)',
            fontSize: '0.875rem',
          }}
        >
          <div style={{ maxWidth: '68rem', margin: '0 auto' }}>
            <p style={{ marginBottom: '0.5rem' }}>
              © {new Date().getFullYear()} {NOME_SITE}
            </p>
            <p>
              Alguns links desta página são de parceiros. Se você comprar por eles, posso
              receber uma comissão — sem custo nenhum para você.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
