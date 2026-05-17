import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Promoções — Plano da Ju',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
