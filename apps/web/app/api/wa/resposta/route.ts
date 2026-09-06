import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * POST /api/wa/resposta?k=<WA_AUTOREPLY_SECRET>
 *
 * Webhook do Chatwoot (evento `message_created`). Marca no lead a hora em que
 * ELA respondeu no WhatsApp.
 *
 * Por que isso importa: a janela de 24h da Meta só abre quando a pessoa
 * responde. Clicar num botão do template NÃO abre — o clique leva a uma página
 * no navegador, não manda mensagem. Quem respondeu pode receber texto livre,
 * de graça e sem template aprovado; quem só clicou, não.
 *
 * É webhook e não consulta: a API do Chatwoot devolve 401 daqui de fora (o
 * Cloudflare remove o header do token), então empurrar é o caminho que funciona.
 */

/** Só o que a CLIENTE mandou conta. Resposta da Juliane não abre janela nenhuma. */
function ehDaCliente(corpo: any): boolean {
  const tipo = corpo?.message_type;
  // O Chatwoot manda 'incoming' (string) ou 0 (enum), dependendo da versão.
  return tipo === 'incoming' || tipo === 0;
}

/** O telefone chega em lugares diferentes conforme o evento. */
function telefoneDe(corpo: any): string {
  const bruto =
    corpo?.sender?.phone_number ??
    corpo?.conversation?.meta?.sender?.phone_number ??
    corpo?.contact?.phone_number ??
    '';
  return String(bruto).replace(/\D/g, '');
}

export async function POST(req: NextRequest) {
  // Segredo na URL: o Chatwoot não assina o webhook, então é o que temos.
  const k = req.nextUrl.searchParams.get('k');
  if (!process.env.WA_AUTOREPLY_SECRET || k !== process.env.WA_AUTOREPLY_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const corpo = await req.json().catch(() => null);
  // Sempre 200 daqui pra baixo: webhook que responde erro vira fila de retentativa
  // no Chatwoot, e nada aqui é urgente o bastante para isso.
  if (!corpo || corpo.event !== 'message_created' || !ehDaCliente(corpo)) {
    return NextResponse.json({ ok: true, ignorado: true });
  }

  const digitos = telefoneDe(corpo);
  if (digitos.length < 10) return NextResponse.json({ ok: true, semTelefone: true });

  // O lead guarda DDD+número (10-11 dígitos); o WhatsApp manda com o 55 na
  // frente. Comparar pelos ÚLTIMOS dígitos cobre os dois formatos, e ainda o
  // nono dígito que o WhatsApp às vezes omite em número antigo.
  const finais = digitos.slice(-8);

  try {
    const sb = await createServiceClient();
    const { data: leads } = await (sb.from('wg_quiz_leads') as any)
      .select('id, respondeu_em')
      .like('phone', `%${finais}`)
      .is('respondeu_em', null)
      .order('created_at', { ascending: false })
      .limit(1);

    const lead = ((leads ?? []) as any[])[0];
    if (!lead) return NextResponse.json({ ok: true, semLead: true });

    await (sb.from('wg_quiz_leads') as any)
      .update({ respondeu_em: new Date().toISOString() })
      .eq('id', lead.id);

    return NextResponse.json({ ok: true, marcado: lead.id });
  } catch {
    // Falhar aqui não pode atrapalhar o atendimento no Chatwoot.
    return NextResponse.json({ ok: true, erro: true });
  }
}
