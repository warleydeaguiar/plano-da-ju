import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/link-bio-pro/session
 * Body: { session_id, respostas?, profissao?, nome?, email?, telefone? }
 *
 * Cria (se não existir) ou atualiza a linha de `bio_pro_orders` daquela
 * sessão de quiz. Chamado a cada resposta (fire-and-forget do client), igual
 * ao padrão de `/api/quiz/answers` do Plano Capilar — mas já grava direto na
 * tabela definitiva, sem uma tabela de respostas separada.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sessionId = typeof body?.session_id === 'string' ? body.session_id.trim() : '';
    if (!sessionId) {
      return NextResponse.json({ error: 'session_id obrigatório' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase.from('bio_pro_orders') as any)
      .select('id, respostas, imagens')
      .eq('session_id', sessionId)
      .maybeSingle();

    const respostasNovas =
      body?.respostas && typeof body.respostas === 'object' ? body.respostas : {};
    const respostasFinal = { ...(existing?.respostas ?? {}), ...respostasNovas };

    const patch: Record<string, unknown> = {
      session_id: sessionId,
      respostas: respostasFinal,
      atualizado_em: new Date().toISOString(),
    };

    // Confirmação de upload (chamado depois de subir pro Storage via signed URL).
    if (body?.imagem && typeof body.imagem === 'object' && typeof body.imagem.url === 'string') {
      const imagensAtuais: Array<Record<string, unknown>> = Array.isArray(existing?.imagens) ? existing.imagens : [];
      patch.imagens = [
        ...imagensAtuais,
        { slot: body.imagem.slot ?? 'foto', url: body.imagem.url, uploaded_at: new Date().toISOString() },
      ];
    }
    if (typeof body?.profissao === 'string' && body.profissao) patch.profissao = body.profissao;
    if (typeof body?.nome === 'string' && body.nome) patch.nome = body.nome;
    if (typeof body?.email === 'string' && body.email) patch.email = body.email;
    if (typeof body?.telefone === 'string' && body.telefone) patch.telefone = body.telefone;

    if (existing?.id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('bio_pro_orders') as any).update(patch).eq('id', existing.id);
      return NextResponse.json({ ok: true, id: existing.id });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: created, error } = await (supabase.from('bio_pro_orders') as any)
      .insert(patch)
      .select('id')
      .single();
    if (error) throw error;

    return NextResponse.json({ ok: true, id: created.id });
  } catch (err) {
    console.error('[link-bio-pro/session]', err);
    return NextResponse.json({ error: 'Erro ao salvar sessão' }, { status: 500 });
  }
}
