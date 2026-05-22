import { redirect } from 'next/navigation';

// Analytics foi unificada dentro do Dashboard (/). Redireciona para lá.
export default function AnalyticsPage() {
  redirect('/');
}
