import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Admin — Plano da Ju',
  description: 'Painel administrativo Plano da Ju',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}
