import type { Metadata } from 'next';
import './globals.css';

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
      <body className="min-h-full bg-[#1C0020] text-white antialiased">{children}</body>
    </html>
  );
}
