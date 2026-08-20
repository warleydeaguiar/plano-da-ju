import { Metadata } from 'next';
import QuizClient from '../QuizClient';

export const metadata: Metadata = {
  title: 'Diagnóstico Capilar Gratuito — para brasileiras nos EUA',
  description: 'Plano capilar personalizado para brasileiras que moram nos Estados Unidos: produtos fáceis de achar aí e solução pra água dura.',
};

export const revalidate = 30;

// Funil EUA — mesmo motor do quiz brasileiro (mesmas perguntas de diagnóstico),
// com copy adaptada e slug próprio (plano-capilar-usa) pra separar as métricas.
// Termina na oferta em dólar, não na roleta brasileira.
export default function QuizEuaPage() {
  return <QuizClient market="usa" />;
}
