import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SUPA_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Registra o clique num link de WhatsApp.
 *
 * Grava com a chave de serviço aqui no servidor, e não direto do navegador:
 * a tabela é de operação e liberar escrita para a chave anônima abriria a
 * porta para inflarem o número de fora.
 *
 * Nunca falha para o visitante — se a gravação der errado, ela some em
 * silêncio. O clique só pode ir para o WhatsApp; medir é secundário.
 */
export async function POST(req: NextRequest) {
  if (!SUPA_URL || !SERVICE_KEY) return NextResponse.json({ ok: true });

  try {
    const b = await req.json().catch(() => ({}));
    const ua = req.headers.get('user-agent') || '';

    await fetch(`${SUPA_URL}/rest/v1/site_cliques_whatsapp`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        path: String(b.path || '').slice(0, 300),
        produto: b.produto ? String(b.produto).slice(0, 160) : null,
        rotulo: b.rotulo ? String(b.rotulo).slice(0, 120) : null,
        dispositivo: /Mobi|Android|iPhone|iPad/i.test(ua) ? 'celular' : 'computador',
      }),
    });
  } catch {
    // medição nunca atrapalha o visitante
  }
  return NextResponse.json({ ok: true });
}
