import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendWhatsAppTemplate } from '@/lib/whatsapp';
import { telefonesBloqueados, finalTelefone } from '@/lib/wa-optout';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/cron/boas-vindas?k=<WA_AUTOREPLY_SECRET>  (ou Bearer CRON_SECRET)
 *
 * Boas-vindas pelo número oficial (template acesso_plano, botão → /obrigado,
 * onde a cliente cria a senha) para toda cliente que pagou.
 *
 * Antes saía de dentro do webhook da Pagar.me, disparada sem esperar terminar:
 * a função era encerrada ao responder e parte dos envios nunca saía — 172
 * boas-vindas para 204 vendas entre 04 e 14/09/2026 —, sem registro de quem
 * recebeu. Aqui cada envio fica anotado em profiles.boas_vindas_wa_em, e vale
 * para qualquer caminho de ativação (webhook, tela do PIX, comprovante, cartão).
 *
 * Cortesia da parceria não recebe: o texto diz "o seu pagamento foi confirmado".
 * Uma vez por cliente, no máximo 3 tentativas.
 *
 * ?dry=1 → não envia nem marca, só relata.
 */
const TEMPLATE = process.env.WHATSAPP_WELCOME_TEMPLATE || 'acesso_plano';
const JANELA_DIAS = 30;
const MAX_TENTATIVAS = 3;
const LOTE = 30;

/** O perfil guarda DDD+número; a Graph API quer o internacional. */
function telefoneIntl(bruto?: unknown): string {
  const d = String(bruto ?? '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('55') && d.length >= 12) return d;
  return d.length === 10 || d.length === 11 ? `55${d}` : '';
}

function primeiroNome(completo?: unknown): string {
  const n = String(completo ?? '').trim().split(/\s+/)[0] ?? '';
  if (!n) return 'tudo bem';
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
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
  const desde = new Date(Date.now() - JANELA_DIAS * 86400_000).toISOString();

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data, error } = await (sb.from('profiles') as any)
    .select('id, full_name, phone, quiz_answers, boas_vindas_wa_tentativas')
    .eq('subscription_status', 'active')
    .neq('subscription_type', 'parceria')
    .is('boas_vindas_wa_em', null)
    .lt('boas_vindas_wa_tentativas', MAX_TENTATIVAS)
    .gte('subscription_activated_at', desde)
    .order('subscription_activated_at', { ascending: true })
    .limit(LOTE);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const clientes = (data ?? []) as any[];
  // Quem pediu para não receber mensagens fica de fora, inclusive da boas-vindas.
  const bloqueados = await telefonesBloqueados(sb, clientes.map((p) => p.phone ?? (p.quiz_answers ?? {}).phone));
  let enviados = 0, semTelefone = 0, bloqueou = 0;
  const falhas: { id: string; erro: string }[] = [];

  for (const p of clientes) {
    const ans = (p.quiz_answers ?? {}) as Record<string, unknown>;
    const tel = telefoneIntl(p.phone ?? ans.phone);
    const tentativas = p.boas_vindas_wa_tentativas ?? 0;

    if (!tel) {
      semTelefone++;
      if (!dry) await (sb.from('profiles') as any)
        .update({ boas_vindas_wa_tentativas: MAX_TENTATIVAS, boas_vindas_wa_erro: 'sem_telefone' })
        .eq('id', p.id);
      continue;
    }
    if (bloqueados.has(finalTelefone(tel))) {
      bloqueou++;
      if (!dry) await (sb.from('profiles') as any)
        .update({ boas_vindas_wa_tentativas: MAX_TENTATIVAS, boas_vindas_wa_erro: 'bloqueou' })
        .eq('id', p.id);
      continue;
    }
    if (dry) { enviados++; continue; }

    // Reserva antes de enviar: se duas execuções se sobrepuserem, só uma passa.
    const { data: reservado } = await (sb.from('profiles') as any)
      .update({ boas_vindas_wa_tentativas: tentativas + 1 })
      .eq('id', p.id)
      .is('boas_vindas_wa_em', null)
      .eq('boas_vindas_wa_tentativas', tentativas)
      .select('id');
    if (!reservado?.length) continue;

    const r = await sendWhatsAppTemplate({ to: tel, template: TEMPLATE, bodyParams: [primeiroNome(p.full_name ?? ans.name)] });
    if (r.ok) {
      enviados++;
      await (sb.from('profiles') as any)
        .update({ boas_vindas_wa_em: new Date().toISOString(), boas_vindas_wa_erro: null })
        .eq('id', p.id);
    } else {
      falhas.push({ id: p.id, erro: r.error ?? '?' });
      await (sb.from('profiles') as any).update({ boas_vindas_wa_erro: r.error ?? '?' }).eq('id', p.id);
    }
    await new Promise((res) => setTimeout(res, 300));
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return NextResponse.json({
    ok: true, dry, template: TEMPLATE,
    candidatos: clientes.length, enviados, semTelefone, bloqueou, falhas: falhas.slice(0, 5),
  });
}
