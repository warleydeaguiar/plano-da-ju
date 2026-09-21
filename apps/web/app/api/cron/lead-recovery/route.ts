import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { acessoDosLeads } from '@/lib/acesso-lead';
import { saudeDoCanal } from '@/lib/wa-saude';
import { telefonesBloqueados, finalTelefone } from '@/lib/wa-optout';
import { templateUtilitarioAprovado } from '@/lib/wa-templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/cron/lead-recovery?k=<WA_AUTOREPLY_SECRET>  (ou Bearer CRON_SECRET)
 *
 * Quem respondeu o quiz, virou lead e NÃO comprou recebe uma mensagem pelo
 * número oficial (Cloud API), via template aprovado pela Meta — é o único jeito
 * de falar fora da janela de 24h. Era o buraco do funil: existia recuperação de
 * PIX para quem já tinha chegado no pagamento, e nada para quem parou antes.
 *
 * JANELA (min 20 minutos, máx 3 horas depois de virar lead):
 *   - o piso dá tempo de a pessoa comprar sozinha, sem gastar mensagem;
 *   - o teto é o que garante "só leads novos, daqui pra frente". A base tem
 *     98 mil leads antigos e nenhum deles cabe nesta janela, então ligar o cron
 *     não dispara um blast retroativo — decisão consciente, não efeito colateral.
 *
 * Uma mensagem por pessoa (inscricao_wa_enviada_em) e no máximo 3 tentativas,
 * para um erro permanente não virar laço.
 *
 * ?dry=1 → não envia nem marca, só relata o que faria.
 */
// v4 = botões de resposta rápida ("Quero concluir" / "Tenho uma dúvida"), que
// ABREM a janela de 24h quando tocados — botão de link não abre. v2 = atual, com
// link + "Bloquear mensagens". A v3 foi aprovada como MARKETING e por isso NÃO
// entra aqui: seria ~9× mais cara.
// Primeira mensagem nova: em vez de cobrar a inscrição, oferece o diagnóstico
// do quiz que a pessoa já respondeu, e pergunta se pode mandar. Quem toca em
// "Quero meu diagnóstico" é atendida por uma pessoa da equipe — é ela quem
// monta e entrega o diagnóstico, dentro da janela de 24 h que o toque abre.
// Medição da v5 em 21 dias: 961 enviadas, 7,5% responderam, 4,4% pediram para
// parar. Pedir algo é o que faz a primeira mensagem valer a pena receber.
const TEMPLATE_DIAG   = process.env.WHATSAPP_LEAD_TEMPLATE_DIAG || 'diagnostico_quiz_v1';
const TEMPLATE_NOVO   = process.env.WHATSAPP_LEAD_TEMPLATE_V4 || 'inscricao_pendente_util_v4';
// v5 = mesmo texto da v2 SEM o preço. Com o preço dinâmico (faixa de gasto do
// quiz), "o pagamento de R$ 34,90" seria falso para três das quatro faixas.
const TEMPLATE_SEM_PRECO = process.env.WHATSAPP_LEAD_TEMPLATE_V5 || 'inscricao_pendente_util_v5';
const TEMPLATE_ATUAL  = process.env.WHATSAPP_LEAD_TEMPLATE_V2 || 'inscricao_pendente_util_v2';
const TEMPLATE_ANTIGO = process.env.WHATSAPP_LEAD_TEMPLATE || 'inscricao_pendente';

/** Metade dos leads, sempre a mesma metade: o sorteio é o id, não o relógio. */
function ehGrupoNovo(id: string): boolean {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 2 === 0;
}
const TEMPLATE_LANG = process.env.WHATSAPP_LEAD_TEMPLATE_LANG || 'pt_BR';
const MIN_IDADE_MIN = 20;
const MAX_IDADE_HORAS = 3;
// Uma tentativa só. Insistir com quem não respondeu foi o que encheu a lista
// de bloqueio: 7,4% em 7 dias, e o aviso de spam da Meta atrás.
const MAX_TENTATIVAS = 1;
// Lote menor, com teto diário em lib/wa-saude: o cron roda a cada 5 min e
// antes podia despejar 11 mil mensagens por dia.
const LOTE = 15;

