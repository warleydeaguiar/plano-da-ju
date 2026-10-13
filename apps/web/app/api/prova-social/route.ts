import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const revalidate = 300;

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * GET /api/prova-social
 *
 * Quantas mulheres chegaram à análise do quiz (tela "Analisando seu perfil")
 * nas últimas 24h. É o número que aparece nessa mesma tela: muda sozinho ao
 * longo do dia e é REAL — um contador inventado de "compraram agora" seria
 * propaganda enganosa (CDC art. 37). Cache de 5 min: a tela não precisa do
 * número ao segundo e o banco roda numa VPS pequena.
 */
export async function GET() {
  try {
    const sb = await createServiceClient();
    const { count } = await (sb.from('wg_quiz_step_events') as any)
      .select('id', { count: 'exact', head: true })
      .eq('quiz_slug', 'plano-capilar')
      .eq('event_type', 'viewed')
      .eq('step_id', 'loading')
      .gte('created_at', new Date(Date.now() - 24 * 3600_000).toISOString());
    return NextResponse.json({ diagnosticos_24h: count ?? 0 });
  } catch {
    return NextResponse.json({ diagnosticos_24h: 0 });
  }
}
