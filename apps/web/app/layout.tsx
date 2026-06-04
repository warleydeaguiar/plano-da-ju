import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import TrackingBootstrap from './TrackingBootstrap';

// Pixel Meta (Decisoes Inteligentes) — cobre TODO o funil:
// Quiz Plano Capilar, Fashion Gold, /oferta, /obrigado.
// Eventos custom (Lead, InitiateCheckout, Purchase) são disparados via window.fbq nos clients.
const META_PIXEL_ID = '921783859786853';

// Google Analytics 4
const GA_ID = 'G-F2LEPP0NLT';

export const metadata: Metadata = {
  title: 'Plano da Ju — Diagnóstico Capilar Gratuito',
  description: 'Descubra o plano ideal para recuperar seu cabelo em 90 dias. Diagnóstico personalizado pela especialista Juliane Cost.',
  openGraph: {
    title: 'Plano da Ju — Diagnóstico Capilar Gratuito',
    description: 'Mais de 3.500 mulheres transformadas. Descubra o plano ideal para o seu cabelo.',
    type: 'website',
  },
  // PWA — permite instalar o app na tela inicial
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Plano da Ju', statusBarStyle: 'default' },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    // iOS usa o apple-touch-icon (ignora o manifest) — foto da Juliane
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#BE185D',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <head>
        {/* Google Analytics 4 */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script
          id="google-analytics"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}', { page_path: window.location.pathname });
            `,
          }}
        />

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
              // PageView é disparado pelo TrackingBootstrap (com eventID + CAPI)
              // pra deduplicar com o servidor — não chamamos fbq('track','PageView')
              // aqui pra não duplicar.
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
      <body className="min-h-full bg-[#FFFAF5] text-[#2A1E2C] antialiased">
        <TrackingBootstrap />
        {children}
      </body>
    </html>
  );
}
