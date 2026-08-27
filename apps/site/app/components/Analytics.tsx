'use client';

import Script from 'next/script';
import { useEffect } from 'react';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dataLayer?: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gtag?: (...args: any[]) => void;
  }
}

/**
 * Google Analytics 4 e o rastreio de clique no WhatsApp.
 *
 * `afterInteractive`: o script sobe depois que a página fica utilizável. Num
 * site cujo tráfego é 87% celular e cuja métrica mais frágil é o LCP, medir
 * não pode custar velocidade — e velocidade aqui é ranking.
 *
 * Vazio desabilita: sem `NEXT_PUBLIC_GA_ID` nada é carregado. É a mesma
 * convenção dos outros apps do projeto e evita poluir a propriedade com
 * tráfego de build e de ambiente de teste.
 */
export default function Analytics() {
  /**
   * O clique é capturado por delegação no documento, e não por handler em
   * cada link, porque a maior parte deles vem do HTML importado do WordPress
   * via dangerouslySetInnerHTML — esses nunca passariam por um onClick do
   * React. Assim o botão do produto e os links dentro do texto contam igual.
   */
  useEffect(() => {
    if (!GA_ID) return;

    function aoClicar(evento: MouseEvent) {
      const alvo = (evento.target as HTMLElement | null)?.closest?.('a');
      if (!alvo) return;
      const href = alvo.getAttribute('href') || '';
      if (!/wa\.me\/|api\.whatsapp\.com/.test(href)) return;

      // A mensagem já carrega o produto; reaproveitar evita ter que marcar
      // cada link com um atributo próprio.
      let produto = '';
      try {
        const texto = new URL(href, location.href).searchParams.get('text') || '';
        produto = texto.match(/produto (.+?)\. Você/)?.[1]
          ?? texto.match(/artigo "(.+?)"/)?.[1]
          ?? '';
      } catch { /* href estranho não impede o evento */ }

      window.gtag?.('event', 'generate_lead', {
        // nome do evento recomendado pelo GA4 — aparece nos relatórios sem
        // configuração extra e pode ser marcado como conversão
        currency: 'BRL',
        value: 0,
        metodo: 'whatsapp',
        produto: produto.slice(0, 100),
        pagina: location.pathname,
        rotulo: (alvo.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
      });
    }

    document.addEventListener('click', aoClicar, { capture: true });
    return () => document.removeEventListener('click', aoClicar, { capture: true });
  }, []);

  if (!GA_ID) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga4" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
window.gtag=gtag;gtag('js',new Date());gtag('config','${GA_ID}');`}
      </Script>
    </>
  );
}
