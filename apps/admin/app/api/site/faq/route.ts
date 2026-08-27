import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Aprovação e reprovação manual do FAQ.
 *
 * A revisão automática já passou por tudo; isto é para a Juliane discordar do
 * resultado — soltar uma pergunta que o robô barrou, ou tirar do ar uma que
 * ele aprovou e ela não assina.
 */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const ids: number[] = Array.isArray(body?.ids) ? body.ids : [];
  const acao = body?.acao;
  if (!ids.length || !['aprovar', 'reprovar'].includes(acao)) {
    return NextResponse.json({ error: 'Informe ids e ação.' }, { status: 400 });
  }

  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('site_faq')
    .update({
      revisado: acao === 'aprovar',
      revisao_status: acao === 'aprovar' ? 'aprovada' : 'reprovada',
      revisao_motivo: acao === 'reprovar' ? 'reprovada manualmente pela Juliane' : null,
      revisado_em: new Date().toISOString(),
    })
    .in('id', ids);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, alteradas: ids.length });
}
