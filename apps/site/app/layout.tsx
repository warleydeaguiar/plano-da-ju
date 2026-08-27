import type { Metadata } from 'next';
import './globals.css';
import JsonLd from './components/JsonLd';
import Analytics from './components/Analytics';
import Moldura from './components/Moldura';
import { SITE, BLOQUEAR_INDEXACAO, schemaDoSite } from '@/lib/seo';

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <JsonLd dados={schemaDoSite()} />
        <Analytics />

        <Moldura>{children}</Moldura>
      </body>
    </html>
  );
}
