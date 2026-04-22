import { Metadata } from 'next';
import OfertaClient from './OfertaClient';

export const metadata: Metadata = {
  title: 'Seu Plano Está Pronto — Plano da Ju',
  description: 'Acesse agora seu plano capilar personalizado por apenas R$34,90/ano.',
};

export default function OfertaPage() {
  return <OfertaClient />;
}
