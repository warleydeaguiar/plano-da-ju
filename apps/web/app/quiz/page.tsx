import { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import QuizClient from './QuizClient';

export const metadata: Metadata = {
  title: 'Diagnóstico Capilar Gratuito — Plano da Ju',
  description: 'Responda 15 perguntas e descubra o plano perfeito para o seu cabelo.',
};

// Cache curto — experimentos não mudam toda hora, mas queremos updates rápidos
export const revalidate = 30;

export interface ActiveExperiment {
  id:              string;
  flag_key:        string;
  target_step_id:  string;
  traffic_pct:     number;
  control_name:    string;
  variant_name:    string;
  variant_content: Record<string, unknown>;
}

async function fetchExperiments(): Promise<ActiveExperiment[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  try {
    const sb = createClient(url, key, { auth: { persistSession: false } });
    // Timeout 3s — se Supabase travar, quiz não fica esperando.
    // Sem experimentos é melhor que quiz não carregar.
    const fetchPromise = (sb.from('wg_experiments' as never) as never as
      { select: (s: string) => { eq: (k: string, v: string) => { eq: (k: string, v: string) => Promise<{ data: ActiveExperiment[] | null }> } } })
      .select('id, flag_key, target_step_id, traffic_pct, control_name, variant_name, variant_content')
      .eq('target_quiz_slug', 'plano-capilar')
      .eq('status', 'running');
    const timeoutPromise = new Promise<{ data: null }>(resolve =>
      setTimeout(() => resolve({ data: null }), 3000),
    );
    const { data } = await Promise.race([fetchPromise, timeoutPromise]);
    return (data ?? []) as ActiveExperiment[];
  } catch {
    // Fail open — quiz funciona normalmente se experimentos falharem
    return [];
  }
}

export default async function QuizPage() {
  const experiments = await fetchExperiments();
  return <QuizClient experiments={experiments} />;
}
