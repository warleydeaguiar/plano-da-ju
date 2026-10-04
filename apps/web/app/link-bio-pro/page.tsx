import { Metadata } from 'next';
import QuizLinkBioClient from './quiz/QuizLinkBioClient';

export const metadata: Metadata = {
  title: 'Link na Bio PRO — Juliane Cost',
  description: 'A Juliane cria o seu link na bio personalizado. Responda 2 minutos e receba a sua.',
  robots: { index: false, follow: true },
};

export const dynamic = 'force-dynamic';

export default function LinkBioProPage() {
  return <QuizLinkBioClient />;
}
