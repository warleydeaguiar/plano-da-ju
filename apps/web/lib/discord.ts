// Discord webhook helper — sends rich embeds to a configured channel
// Never throws; logs errors and returns silently so callers can fire-and-forget.

const WEBHOOK = process.env.DISCORD_SALES_WEBHOOK ?? '';

type DiscordEmbed = {
  title?: string;
  description?: string;
  color?: number;          // decimal color
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  timestamp?: string;      // ISO
  footer?: { text: string };
  thumbnail?: { url: string };
};

export async function sendDiscord(embeds: DiscordEmbed[], content?: string): Promise<void> {
  if (!WEBHOOK) {
    console.warn('[discord] DISCORD_SALES_WEBHOOK not set, skipping');
    return;
  }
  try {
    const res = await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Plano da Ju',
        content,
        embeds,
      }),
    });
    if (!res.ok) {
      console.error('[discord] webhook failed', res.status, await res.text().catch(() => ''));
    }
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

  await sendDiscord([{
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
