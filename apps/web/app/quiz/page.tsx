import { Metadata } from 'next';
import QuizClient from './QuizClient';

export const metadata: Metadata = {
  title: 'Diagnóstico Capilar Gratuito — Plano da Ju',
  description: 'Responda 15 perguntas e descubra o plano perfeito para o seu cabelo.',
};

export default function QuizPage() {
  return <QuizClient />;
}
