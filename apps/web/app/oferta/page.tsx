import { Metadata } from 'next';
import OfertaClient from './OfertaClient';

export const metadata: Metadata = {
  title: 'Sua Consulta com a Juliane — Plano da Ju',
  description: 'Sua Consulta com a Tricologista Juliane Cost e o seu plano capilar de 90 dias.',
};

// 13/10/26: o teste A/B checkout próprio × Hotmart foi encerrado — a oferta usa
// só o checkout próprio (Pagar.me). O webhook da Hotmart continua no ar para
// receber reembolsos/cancelamentos de quem comprou por lá durante o teste.
export default function OfertaPage() {
  return <OfertaClient />;
}
