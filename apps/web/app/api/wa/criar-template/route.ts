import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * POST /api/wa/criar-template?k=<WA_DIAG_SECRET>
 * body: { name, body, footer?, buttons?: [{type:'URL'|'QUICK_REPLY', text, url?}], example? }
 *
 * Submete um template à Meta na categoria UTILITY. A aprovação é dela: pedir
 * utilidade não garante utilidade (a v3 da mensagem de inscrição voltou como
 * MARKETING, ~9× mais cara), e por isso nada passa a ser enviado sem a
 * checagem de `templateUtilitarioAprovado`.
 */
export async function POST(req: NextRequest) {
  const esperado = process.env.WA_DIAG_SECRET;
  if (!esperado || req.nextUrl.searchParams.get('k') !== esperado) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  }

  const token = process.env.WHATSAPP_TOKEN;
  const waba = process.env.WHATSAPP_WABA_ID || '616707188181921';
  if (!token) return NextResponse.json({ error: 'WHATSAPP_TOKEN ausente' }, { status: 500 });

  const b = await req.json().catch(() => ({} as any));
  if (!b?.name || !b?.body) {
    return NextResponse.json({ error: 'name e body são obrigatórios' }, { status: 400 });
  }

  const components: any[] = [
    {
      type: 'BODY',
      text: b.body,
      ...(b.example ? { example: { body_text: [b.example] } } : {}),
    },
  ];
  if (b.footer) components.push({ type: 'FOOTER', text: b.footer });
  if (Array.isArray(b.buttons) && b.buttons.length) {
    components.push({
      type: 'BUTTONS',
      buttons: b.buttons.map((x: any) =>
        x.type === 'URL'
          ? { type: 'URL', text: x.text, url: x.url }
          : { type: 'QUICK_REPLY', text: x.text },
      ),
    });
  }

  const r = await fetch(`https://graph.facebook.com/v21.0/${waba}/message_templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: b.name,
      language: 'pt_BR',
      category: 'UTILITY',
      components,
    }),
  });
  const j = await r.json().catch(() => ({}));
  return NextResponse.json({ ok: r.ok, resposta: j }, { status: r.ok ? 200 : 400 });
}
