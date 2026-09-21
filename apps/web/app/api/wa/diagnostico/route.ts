import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/wa/diagnostico?k=<WA_DIAG_SECRET>
 *
 * Retrato do canal oficial de WhatsApp: em que categoria cada template foi
 * APROVADO (a Meta aprova em categoria diferente da pedida e não avisa — a v3
 * da mensagem de inscrição foi pedida UTILITY e voltou MARKETING, ~9× mais
 * cara) e qual a qualidade do número.
 *
 * Existe porque essa informação só vivia na Graph API, e olhar exigia o token,
 * que ninguém deve copiar para lugar nenhum. Só devolve metadado — nenhum
 * telefone de cliente, nenhum conteúdo de conversa.
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
    const r = await fetch(`https://graph.facebook.com/v21.0/${caminho}${caminho.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`, { cache: 'no-store' });
    return r.json().catch(() => ({}));
  };

  // Entrega de VERDADE, por template. A paginação do template_analytics é
  // quebrada quando o intervalo é grande: a Meta devolve só a primeira página
  // e finge que acabou. Por isso a janela é curta (7 dias).
  const fim = Math.floor(Date.now() / 1000);
  const ini = fim - 7 * 86400;

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [templates, numero, analytics] = await Promise.all([
    graph(`${waba}/message_templates?fields=id,name,status,category,language,quality_score,components&limit=200`),
    phoneId ? graph(`${phoneId}?fields=display_phone_number,verified_name,quality_rating,messaging_limit_tier,status`) : Promise.resolve({}),
    graph(`${waba}?fields=template_analytics.start(${ini}).end(${fim}).granularity(DAILY).metric_types(["SENT","DELIVERED","READ"])`),
  ]);

  // Soma por template no período (a resposta vem por dia).
  const porTemplate = new Map<string, { enviadas: number; entregues: number; lidas: number }>();
  for (const linha of ((analytics as any)?.template_analytics?.data?.[0]?.data_points ?? [])) {
    const id = String(linha.template_id ?? '');
    const at = porTemplate.get(id) ?? { enviadas: 0, entregues: 0, lidas: 0 };
    at.enviadas += Number(linha.sent ?? 0);
    at.entregues += Number(linha.delivered ?? 0);
    at.lidas += Number(linha.read ?? 0);
    porTemplate.set(id, at);
  }

  return NextResponse.json({
    numero,
    templates: ((templates as any)?.data ?? []).map((t: any) => ({
      nome: t.name, status: t.status, categoria: t.category, idioma: t.language,
      qualidade: t.quality_score?.score ?? null,
      // O texto importa tanto quanto a categoria: é o que a cliente lê.
      corpo: (t.components ?? []).find((c: any) => c.type === 'BODY')?.text ?? null,
      botoes: ((t.components ?? []).find((c: any) => c.type === 'BUTTONS')?.buttons ?? [])
        .map((b: any) => `${b.type}: ${b.text}`),
      entrega7d: porTemplate.get(String(t.id)) ?? null,
    })),
    erro: (templates as any)?.error?.message ?? (analytics as any)?.error?.message ?? null,
  });
}
