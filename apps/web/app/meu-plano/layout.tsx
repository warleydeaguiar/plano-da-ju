import type { Metadata } from 'next';
import Shell from './Shell';

export const metadata: Metadata = {
  title: 'Meu Plano — Plano da Ju',
};

const FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';

export default function MeuPlanoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href={FONTS_URL} />
      <Shell>{children}</Shell>
    </>
  );
}
