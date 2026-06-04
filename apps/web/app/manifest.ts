import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Plano da Ju',
    short_name: 'Plano da Ju',
    description: 'Seu plano capilar personalizado da Juliane Cost.',
    start_url: '/meu-plano',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FFFAF5',
    theme_color: '#BE185D',
    lang: 'pt-BR',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
