const BASE_URL = 'https://api.pagar.me/core/v5';

function headers() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Basic ${Buffer.from(process.env.PAGARME_SECRET_KEY + ':').toString('base64')}`,
  };
}

/**
 * Estorna (devolve o dinheiro de) uma cobrança paga. No Pagar.me v5 o estorno
 * é feito cancelando a charge: DELETE /charges/{id}. Vale pra cartão e PIX
 * (dentro da janela permitida). Sem `amount` = estorno total.
 */
export async function pagarmeRefundCharge(
  chargeId: string,
  amountCents?: number,
): Promise<{ ok: boolean; error?: string; status?: number }> {
  try {
    const res = await fetch(`${BASE_URL}/charges/${chargeId}`, {
      method: 'DELETE',
      headers: headers(),
      body: amountCents && amountCents > 0 ? JSON.stringify({ amount: amountCents }) : undefined,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { ok: false, status: res.status, error: `PagarMe ${res.status}: ${txt.slice(0, 240)}` };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' };
  }
}

export async function pagarmeCancelSubscription(subId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/subscriptions/${subId}`, {
      method: 'DELETE',
      headers: headers(),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { ok: false, error: `PagarMe ${res.status}: ${txt.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' };
  }
}
