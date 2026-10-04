import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * POST /api/link-bio-pro/photo-url
 * Body: { session_id, slot? }
 *
 * Gera uma URL assinada pra subir a foto DIRETO pro Storage (mesmo motivo do
 * padrão em /api/meu-plano/photo-url: evita o limite de corpo da serverless).
 * Diferença: aqui não há Supabase Auth (quiz é pré-compra/anônimo) — a
 * autorização é por posse do `session_id`, que precisa já existir em
 * `bio_pro_orders` (criado por /api/link-bio-pro/session antes do step de foto).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const sessionId = typeof body?.session_id === 'string' ? body.session_id.trim() : '';
    const slot = typeof body?.slot === 'string' && body.slot ? body.slot.replace(/[^a-z0-9_-]/gi, '') : 'foto';
    if (!sessionId) {
      return NextResponse.json({ error: 'session_id obrigatório' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: order } = await (supabase.from('bio_pro_orders') as any)
      .select('id')
      .eq('session_id', sessionId)
      .maybeSingle();
    if (!order) {
      return NextResponse.json({ error: 'Sessão não encontrada — responda o quiz antes de enviar a foto' }, { status: 404 });
    }

    const path = `${sessionId}/${Date.now()}-${slot}.jpg`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.storage.from('bio-pro-uploads') as any).createSignedUploadUrl(path);
    if (error || !data?.token) {
      return NextResponse.json({ error: 'Não foi possível preparar o upload' }, { status: 500 });
    }
    const publicUrl = supabase.storage.from('bio-pro-uploads').getPublicUrl(path).data.publicUrl;

    return NextResponse.json({ path, token: data.token, publicUrl });
  } catch (err) {
    console.error('[link-bio-pro/photo-url]', err);
    return NextResponse.json({ error: 'Erro ao preparar upload' }, { status: 500 });
  }
}
