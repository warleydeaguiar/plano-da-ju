import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { sessionIdValido } from '@/lib/bio-pro';

export const runtime = 'nodejs';

/**
 * POST /api/link-bio-pro/photo-url
 * Body: { session_id, slot? }
 *
 * URL assinada pra subir a foto DIRETO pro Storage (mesmo motivo do padrão em
 * /api/meu-plano/photo-url: evita o limite de corpo da serverless). Sem
 * Supabase Auth — quiz é anônimo/pré-compra — então a autorização é a sessão
 * já existir e não estar paga. Sempre `.jpg`: o que não for JPEG é convertido
 * pelo /session na confirmação.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`bio-pro-foto:${ip}`, { max: 15, windowMs: 10 * 60_000 }).allowed) {
    return NextResponse.json({ error: 'Muitas fotos em pouco tempo. Aguarde alguns minutos.' }, { status: 429 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const sessionId = body?.session_id;
    const slot = (typeof body?.slot === 'string' ? body.slot : 'foto').replace(/[^a-z0-9_-]/gi, '').slice(0, 30) || 'foto';
    if (!sessionIdValido(sessionId)) {
      return NextResponse.json({ error: 'session_id inválido' }, { status: 400 });
    }

    const sb = await createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pedido } = await (sb.from('bio_pro_orders') as any)
      .select('id, status_pagamento')
      .eq('session_id', sessionId)
      .maybeSingle();
    if (!pedido) {
      return NextResponse.json({ error: 'Sessão não encontrada — recarregue a página.' }, { status: 404 });
    }
    if (pedido.status_pagamento === 'pago') {
      return NextResponse.json({ error: 'Esse pedido já foi pago.', pago: true }, { status: 409 });
    }

    const path = `${sessionId}/${Date.now()}-${slot}.jpg`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.storage.from('bio-pro-uploads') as any).createSignedUploadUrl(path);
    if (error || !data?.token) {
      return NextResponse.json({ error: 'Não foi possível preparar o upload' }, { status: 500 });
    }
    return NextResponse.json({ path, token: data.token });
  } catch (err) {
    console.error('[link-bio-pro/photo-url]', err);
    return NextResponse.json({ error: 'Erro ao preparar upload' }, { status: 500 });
  }
}
