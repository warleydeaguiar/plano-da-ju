import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

// Pixel Meta (Decisoes Inteligentes) — cobre TODO o funil:
// Quiz Plano Capilar, Fashion Gold, /oferta, /obrigado.
// Eventos custom (Lead, InitiateCheckout, Purchase) são disparados via window.fbq nos clients.
const META_PIXEL_ID = '921783859786853';

export const metadata: Metadata = {
  title: 'Plano da Ju — Diagnóstico Capilar Gratuito',
  description: 'Descubra o plano ideal para recuperar seu cabelo em 90 dias. Diagnóstico personalizado pela especialista Juliane Cost.',
  openGraph: {
    title: 'Plano da Ju — Diagnóstico Capilar Gratuito',
    description: 'Mais de 3.500 mulheres transformadas. Descubra o plano ideal para o seu cabelo.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <head>
        <Script
          id="meta-pixel"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${META_PIXEL_ID}');
              fbq('track', 'PageView');
            `,
          }}
        />
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            height="1" width="1" style={{ display: 'none' }}
            src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
            alt=""
          />
        </noscript>
      </head>
      <body className="min-h-full bg-[#1C0020] text-white antialiased">{children}</body>
    </html>
  );
}
