import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Check-in — Plano da Ju',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
