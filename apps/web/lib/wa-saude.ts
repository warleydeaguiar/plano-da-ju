/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Trava de segurança do canal de WhatsApp.
 *
 * ⚠️ O botão "Bloquear mensagens" das nossas mensagens é um QUICK REPLY nosso,
 * não o bloqueio do WhatsApp: quem toca nele continua com o contato liberado e
 * só entra na nossa lista de não-enviar (`wa_optout`). Para a Meta aquilo é uma
 * RESPOSTA — ou seja, engajamento. Não serve, portanto, como medida de
 * rejeição, e usá-la como gatilho pausava a régua sem motivo.
 *
 * O sinal que a Meta de fato enxerga (bloqueios de verdade e denúncias) ela não
 * entrega aberto: entrega mastigado no `quality_rating` do número — GREEN,
 * YELLOW ou RED. É esse o gatilho aqui, somado a um teto diário, porque volume
 * alto foi o que levou ao aviso de spam de 20/09/2026.
 */
export const TETO_DIARIO_LEADS = 150;
/** Com qualidade amarela o volume cai pela metade: sinal de alerta, não de parada. */
export const TETO_DIARIO_AMARELO = 75;

export interface SaudeCanal {
  qualidade: string;
  enviadasHoje: number;
  tetoHoje: number;
  optoutsHoje: number;
  podeEnviar: boolean;
  motivo: string;
}

const cacheQualidade = { ate: 0, valor: 'UNKNOWN' };

/** Qualidade do número segundo a Meta. Cache de 10 min (o cron roda a cada 5). */
export async function qualidadeDoNumero(): Promise<string> {
  if (cacheQualidade.ate > Date.now()) return cacheQualidade.valor;
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  let valor = 'UNKNOWN';
  if (token && phoneId) {
    try {
      const r = await fetch(
        `https://graph.facebook.com/v21.0/${phoneId}?fields=quality_rating&access_token=${encodeURIComponent(token)}`,
        { cache: 'no-store' },
      );
      const j: any = await r.json();
      if (typeof j?.quality_rating === 'string') valor = j.quality_rating.toUpperCase();
    } catch { /* sem resposta: segue como UNKNOWN, que não bloqueia */ }
  }
  cacheQualidade.ate = Date.now() + 10 * 60_000;
  cacheQualidade.valor = valor;
  return valor;
}

export async function saudeDoCanal(sb: any): Promise<SaudeCanal> {
  const inicioHojeBR = (() => {
    const agora = new Date(Date.now() - 3 * 3600_000);
    return new Date(`${agora.toISOString().slice(0, 10)}T03:00:00.000Z`).toISOString();
  })();

  const [qualidade, hoje, optouts] = await Promise.all([
    qualidadeDoNumero(),
    sb.from('wg_quiz_leads').select('id', { count: 'exact', head: true })
      .gte('inscricao_wa_enviada_em', inicioHojeBR).is('inscricao_wa_erro', null),
    // Só para acompanhar: quem pediu para não receber é informação útil de
    // copy, não motivo para parar o envio.
    sb.from('wa_optout').select('final8', { count: 'exact', head: true }).gte('criado_em', inicioHojeBR),
  ]);

  const enviadasHoje = hoje.count ?? 0;
  const optoutsHoje = optouts.count ?? 0;
  const tetoHoje = qualidade === 'YELLOW' ? TETO_DIARIO_AMARELO : TETO_DIARIO_LEADS;

  // Vermelho é a Meta dizendo que o número está prestes a ser restringido.
  if (qualidade === 'RED') {
    return { qualidade, enviadasHoje, tetoHoje, optoutsHoje, podeEnviar: false, motivo: 'qualidade_vermelha' };
  }
  if (enviadasHoje >= tetoHoje) {
    return { qualidade, enviadasHoje, tetoHoje, optoutsHoje, podeEnviar: false, motivo: `teto_diario:${enviadasHoje}/${tetoHoje}` };
  }
  return { qualidade, enviadasHoje, tetoHoje, optoutsHoje, podeEnviar: true, motivo: 'ok' };
}
