import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // next/image negocia o formato pelo Accept do navegador: quem aceita AVIF
    // recebe AVIF, o resto cai em WebP automaticamente (sem imagem quebrada).
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;
