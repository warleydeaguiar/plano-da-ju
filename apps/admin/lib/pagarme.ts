const BASE_URL = 'https://api.pagar.me/core/v5';

function headers() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Basic ${Buffer.from(process.env.PAGARME_SECRET_KEY + ':').toString('base64')}`,
  };
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
