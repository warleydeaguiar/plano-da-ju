import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
// Cache curto — experimentos não mudam constantemente
export const revalidate = 30;

const VALID_SLUGS = new Set(['fashion-gold', 'plano-capilar']);

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface ActiveExperiment {
  id:              string;
  flag_key:        string;
  target_step_id:  string;
  traffic_pct:     number;
  control_name:    string;
  variant_name:    string;
  variant_content: Record<string, unknown>;
}

/**
 * GET /api/quiz/experiments?slug=plano-capilar
 *
 * Retorna experimentos com status='running' para o quiz_slug informado.
 * O client usa isso pra computar o variant via hash determinístico do
 * session_id (sticky — mesma pessoa sempre vê a mesma variante).
 */
export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get('slug') ?? 'plano-capilar';
    if (!VALID_SLUGS.has(slug)) {
      return NextResponse.json({ experiments: [] });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (client().from('wg_experiments' as any) as any)
      .select('id, flag_key, target_step_id, traffic_pct, control_name, variant_name, variant_content')
      .eq('target_quiz_slug', slug)
      .eq('status', 'running');

    return NextResponse.json({ experiments: data ?? [] });
  } catch {
    // Fail open — quiz sempre funciona, mesmo se experimentos não carregarem
    return NextResponse.json({ experiments: [] });
  }
}
