import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/wa-autoreply?k=<secret>
 *
 * Webhook do Chatwoot (evento conversation_created). Quando alguém inicia uma
 * conversa no número OFICIAL (WhatsApp Cloud API), respondemos automaticamente
 * com o link de entrada no grupo — personalizado com o telefone/nome pra que o
 * /g/entrar consiga disparar o follow-up 1:1 depois.
 *
 * Envia direto pela Graph API (Cloud API) — não passa pelo Chatwoot pra evitar
 * o strip de header do Cloudflare. Tolerante a falha.
 */
const APP = 'https://planodaju.julianecost.com';

async function sendWhatsApp(phoneDigits: string, text: string): Promise<boolean> {
  const token = process.env.WHATSAPP_TOKEN;
  const pid = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !pid || !phoneDigits) return false;
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${pid}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: phoneDigits, type: 'text', text: { body: text } }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  // Segredo simples na URL (o webhook do Chatwoot não manda Bearer)
  if (req.nextUrl.searchParams.get('k') !== process.env.WA_AUTOREPLY_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any = {};
  try { body = await req.json(); } catch { return NextResponse.json({ ok: true }); }

  // Só reage à CRIAÇÃO de conversa (dispara 1x por conversa nova) e só no
  // canal de WhatsApp.
  if (body?.event !== 'conversation_created') return NextResponse.json({ ok: true, ignored: 'event' });
  const channel = body?.meta?.channel ?? body?.channel ?? '';
  const inboxId = body?.inbox_id ?? body?.conversation?.inbox_id;
  const isWhatsapp = String(channel).includes('Whatsapp') || inboxId === 3;
  if (!isWhatsapp) return NextResponse.json({ ok: true, ignored: 'channel' });

  // Telefone + nome do contato (caminhos defensivos do payload Chatwoot)
  const sender = body?.meta?.sender ?? body?.sender ?? {};
  const rawPhone = sender.phone_number ?? sender.identifier ?? '';
  const phone = String(rawPhone).replace(/\D/g, '');
  const name = (sender.name ?? '').toString().trim();
  if (phone.length < 10) return NextResponse.json({ ok: true, ignored: 'no_phone' });

  const link = `${APP}/g/entrar?p=${phone}${name ? `&n=${encodeURIComponent(name)}` : ''}`;
  const firstName = name.split(/\s+/)[0] || '';
  const text =
    `Oiii${firstName ? `, ${firstName}` : ''}! Que bom te ver por aqui 💖 Tem vaga sim!\n\n` +
    `Entra no nosso grupo de promoções por aqui: ${link}\n\n` +
    'E me conta uma coisinha, pra eu conseguir te ajudar melhor: o que MAIS te incomoda no seu cabelo hoje? ' +
    '(queda, frizz, pontas ressecadas, quebra, crescimento, volume…) 💬';

  const sent = await sendWhatsApp(phone, text);
  return NextResponse.json({ ok: true, sent });
}
