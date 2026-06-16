import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { pagarme } from '@/lib/pagarme/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/pix/status/[token]
 *
 * token = id do profile. Usado pela página /pix/[token] (aberta pelo botão do
 * template de recuperação no WhatsApp) pra mostrar/atualizar o código PIX e
 * detectar o pagamento. Só expõe dados de pagamento — nada sensível.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!token || !/^[0-9a-f-]{10,}$/i.test(token)) {
    return NextResponse.json({ error: 'token inválido' }, { status: 400 });
  }

  const sb = await createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (sb.from('profiles') as any)
    .select('full_name, pagarme_pix_order_id, subscription_status')
    .eq('id', token)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: 'não encontrado' }, { status: 404 });

  // Já ativo → pagamento confirmado
  if (profile.subscription_status === 'active') {
    return NextResponse.json({ status: 'paid', name: firstName(profile.full_name) });
  }
  if (!profile.pagarme_pix_order_id) {
    return NextResponse.json({ status: 'no_order', name: firstName(profile.full_name) });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const order: any = await pagarme.get(`/orders/${profile.pagarme_pix_order_id}`);
    const tx = order?.charges?.[0]?.last_transaction;
    const status: string = order?.status ?? 'unknown';

    if (status === 'paid') return NextResponse.json({ status: 'paid', name: firstName(profile.full_name) });
    if (status !== 'pending' && status !== 'waiting_payment') {
      return NextResponse.json({ status: 'expired', name: firstName(profile.full_name) });
    }

    return NextResponse.json({
      status: 'pending',
      name: firstName(profile.full_name),
      qr_code: tx?.qr_code ?? null,
      qr_code_url: tx?.qr_code_url ?? null,
      expires_at: tx?.expires_at ?? null,
    });
  } catch {
    return NextResponse.json({ status: 'error', name: firstName(profile.full_name) }, { status: 502 });
  }
}

function firstName(full?: string | null): string {
  const n = (full ?? '').trim().split(/\s+/)[0] ?? '';
  if (!n) return '';
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
}
