import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { saudeDoCanal } from '@/lib/wa-saude';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * GET /api/wa/diagnostico?k=<WA_DIAG_SECRET>
 *
 * Retrato do canal oficial de WhatsApp: em que categoria cada template foi
 * APROVADO (a Meta aprova em categoria diferente da pedida e não avisa — a v3
 * da mensagem de inscrição foi pedida UTILITY e voltou MARKETING, ~9× mais
 * cara), o texto que a cliente lê, quanto foi entregue de verdade e qual a
 * qualidade do número.
 *
 * Existe porque isso só vivia na Graph API, e olhar exigia o token — que
 * ninguém deve copiar para lugar nenhum. Só devolve metadado: nenhum telefone
 * de cliente, nenhum conteúdo de conversa.
 */
export async function GET(req: NextRequest) {
  const esperado = process.env.WA_DIAG_SECRET;
  if (!esperado || req.nextUrl.searchParams.get('k') !== esperado) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  }

  const token = process.env.WHATSAPP_TOKEN;
  const waba = process.env.WHATSAPP_WABA_ID || '616707188181921';
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token) return NextResponse.json({ error: 'WHATSAPP_TOKEN ausente' }, { status: 500 });

  const graph = async (caminho: string) => {
    const r = await fetch(
      `https://graph.facebook.com/v21.0/${caminho}${caminho.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`,
      { cache: 'no-store' },
    );
    return r.json().catch(() => ({}));
  };

  const [templates, numero] = await Promise.all([
    graph(`${waba}/message_templates?fields=id,name,status,category,language,quality_score,components&limit=200`),
    phoneId
      ? graph(`${phoneId}?fields=display_phone_number,verified_name,quality_rating,messaging_limit_tier,status`)
      : Promise.resolve({}),
  ]);

  const lista = ((templates as any)?.data ?? []) as any[];

  // Entrega de verdade. Duas etapas porque a Meta exige a lista de
  // template_ids no analytics; e a janela é curta (7 dias) porque a paginação
  // dele quebra em intervalo grande — devolve a primeira página e finge que
  // acabou.
  const fim = Math.floor(Date.now() / 1000);
  const ini = fim - 7 * 86400;
  const ids = lista.map((t) => String(t.id)).filter(Boolean).slice(0, 10);
  const analytics: any = ids.length
    ? await graph(
        `${waba}/template_analytics?start=${ini}&end=${fim}&granularity=DAILY`
        + `&metric_types=${encodeURIComponent('["SENT","DELIVERED","READ"]')}`
        + `&template_ids=${encodeURIComponent(JSON.stringify(ids))}`,
      )
    : {};

  const porTemplate = new Map<string, { enviadas: number; entregues: number; lidas: number }>();
  for (const linha of ((analytics?.data?.[0]?.data_points ?? []) as any[])) {
    const id = String(linha.template_id ?? '');
    const at = porTemplate.get(id) ?? { enviadas: 0, entregues: 0, lidas: 0 };
    at.enviadas += Number(linha.sent ?? 0);
    at.entregues += Number(linha.delivered ?? 0);
    at.lidas += Number(linha.read ?? 0);
    porTemplate.set(id, at);
  }

  const saude = await saudeDoCanal(await createServiceClient()).catch(() => null);

  return NextResponse.json({
    numero,
    // Rejeição da régua fria: é o número que a Meta enxerga como spam.
    saude: saude ? {
      qualidade_meta: saude.qualidade,
      enviadas_hoje: saude.enviadasHoje,
      teto_hoje: saude.tetoHoje,
      // Quem pediu para não receber HOJE. É leitura de copy, não gatilho: o
      // botão é quick reply nosso, e para a Meta aquilo é engajamento.
      pediram_para_parar_hoje: saude.optoutsHoje,
      regua_fria: saude.podeEnviar ? 'liberada' : `pausada (${saude.motivo})`,
    } : null,
    templates: lista.map((t: any) => ({
      nome: t.name,
      status: t.status,
      categoria: t.category,
      idioma: t.language,
      qualidade: t.quality_score?.score ?? null,
      // O texto importa tanto quanto a categoria: é o que a cliente lê.
      corpo: (t.components ?? []).find((c: any) => c.type === 'BODY')?.text ?? null,
      botoes: ((t.components ?? []).find((c: any) => c.type === 'BUTTONS')?.buttons ?? [])
        .map((b: any) => `${b.type}: ${b.text}`),
      entrega7d: porTemplate.get(String(t.id)) ?? null,
    })),
    erro: (templates as any)?.error?.message ?? analytics?.error?.message ?? null,
  });
}
