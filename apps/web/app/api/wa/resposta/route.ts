import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { ehPedidoDeBloqueio, registrarBloqueio } from '@/lib/wa-optout';
import { classificarResposta } from '@/lib/wa-respostas';
import { responder, marcarConversa, notaPrivada } from '@/lib/chatwoot';
import { resumoQuizTexto, respostasDasSessoes } from '@/lib/quiz-resumo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * POST /api/wa/resposta?k=<WA_AUTOREPLY_SECRET>
 *
 * Webhook do Chatwoot (evento `message_created`): é por aqui que sabemos que a
 * pessoa escreveu — e é a resposta dela que abre a janela de 24h da Meta, onde
 * texto livre é permitido, sem template e sem custo. Clique em botão de LINK
 * não abre a janela; toque em botão de RESPOSTA RÁPIDA abre, porque vira uma
 * mensagem dela.
 *
 * O que fazemos com cada tipo de resposta:
 *  - "Bloquear mensagens" → entra na lista de bloqueio e não recebe mais nada;
 *  - "Quero concluir"     → mandamos o link na hora;
 *  - "Quero meu diagnóstico" → fila da atendente (ela é quem responde);
 *  - "Tenho uma dúvida"   → confirmamos e marcamos a conversa para a equipe;
 *  - resposta automática de outra empresa → NÃO conta como resposta (é robô);
 *  - recusa ("não quero", "cancela") → conta, mas sai da fila do cupom;
 *  - qualquer outra → conta como resposta humana, e a equipe responde no Chatwoot.
 *
 * É webhook e não consulta: a API do Chatwoot precisa do cabeçalho com hífen
 * (ver lib/chatwoot.ts), e empurrar é o caminho que já funciona.
 */

const LINK_OFERTA = process.env.NEXT_PUBLIC_OFERTA_URL || 'https://planodaju.julianecost.com/oferta';

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

