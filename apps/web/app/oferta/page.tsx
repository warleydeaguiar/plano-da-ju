import { Metadata } from 'next';
import OfertaClient from './OfertaClient';

export const metadata: Metadata = {
  title: 'Seu Plano Está Pronto — Plano da Ju',
  description: 'Acesse agora o seu plano capilar personalizado.',
};

export default function OfertaPage() {
  return <OfertaClient />;
}
