import { Metadata } from 'next';
import PixClient from './PixClient';

export const metadata: Metadata = {
  title: 'Concluir pagamento PIX — Plano da Ju',
  robots: { index: false, follow: false },
};

export default async function PixPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PixClient token={token} />;
}
