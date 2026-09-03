import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

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
const TEMPLATE = process.env.WHATSAPP_LEAD_TEMPLATE || 'inscricao_pendente';
const TEMPLATE_LANG = process.env.WHATSAPP_LEAD_TEMPLATE_LANG || 'pt_BR';
const MIN_IDADE_MIN = 20;
const MAX_IDADE_HORAS = 3;
const MAX_TENTATIVAS = 3;
const LOTE = 40;

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

async function enviarTemplate(telefone: string, nome: string): Promise<{ ok: boolean; erro?: string }> {
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
          name: TEMPLATE,
          language: { code: TEMPLATE_LANG },
          // {{1}} do corpo = primeiro nome. O botão é URL fixa, sem variável.
          components: [{ type: 'body', parameters: [{ type: 'text', text: nome }] }],
        },
      }),
    });
    if (res.ok) return { ok: true };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const j: any = await res.json().catch(() => ({}));
    return { ok: false, erro: JSON.stringify(j?.error ?? j).slice(0, 300) };
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

  // Quem já comprou não recebe. A checagem é por e-mail, que é a chave que o
  // checkout grava no profile.
  const emails = candidatos.map((l) => (l.email ?? '').toLowerCase().trim()).filter(Boolean);
  const { data: compradores } = emails.length
    ? await (sb.from('profiles') as any)
        .select('email')
        .in('email', emails)
        .eq('subscription_status', 'active')
    : { data: [] as any[] };
  const jaComprou = new Set(((compradores ?? []) as any[]).map((p) => String(p.email).toLowerCase()));

  let enviados = 0;
  let pulados = 0;
  const falhas: { id: string; erro: string }[] = [];

  for (const lead of candidatos) {
    const email = (lead.email ?? '').toLowerCase().trim();
    const telefone = telefoneIntl(lead.phone);

    if (!telefone || (email && jaComprou.has(email))) {
      pulados++;
      // Marca como resolvido: comprou (ou não tem telefone), não precisa voltar
      // à fila em todo ciclo.
      if (!dry) {
        await (sb.from('wg_quiz_leads') as any)
          .update({ inscricao_wa_enviada_em: new Date().toISOString(), inscricao_wa_erro: email && jaComprou.has(email) ? 'ja_comprou' : 'sem_telefone' })
          .eq('id', lead.id);
      }
      continue;
    }

    if (dry) { enviados++; continue; }

    const r = await enviarTemplate(telefone, primeiroNome(lead.name));
    if (r.ok) {
      enviados++;
      await (sb.from('wg_quiz_leads') as any)
        .update({ inscricao_wa_enviada_em: new Date().toISOString(), inscricao_wa_erro: null })
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
    ok: true, dry, template: TEMPLATE,
    candidatos: candidatos.length, enviados, pulados,
    falhas: falhas.slice(0, 5),
  });
}
