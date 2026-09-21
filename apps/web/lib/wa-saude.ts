/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Trava de segurança do canal de WhatsApp.
 *
 * Em 20/09/2026 a Meta avisou que a conta estava "enviando spam" e ameaçou
 * desabilitar o número. O que nos levou até ali foi medido: 1.254 mensagens
 * de "inscrição pendente" em 7 dias e 93 pessoas tocando em "Bloquear
 * mensagens" — 7,4%. A Meta trata acima de ~2% como problema.
 *
 * Perder o número não custa só a régua de leads: leva junto a confirmação de
 * compra e a recuperação de PIX, que são as mensagens que a cliente ESPERA
 * receber. Por isso a régua fria para sozinha quando a rejeição sobe, e volta
 * sozinha quando cai — sem depender de alguém lembrar de olhar.
 */
export const LIMITE_BLOQUEIO_PCT = 2;

/** Teto diário da régua fria. Antes o cron podia mandar 11 mil por dia. */
export const TETO_DIARIO_LEADS = 150;

export interface SaudeCanal {
  enviadas7d: number;
  bloqueios7d: number;
  pctBloqueio: number;
  enviadasHoje: number;
  podeEnviar: boolean;
  motivo: string;
}

export async function saudeDoCanal(sb: any): Promise<SaudeCanal> {
  const seteDias = new Date(Date.now() - 7 * 86400_000).toISOString();
  const inicioHojeBR = (() => {
    const agora = new Date(Date.now() - 3 * 3600_000);
    return new Date(`${agora.toISOString().slice(0, 10)}T03:00:00.000Z`).toISOString();
  })();

  const [env, blo, hoje] = await Promise.all([
    sb.from('wg_quiz_leads').select('id', { count: 'exact', head: true })
      .gte('inscricao_wa_enviada_em', seteDias).is('inscricao_wa_erro', null),
    sb.from('wa_optout').select('final8', { count: 'exact', head: true }).gte('criado_em', seteDias),
    sb.from('wg_quiz_leads').select('id', { count: 'exact', head: true })
      .gte('inscricao_wa_enviada_em', inicioHojeBR).is('inscricao_wa_erro', null),
  ]);

  const enviadas7d = env.count ?? 0;
  const bloqueios7d = blo.count ?? 0;
  const enviadasHoje = hoje.count ?? 0;
  // Amostra pequena não condena o canal: abaixo de 100 envios a porcentagem
  // oscila demais para servir de gatilho.
  const pctBloqueio = enviadas7d >= 100 ? (bloqueios7d / enviadas7d) * 100 : 0;

  if (pctBloqueio > LIMITE_BLOQUEIO_PCT) {
    return {
      enviadas7d, bloqueios7d, pctBloqueio, enviadasHoje,
      podeEnviar: false,
      motivo: `rejeicao_alta:${pctBloqueio.toFixed(2)}%`,
    };
  }
  if (enviadasHoje >= TETO_DIARIO_LEADS) {
    return {
      enviadas7d, bloqueios7d, pctBloqueio, enviadasHoje,
      podeEnviar: false,
      motivo: `teto_diario:${enviadasHoje}`,
    };
  }
  return { enviadas7d, bloqueios7d, pctBloqueio, enviadasHoje, podeEnviar: true, motivo: 'ok' };
}
