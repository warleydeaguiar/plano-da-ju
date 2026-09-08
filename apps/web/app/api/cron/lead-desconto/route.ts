import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * GET /api/cron/lead-desconto?k=<WA_AUTOREPLY_SECRET>
 *
 * Segunda mensagem: a oferta com desconto para quem recebeu a primeira,
 * RESPONDEU, e ainda não comprou.
 *
 * Só para quem respondeu, e isso não é um detalhe: a janela de 24h da Meta abre
 * com a resposta da pessoa, e só dentro dela dá para mandar texto livre. Fora
 * da janela seria preciso um template MARKETING aprovado — mais caro, e sujeito
 * a limite por pessoa. Quem apenas clicou no botão do template NÃO está na
 * janela (o clique abre uma página, não manda mensagem).
 *
 * ?dry=1 → não envia nem marca, só relata.
 */
const ESPERA_HORAS = 2;      // depois da primeira mensagem
const JANELA_HORAS = 23;     // margem sobre as 24h da Meta
const CUPOM = process.env.CUPOM_RECUPERACAO || 'VOLTA15';
const LOTE = 25;

/**
 * Um em cada cinco fica FORA do desconto, de propósito.
 *
 * Sem grupo de controle não há como saber se o desconto trouxe venda nova ou se
 * apenas deu 57% de desconto a quem compraria por R$34,90 no dia seguinte. O
 * sorteio é determinístico pelo id: a mesma pessoa cai sempre do mesmo lado, e
 * reprocessar não muda o grupo dela.
 */
function ehControle(id: string): boolean {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 5 === 0;
}

function primeiroNome(completo?: string | null): string {
  const n = (completo ?? '').trim().split(/\s+/)[0] ?? '';
  if (!n) return 'tudo bem';
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
}

function telefoneIntl(bruto?: string | null): string {
  const d = String(bruto ?? '').replace(/\D/g, '');
  if (!d) return '';
  return d.startsWith('55') && d.length >= 12 ? d : `55${d}`;
}

function mensagem(nome: string): string {
  return (
    `Oi ${nome}! Vi que você ainda não finalizou a sua inscrição no Plano Capilar 💛\n\n`
    + `Separei um desconto pra você: em vez de R$ 34,90, fica por R$ 14,90.\n\n`
    + `É só entrar por aqui que o desconto já vem aplicado:\n`
    + `https://planodaju.julianecost.com/oferta?cupom=${CUPOM}`
  );
}

/** Texto livre — só funciona dentro da janela de 24h. */
async function enviarTexto(telefone: string, texto: string): Promise<{ ok: boolean; erro?: string }> {
  const token = process.env.WHATSAPP_TOKEN;
  const pid = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !pid) return { ok: false, erro: 'sem_token' };
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${pid}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', to: telefone,
        type: 'text', text: { preview_url: true, body: texto },
      }),
    });
    if (r.ok) return { ok: true };
    const j: any = await r.json().catch(() => ({}));
    return { ok: false, erro: JSON.stringify(j?.error ?? j).slice(0, 300) };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'falha_fetch' };
  }
}

export async function GET(req: NextRequest) {
  const k = req.nextUrl.searchParams.get('k');
  const auth = req.headers.get('authorization');
  const ok =
    (process.env.WA_AUTOREPLY_SECRET && k === process.env.WA_AUTOREPLY_SECRET)
    || (process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`);
  if (!ok) return NextResponse.json({ error: 'não autorizado' }, { status: 401 });

  const dry = req.nextUrl.searchParams.get('dry') === '1';
  const sb = await createServiceClient();
  const agora = Date.now();

  const { data: leads, error } = await (sb.from('wg_quiz_leads') as any)
    .select('id, name, email, phone, respondeu_em')
    .not('inscricao_wa_enviada_em', 'is', null)
    .lte('inscricao_wa_enviada_em', new Date(agora - ESPERA_HORAS * 3600_000).toISOString())
    .not('respondeu_em', 'is', null)
    // Dentro da janela: passou disso, texto livre não é entregue.
    .gte('respondeu_em', new Date(agora - JANELA_HORAS * 3600_000).toISOString())
    .is('desconto_enviado_em', null)
    .not('phone', 'is', null)
    .order('respondeu_em', { ascending: true })
    .limit(LOTE);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const candidatos = (leads ?? []) as any[];
  if (!candidatos.length) return NextResponse.json({ ok: true, enviados: 0, controle: 0, jaCompraram: 0 });

  // Quem já tem o plano não recebe oferta de desconto — nem quem pagou, nem
  // quem ganhou por cortesia da parceria. Os dois são contados à parte porque
  // só o primeiro grupo é venda.
  const emails = candidatos.map((l) => (l.email ?? '').toLowerCase().trim()).filter(Boolean);
  const { data: comAcesso } = emails.length
    ? await (sb.from('profiles') as any)
        .select('email, subscription_type').in('email', emails).eq('subscription_status', 'active')
    : { data: [] as any[] };
  const pagantes = new Set<string>();
  const cortesias = new Set<string>();
  for (const p of ((comAcesso ?? []) as any[])) {
    const e = String(p.email).toLowerCase();
    (p.subscription_type === 'parceria' ? cortesias : pagantes).add(e);
  }

  let enviados = 0, controle = 0, jaCompraram = 0, jaCortesia = 0;
  const falhas: { id: string; erro: string }[] = [];

  for (const lead of candidatos) {
    const email = (lead.email ?? '').toLowerCase().trim();
    if (email && (pagantes.has(email) || cortesias.has(email))) {
      if (pagantes.has(email)) jaCompraram++; else jaCortesia++;
      if (!dry) await (sb.from('wg_quiz_leads') as any)
        .update({ desconto_enviado_em: new Date().toISOString() }).eq('id', lead.id);
      continue;
    }

    if (ehControle(lead.id)) {
      controle++;
      if (!dry) await (sb.from('wg_quiz_leads') as any)
        .update({ desconto_enviado_em: new Date().toISOString(), grupo_controle: true })
        .eq('id', lead.id);
      continue;
    }

    if (dry) { enviados++; continue; }

    const r = await enviarTexto(telefoneIntl(lead.phone), mensagem(primeiroNome(lead.name)));
    if (r.ok) {
      enviados++;
      await (sb.from('wg_quiz_leads') as any)
        .update({ desconto_enviado_em: new Date().toISOString() }).eq('id', lead.id);
    } else {
      falhas.push({ id: lead.id, erro: r.erro ?? '?' });
    }
    await new Promise((res) => setTimeout(res, 400));
  }

  return NextResponse.json({
    ok: true, dry, cupom: CUPOM,
    candidatos: candidatos.length, enviados, controle, jaCompraram, jaCortesia,
    falhas: falhas.slice(0, 5),
  });
}
