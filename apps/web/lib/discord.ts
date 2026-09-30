// Discord webhook helper — sends rich embeds to a configured channel.
// Never throws; logs errors and returns silently so callers can fire-and-forget.
//
// O webhook de cada notificação vem da tabela `wg_notif_discord` (editável em
// /admin/notificacoes) — o env var abaixo é só o FALLBACK de quando a linha
// não existe ou está sem `webhook_url` preenchido. Migração 036.
import { createServiceClient } from '@/lib/supabase/server';

const FALLBACK_SALES_WEBHOOK = process.env.DISCORD_SALES_WEBHOOK ?? '';

type CacheEntrada = { ate: number; url: string; ativo: boolean };
const cache = new Map<string, CacheEntrada>();
const CACHE_MS = 30_000;

/**
 * Resolve o webhook e o estado (ligado/desligado) de uma notificação pela
 * chave em `wg_notif_discord`. Sem linha no banco, cai pro fallback — sempre
 * ativo, pra não silenciar um alerta que ninguém configurou ainda.
 */
async function resolveNotificacao(
  chave: string,
  envFallback: string,
): Promise<{ url: string; ativo: boolean }> {
  const guardado = cache.get(chave);
  if (guardado && guardado.ate > Date.now()) return guardado;

  let url = envFallback;
  let ativo = true;
  try {
    const sb = await createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (sb.from('wg_notif_discord') as any)
      .select('webhook_url, ativo')
      .eq('chave', chave)
      .maybeSingle();
    if (data) {
      ativo = data.ativo !== false;
      if (data.webhook_url) url = data.webhook_url;
    }
  } catch {
    // Banco fora do ar: segue com o fallback em vez de perder o alerta.
  }

  const entrada = { ate: Date.now() + CACHE_MS, url, ativo };
  cache.set(chave, entrada);
  return entrada;
}

async function marcarEnviado(chave: string): Promise<void> {
  try {
    const sb = await createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb.from('wg_notif_discord') as any)
      .update({ last_sent_at: new Date().toISOString() })
      .eq('chave', chave);
  } catch { /* não crítico */ }
}

type DiscordEmbed = {
  title?: string;
  description?: string;
  color?: number;          // decimal color
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  timestamp?: string;      // ISO
  footer?: { text: string };
  thumbnail?: { url: string };
};

/**
 * Envia embeds ao Discord para a notificação `chave` (ver wg_notif_discord).
 * Desligada no painel → não envia (silencioso, não é erro).
 */
export async function sendDiscordFor(
  chave: string,
  envFallback: string,
  embeds: DiscordEmbed[],
  content?: string,
): Promise<void> {
  const { url, ativo } = await resolveNotificacao(chave, envFallback);
  if (!ativo) return;
  if (!url) {
    console.warn(`[discord] sem webhook para "${chave}" (nem no banco, nem no env), pulando`);
    return;
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Plano da Ju', content, embeds }),
    });
    if (!res.ok) {
      console.error('[discord] webhook failed', res.status, await res.text().catch(() => ''));
      return;
    }
    void marcarEnviado(chave);
  } catch (err) {
    console.error('[discord] error', err);
  }
}

// ─── High-level events ──────────────────────────────────────────────
export type SaleData = {
  customerName: string | null;
  email: string;
  hairType: string | null;
  porosity: string | null;
  mainProblem: string | null;
  paymentMethod: 'pix' | 'card';
  amountCents: number;
};

export async function notifyNewSale(sale: SaleData): Promise<void> {
  const valueBr = `R$ ${(sale.amountCents / 100).toFixed(2).replace('.', ',')}`;
  const hairLine = [sale.hairType, sale.porosity ? `${sale.porosity} porosidade` : null]
    .filter(Boolean).join(' · ') || '—';

  await sendDiscordFor('venda', FALLBACK_SALES_WEBHOOK, [{
    title: '💰 Nova venda — Plano Capilar',
    color: 0xEC4899, // pink to match the brand
    fields: [
      { name: '👤 Cliente',         value: sale.customerName ?? '—', inline: false },
      { name: '📧 Email',           value: sale.email, inline: false },
      { name: '💇‍♀️ Tipo de cabelo', value: hairLine, inline: true },
      { name: '🎯 Objetivo',         value: sale.mainProblem ?? '—', inline: true },
      { name: '💳 Pagamento',       value: sale.paymentMethod === 'pix' ? 'PIX' : 'Cartão', inline: true },
      { name: '💵 Valor',           value: valueBr, inline: true },
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'Plano da Ju' },
  }]);
}
