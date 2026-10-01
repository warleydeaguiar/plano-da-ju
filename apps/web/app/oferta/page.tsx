import { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import OfertaClient from './OfertaClient';
import type { ExperimentoAtivo } from '@/lib/ab';

export const metadata: Metadata = {
  title: 'Seu Plano Está Pronto — Plano da Ju',
  description: 'Acesse agora o seu plano capilar personalizado.',
};

export const dynamic = 'force-dynamic';

/**
 * Experimentos rodando nesta oferta — mesmo padrão do /quiz/fashion-gold:
 * lidos no servidor, timeout curto, fail-open (lista vazia nunca trava a
 * página de pagamento).
 */
async function experimentos(): Promise<ExperimentoAtivo[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  try {
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const consulta = (sb.from('wg_experiments') as never as {
      select: (s: string) => { eq: (k: string, v: string) => { eq: (k: string, v: string) => Promise<{ data: ExperimentoAtivo[] | null }> } }
    })
      .select('id, flag_key, target_step_id, traffic_pct, variant_content')
      .eq('target_quiz_slug', 'plano-capilar')
      .eq('status', 'running');
    const limite = new Promise<{ data: null }>(r => setTimeout(() => r({ data: null }), 3000));
    const { data } = await Promise.race([consulta, limite]);
    return (data ?? []) as ExperimentoAtivo[];
  } catch {
    return [];
  }
}

export default async function OfertaPage() {
  const exps = await experimentos();
  return <OfertaClient experimentos={exps} />;
}
