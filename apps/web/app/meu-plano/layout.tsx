import type { Metadata } from 'next';
import Shell from './Shell';

export const metadata: Metadata = {
  title: 'Meu Plano — Plano da Ju',
};

export default function MeuPlanoLayout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
