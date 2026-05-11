import { Metadata } from 'next';
import QuizClientV1 from './QuizClient';

export const metadata: Metadata = {
  title: 'Quiz V1 — Plano da Ju (backup)',
  robots: 'noindex',
};

export default function QuizV1Page() {
  return <QuizClientV1 />;
}
