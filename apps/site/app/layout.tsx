import type { Metadata } from 'next';
import './globals.css';
import JsonLd from './components/JsonLd';
import Analytics from './components/Analytics';
import Moldura, { type LinkRodape } from './components/Moldura';
import { REDES } from './components/BoxAutora';
import { porPath } from '@/lib/conteudo';
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

const NOMEADAS: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…',
  ndash: '–', mdash: '—', rsquo: '’',
};

/**
 * Atalhos do rodapé, lidos da mesma página que alimenta o link da bio.
 *
 * Uma lista só, num lugar só: a Juliane edita /links/ no admin e o rodapé do
 * site inteiro acompanha, sem deploy e sem duas listas para manter iguais.
 */
async function atalhosDoRodape(): Promise<LinkRodape[]> {
  const pagina = await porPath('/links/');
  const html = pagina?.content_clean ?? '';
  const vistos = new Set<string>();
  const saida: LinkRodape[] = [];
  for (const m of html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const href = m[1].trim();
    // As redes têm coluna própria no rodapé; aqui ficam só os atalhos.
    if (!href || vistos.has(href) || /instagram|tiktok|youtube|facebook/i.test(href)) continue;
    const rotulo = m[2]
      .replace(/<[^>]+>/g, '')
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
      .replace(/&([a-z]+);/gi, (inteiro, nome) => NOMEADAS[String(nome).toLowerCase()] ?? inteiro)
      .replace(/[\p{Extended_Pictographic}️‍]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!rotulo) continue;
    vistos.add(href);
    saida.push({ href, rotulo });
  }
  return saida;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const atalhos = await atalhosDoRodape();
  return (
    <html lang="pt-BR">
      <body>
        <JsonLd dados={schemaDoSite()} />
        <Analytics />

        <Moldura
          atalhos={atalhos}
          redes={REDES.map((r) => ({ href: r.url, rotulo: r.nome }))}
        >
          {children}
        </Moldura>
      </body>
    </html>
  );
}
