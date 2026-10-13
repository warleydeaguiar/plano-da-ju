import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // next/image negocia o formato pelo Accept do navegador: quem aceita AVIF
    // recebe AVIF, o resto cai em WebP automaticamente (sem imagem quebrada).
    formats: ['image/avif', 'image/webp'],
  },
  async redirects() {
    return [
      // 13/10/26: o funil antigo (/quiz/v1 → /oferta/v1) foi juntado ao atual —
      // tinha preço, nome do produto e garantia desatualizados e ainda cobrava.
      // A query (utm_*) é repassada pelo próprio Next.
      { source: '/quiz/v1', destination: '/quiz', permanent: false },
      { source: '/oferta/v1', destination: '/oferta', permanent: false },
      // grupos.julianecost.com é linkado de dentro dos posts do blog (WordPress)
      // e estava dando 404. Manda tudo pro quiz do Fashion Gold.
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'grupos.julianecost.com' }],
        destination: 'https://planodaju.julianecost.com/quiz/fashion-gold',
        permanent: true,
      },
      // plano.julianecost.com é um subdomínio de funil antigo. O Google ainda
      // o rastreia e recebia 404 — manda pra home do funil, que é o destino
      // que a pessoa procurava.
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'plano.julianecost.com' }],
        destination: 'https://planodaju.julianecost.com/',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
