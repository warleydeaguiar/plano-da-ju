'use client';

import Script from 'next/script';
import { useEffect } from 'react';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const META_PIXEL = process.env.NEXT_PUBLIC_META_PIXEL_ID;

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dataLayer?: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gtag?: (...args: any[]) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fbq?: (...args: any[]) => void;
  }
}

/**
 * Medição do site: Google Analytics 4 e pixel da Meta.
 *
 * Os dois sobem com `afterInteractive`, depois que a página fica utilizável.
 * Num site com 87% de tráfego em celular e cujo ponto mais frágil é o LCP,
 * medir não pode custar velocidade — velocidade aqui é ranking.
 *
 * Cada um é desligado sozinho deixando a env vazia. É a convenção dos outros
 * apps do projeto e evita poluir as contas com tráfego de teste.
 *
 * O pixel é o MESMO do funil do Plano da Ju (e o mesmo que o WordPress usava),
 * de propósito: quem lê um comparativo aqui pode ser reimpactada com a oferta
 * do plano lá. Pixel separado por site quebraria justamente esse público.
 */
export default function Analytics() {
  /**
   * O clique é capturado por delegação no documento, e não por handler em cada
   * link, porque a maior parte deles vem do HTML importado do WordPress via
   * dangerouslySetInnerHTML — esses nunca passariam por um onClick do React.
   * Assim o botão do produto e os links dentro do texto contam igual.
   */
  useEffect(() => {
    if (!GA_ID && !META_PIXEL) return;

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

      const rotulo = (alvo.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);

      // `generate_lead` é o nome recomendado pelo GA4: aparece nos relatórios
      // sem configuração extra e pode ser marcado como conversão.
      window.gtag?.('event', 'generate_lead', {
        currency: 'BRL',
        value: 0,
        metodo: 'whatsapp',
        produto: produto.slice(0, 100),
        pagina: location.pathname,
        rotulo,
      });

      // `Lead` é o evento padrão da Meta — dá para otimizar campanha por ele
      // e montar público de quem demonstrou intenção de compra.
      window.fbq?.('track', 'Lead', {
        content_name: produto.slice(0, 100) || rotulo,
        content_category: 'whatsapp',
        source_url: location.pathname,
      });
    }

    document.addEventListener('click', aoClicar, { capture: true });
    return () => document.removeEventListener('click', aoClicar, { capture: true });
  }, []);

  if (!GA_ID && !META_PIXEL) return null;

  return (
    <>
      {GA_ID && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
window.gtag=gtag;gtag('js',new Date());gtag('config','${GA_ID}');`}
          </Script>
        </>
      )}

      {META_PIXEL && (
        <>
          <Script id="meta-pixel" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,
'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${META_PIXEL}');fbq('track','PageView');`}
          </Script>
          {/* Conta a visita de quem navega sem JavaScript. */}
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height="1"
              width="1"
              style={{ display: 'none' }}
              alt=""
              src={`https://www.facebook.com/tr?id=${META_PIXEL}&ev=PageView&noscript=1`}
            />
          </noscript>
        </>
      )}
    </>
  );
}
