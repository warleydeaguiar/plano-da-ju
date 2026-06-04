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
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