function primeiroNome(corpo: any): string {
  const n = String(corpo?.sender?.name ?? '').trim().split(/\s+/)[0] ?? '';
  return n && n.length > 1 ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : '';
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

  const texto = String(corpo?.content ?? '');
  const conversa = corpo?.conversation?.id;   // display_id — é o que a API do Chatwoot usa
  const tipo = classificarResposta(texto);
  const agora = new Date().toISOString();

  try {
    const sb = await createServiceClient();

    // ── Pedido de bloqueio: para tudo e confirma ──────────────────────────
    if (tipo === 'bloqueio' || ehPedidoDeBloqueio(texto)) {
      await registrarBloqueio(sb, digitos, 'whatsapp');
      await responder(conversa, digitos, 'Pronto! Você não vai mais receber mensagens automáticas por aqui. 💛');
      await marcarLead(sb, digitos, { resposta_tipo: 'bloqueio', resposta_texto: texto.slice(0, 200) });
      return NextResponse.json({ ok: true, bloqueado: true });
    }

    // ── "Pode enviar por aqui": a cliente autoriza receber o plano no WhatsApp ──
    // O toque no botão conta como mensagem DELA: a janela de 24 h abre e o
    // plano pode ir por texto, sem template e sem custo por mensagem.
    if (tipo === 'botao_plano_wa') {
      const lead = await marcarLead(sb, digitos, {
        resposta_tipo: tipo, resposta_texto: texto.slice(0, 200), respondeu_em: agora,
      });
      await marcarPlanoPorWhatsApp(sb, digitos);
      await responder(conversa, digitos,
        'Perfeito! 💛 Vou te mandar o seu plano por aqui. Se precisar de qualquer ajuste, é só me falar nesta conversa.');
      await marcarConversa(conversa, 'plano-por-whatsapp');
      return NextResponse.json({ ok: true, planoPorWhatsapp: true, lead: lead ?? null });
    }

    // ── "Quero meu diagnóstico": vai para a fila da ATENDENTE ─────────────
    // Quem monta e entrega o diagnóstico é uma pessoa da equipe. O que o
    // sistema faz aqui é o que ninguém precisa fazer à mão: registrar o
    // aceite, marcar a conversa e deixar as respostas do quiz na nota privada,
    // para a atendente responder sem procurar nada. O toque no botão já abriu
    // a janela de 24 h — dentro dela a equipe fala por texto, sem template.
    if (tipo === 'botao_diagnostico') {
      const lead = await marcarLead(sb, digitos, {
        resposta_tipo: tipo, resposta_texto: texto.slice(0, 200), respondeu_em: agora,
      });
      await marcarConversa(conversa, 'quer-diagnostico');
      await notaPrivada(conversa, await notaDoQuiz(sb, digitos));
      await responder(conversa, digitos, esperaDoDiagnostico(primeiroNome(corpo)));
      return NextResponse.json({ ok: true, querDiagnostico: true, lead: lead ?? null });
    }

    // ── Cortesia UGC cobrada por engano ──────────────────────────────────
    // "Eu ganhei o plano com a Bianca": ela recebeu o plano de graça e mesmo
    // assim levou "finalize sua inscrição". Para a régua na hora (a cortesia
    // pode ter sido ativada depois do envio, ou com e-mail errado no cadastro),
    // pede desculpa e joga a conversa para atendimento humano.
    if (tipo === 'cortesia') {
      // Sem optout aqui: ela não pediu para parar de receber mensagens, e o
      // bloqueio permanente calaria também as boas-vindas e o suporte. Marcar
      // o lead abaixo já a tira das duas réguas de cobrança.
      await responder(conversa, digitos,
        'Ai, me desculpa! 🙈 Se você já recebeu o Plano de cortesia, ignora essa mensagem — não é para você pagar nada. Já tirei o seu número da fila desse aviso.\n\nSe o seu acesso não estiver funcionando, me fala por aqui que eu resolvo. 💛');
      await marcarConversa(conversa, 'cortesia-cobrada');
      await marcarLead(sb, digitos, {
        resposta_tipo: 'cortesia',
        resposta_texto: texto.slice(0, 200),
        respondeu_em: agora,
        desconto_enviado_em: agora, // não entra na fila do cupom
      });
      return NextResponse.json({ ok: true, cortesia: true });
    }

    // O lead guarda DDD+número (10-11 dígitos); o WhatsApp manda com o 55 na
    // frente. Comparar pelos ÚLTIMOS dígitos cobre os dois formatos, e ainda o
    // nono dígito que o WhatsApp às vezes omite em número antigo.
    const campos: Record<string, unknown> = { resposta_tipo: tipo, resposta_texto: texto.slice(0, 200) };

    // Robô de outra empresa não é resposta: sem isso, o cupom de R$14,90 ia
    // para a saudação automática de um salão.
    if (tipo !== 'automatica') campos.respondeu_em = agora;
    // Quem recusou sai da fila do cupom (mas continua podendo ser atendida).
    if (tipo === 'recusa') campos.desconto_enviado_em = agora;

    const lead = await marcarLead(sb, digitos, campos);

    // ── Botões: resposta na hora, dentro da janela que o toque acabou de abrir ──
    let respondido: string | null = null;
    if (tipo === 'botao_concluir') {
      const nome = primeiroNome(corpo);
      respondido = await responder(conversa, digitos,
        `${nome ? `Que bom, ${nome}! ` : 'Que bom! '}É só tocar aqui para concluir a sua inscrição: ${LINK_OFERTA}\n\nSe travar em alguma etapa, me conta por aqui que eu te ajudo. 💛`);
    } else if (tipo === 'botao_duvida') {
      respondido = await responder(conversa, digitos,
        'Claro! Me conta: o que mais te incomoda no seu cabelo hoje? Eu te respondo por aqui. 💛');
      await marcarConversa(conversa, 'duvida-inscricao');
    }

    return NextResponse.json({ ok: true, tipo, lead: lead ?? null, respondido });
  } catch {
    // Falhar aqui não pode atrapalhar o atendimento no Chatwoot.
    return NextResponse.json({ ok: true, erro: true });
  }
}