function primeiroNome(completo?: string | null): string {
  const n = (completo ?? '').trim().split(/\s+/)[0] ?? '';
  if (!n) return 'tudo bem';
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
}

/** O lead guarda DDD+número; a Graph API quer o internacional. */
function telefoneIntl(bruto?: string | null): string {
  const d = String(bruto ?? '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('55') && d.length >= 12) return d;
  return `55${d}`;
}

async function enviarTemplate(telefone: string, nome: string, template: string): Promise<{ ok: boolean; erro?: string; codigo?: number }> {
  const token = process.env.WHATSAPP_TOKEN;
  const pid = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !pid) return { ok: false, erro: 'sem_token' };
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${pid}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: telefone,
        type: 'template',
        template: {
          name: template,
          language: { code: TEMPLATE_LANG },
          // {{1}} do corpo = primeiro nome. O botão é URL fixa, sem variável.
          components: [{ type: 'body', parameters: [{ type: 'text', text: nome }] }],
        },
      }),
    });
    if (res.ok) return { ok: true };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const j: any = await res.json().catch(() => ({}));
    return { ok: false, erro: JSON.stringify(j?.error ?? j).slice(0, 300), codigo: Number(j?.error?.code) || undefined };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'falha_fetch' };
  }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const waSecret = process.env.WA_AUTOREPLY_SECRET;
  const auth = req.headers.get('authorization');
  const k = req.nextUrl.searchParams.get('k');
  const autorizado =
    (secret && auth === `Bearer ${secret}`) ||
    (waSecret && k === waSecret) ||
    (secret && k === secret);
  if (!autorizado) return NextResponse.json({ error: 'não autorizado' }, { status: 401 });

  const dry = req.nextUrl.searchParams.get('dry') === '1';
  const sb = await createServiceClient();

  const agora = Date.now();
  const ateAqui = new Date(agora - MIN_IDADE_MIN * 60_000).toISOString();
  const desdeAqui = new Date(agora - MAX_IDADE_HORAS * 3600_000).toISOString();

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data: leads, error } = await (sb.from('wg_quiz_leads') as any)
    .select('id, name, email, phone, created_at, inscricao_wa_tentativas')
    .is('inscricao_wa_enviada_em', null)
    .lt('inscricao_wa_tentativas', MAX_TENTATIVAS)
    .not('phone', 'is', null)
    .gte('created_at', desdeAqui)
    .lte('created_at', ateAqui)
    .order('created_at', { ascending: true })
    .limit(LOTE);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const candidatos = (leads ?? []) as any[];
  if (!candidatos.length) return NextResponse.json({ ok: true, enviados: 0, pulados: 0 });

  // Quem já tem o plano não recebe. Casa por e-mail E por telefone: a cortesia
  // da parceria é cadastrada à mão e já veio com e-mail errado (hormail.com,
  // gamil.com) — nesses casos a menina ganhou o plano e recebeu cobrança.
  //
  // Duas razões diferentes para pular, e vale distinguir: quem PAGOU já é
  // cliente; quem tem CORTESIA da parceria recebeu o plano de graça, e mandar
  // "finalize sua inscrição por R$34,90" para ela seria cobrar o que já é dela.
  // O comportamento é o mesmo (não envia), mas guardar o motivo certo evita ler
  // 80 cortesias como 80 vendas depois.
  // Trava de segurança: teto diário e qualidade do número (o único sinal de
  // rejeição real que a Meta entrega). Perder o número levaria junto a
  // confirmação de compra e a recuperação de PIX.
  const saude = await saudeDoCanal(sb);
  if (!saude.podeEnviar) {
    return NextResponse.json({
      ok: true, pausado: true, motivo: saude.motivo,
      qualidade: saude.qualidade, enviadas_hoje: saude.enviadasHoje, teto_hoje: saude.tetoHoje,
    });
  }

  const acessoDe = await acessoDosLeads(sb, candidatos);
  // Quem tocou em "Bloquear mensagens" (ou pediu para sair) não recebe mais nada.
  const bloqueados = await telefonesBloqueados(sb, candidatos.map((l) => l.phone));

  let enviados = 0;
  let pulados = 0;
  const porTemplate: Record<string, number> = {};
  // Só entram se a Meta confirmar APROVADO **e** UTILITY (a v3 foi aprovada como
  // MARKETING; sem esta checagem o gasto saltaria ~9×).
  const diagVale = await templateUtilitarioAprovado(TEMPLATE_DIAG);
  const novoVale = await templateUtilitarioAprovado(TEMPLATE_NOVO);
  const semPrecoVale = await templateUtilitarioAprovado(TEMPLATE_SEM_PRECO);
  // Template que a Meta recusar nesta execução (erro 132xxx) não é tentado de novo.
  const ruins = new Set<string>();
  const falhas: { id: string; erro: string }[] = [];

  for (const lead of candidatos) {
    const telefone = telefoneIntl(lead.phone);

    const acesso = acessoDe(lead);
    const bloqueou = !!telefone && bloqueados.has(finalTelefone(telefone));
    if (!telefone || bloqueou || acesso) {
      pulados++;
      // Marca como resolvido: comprou (ou não tem telefone), não precisa voltar
      // à fila em todo ciclo.
      if (!dry) {
        await (sb.from('wg_quiz_leads') as any)
          .update({
            inscricao_wa_enviada_em: new Date().toISOString(),
            inscricao_wa_erro: acesso === 'pago' ? 'ja_comprou'
              : acesso === 'cortesia' ? 'ja_cortesia'
              : bloqueou ? 'bloqueou'
              : 'sem_telefone',
          })
          .eq('id', lead.id);
      }
      continue;
    }

    if (dry) { enviados++; continue; }

    // Ordem: diagnóstico (quando a Meta aprovar) → versão em teste (metade dos
    // leads) → versão sem preço → atual → antiga.
    const fila = [
      ...(diagVale ? [TEMPLATE_DIAG] : []),
      ...(novoVale && ehGrupoNovo(lead.id) ? [TEMPLATE_NOVO] : []),
      ...(semPrecoVale ? [TEMPLATE_SEM_PRECO] : []),
      TEMPLATE_ATUAL,
      TEMPLATE_ANTIGO,
    ].filter((t) => !ruins.has(t));

    let r: { ok: boolean; erro?: string; codigo?: number } = { ok: false, erro: 'sem_template' };
    let usado = '';
    for (const t of fila) {
      r = await enviarTemplate(telefone, primeiroNome(lead.name), t);
      usado = t;
      if (r.ok) break;
      // 132xxx = problema do template (não aprovado, pausado, inexistente).
      if (!r.codigo || r.codigo < 132000 || r.codigo > 132999) break;
      ruins.add(t);
    }
    if (r.ok) {
      enviados++;
      porTemplate[usado] = (porTemplate[usado] ?? 0) + 1;
      await (sb.from('wg_quiz_leads') as any)
        .update({ inscricao_wa_enviada_em: new Date().toISOString(), inscricao_wa_erro: null, inscricao_wa_template: usado })
        .eq('id', lead.id);
    } else {
      falhas.push({ id: lead.id, erro: r.erro ?? '?' });
      await (sb.from('wg_quiz_leads') as any)
        .update({
          inscricao_wa_tentativas: (lead.inscricao_wa_tentativas ?? 0) + 1,
          inscricao_wa_erro: r.erro ?? null,
        })
        .eq('id', lead.id);
    }
    // Respiro entre envios: rajada no número oficial derruba a qualidade.
    await new Promise((r2) => setTimeout(r2, 400));
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return NextResponse.json({
    ok: true, dry, templates: porTemplate, testeNovo: novoVale,
    candidatos: candidatos.length, enviados, pulados,
    falhas: falhas.slice(0, 5),
  });
}