/**
 * Anota a resposta no lead mais recente daquele telefone.
 *
 * Antes só marcava quando `respondeu_em` era nulo, e por isso perdia quem já
 * tinha escrito alguma vez antes: das 91 pessoas que responderam à mensagem de
 * inscrição, só 63 entravam no registro. A janela de 24h conta a partir da
 * ÚLTIMA mensagem dela, então sobrescrever é o certo.
 */
async function marcarLead(sb: any, digitos: string, campos: Record<string, unknown>): Promise<string | null> {
  const finais = digitos.slice(-8);
  const { data: leads } = await (sb.from('wg_quiz_leads') as any)
    .select('id')
    .like('phone', `%${finais}`)
    .order('inscricao_wa_enviada_em', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1);

  const lead = ((leads ?? []) as any[])[0];
  if (!lead) return null;
  await (sb.from('wg_quiz_leads') as any).update(campos).eq('id', lead.id);
  return lead.id;
}

/**
 * Anota que a cliente pediu o plano pelo WhatsApp.
 *
 * Casa pelo fim do telefone (o perfil guarda DDD+número, o WhatsApp manda com
 * o 55 na frente e às vezes sem o nono dígito). Sem isto, o pedido dela
 * dependeria de alguém lembrar de anotar.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function marcarPlanoPorWhatsApp(sb: any, digitos: string): Promise<void> {
  const final8 = digitos.replace(/\D/g, '').slice(-8);
  if (final8.length < 8) return;
  const { data } = await sb.from('profiles')
    .select('id, phone')
    .not('phone', 'is', null)
    .ilike('phone', `%${final8}`)
    // NULLS LAST: em DESC o Postgres traz nulo primeiro, e um perfil que nunca
    // ativou vencia a cliente de verdade quando dois números terminam igual.
    .order('subscription_activated_at', { ascending: false, nullsFirst: false })
    .limit(1);
  const perfil = (data ?? [])[0];
  if (!perfil) return;
  await sb.from('profiles')
    .update({ plano_por_wa_pedido_em: new Date().toISOString() })
    .eq('id', perfil.id);
}

/**
 * Aviso de que a resposta vem de gente, com o prazo certo.
 *
 * Sem isto a cliente toca no botão e fica no vácuo até alguém abrir o
 * Chatwoot — e a janela de 24 h corre igual. Fora do expediente o texto muda:
 * prometer "já já" às 22h queima a confiança que a mensagem acabou de ganhar.
 */
function esperaDoDiagnostico(nome: string): string {
  const agora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const dia = agora.getDay();
  const minutos = agora.getHours() * 60 + agora.getMinutes();
  const noExpediente = dia >= 1 && dia <= 5 && minutos >= 8 * 60 && minutos < 17 * 60 + 30;
  const abertura = 'Nosso atendimento é de segunda a sexta, das 8h às 17h30.';
  return noExpediente
    ? `${nome ? `Oi, ${nome}! ` : 'Oi! '}Estou olhando as suas respostas do quiz agora e já te mando o seu diagnóstico por aqui. 💛`
    : `${nome ? `Oi, ${nome}! ` : 'Oi! '}Recebi o seu pedido 💛 Vou olhar as suas respostas do quiz e te mandar o diagnóstico por aqui. ${abertura}`;
}

/** Respostas do quiz daquela pessoa, prontas para a atendente ler na conversa. */
async function notaDoQuiz(sb: any, digitos: string): Promise<string> {
  try {
    const finais = digitos.slice(-8);
    const { data } = await (sb.from('wg_quiz_leads') as any)
      .select('session_id, name')
      .like('phone', `%${finais}`)
      .order('created_at', { ascending: false })
      .limit(5);
    const leads = (data ?? []) as any[];
    const respostas = await respostasDasSessoes(sb, leads.map((l) => l.session_id));
    const resumo = resumoQuizTexto(respostas);
    return resumo
      ? `🔔 Pediu o diagnóstico pelo botão. Respostas do quiz:\n\n${resumo}`
      : '🔔 Pediu o diagnóstico pelo botão. Não achei as respostas do quiz deste número — confira no painel pelo e-mail.';
  } catch {
    return '🔔 Pediu o diagnóstico pelo botão.';
  }
}
