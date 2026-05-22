const BASE_URL = 'https://api.pagar.me/core/v5';

const headers = () => ({
  'Content-Type': 'application/json',
  Authorization: `Basic ${Buffer.from(process.env.PAGARME_SECRET_KEY + ':').toString('base64')}`,
});

// Erro rico — preserva o status e o objeto `errors` (detalhe campo a campo)
// que a PagarMe devolve no 422. Sem isso só sobra "The request is invalid."
export class PagarMeError extends Error {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: any;
  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = 'PagarMeError';
    this.status = status;
    this.details = details;
  }
}

// Achata o objeto errors da PagarMe ({ "campo": ["msg1","msg2"] }) numa string legível.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function flattenErrors(errors: any): string {
  if (!errors) return '';
  if (typeof errors === 'string') return errors;
  if (Array.isArray(errors)) return errors.join('; ');
  try {
    return Object.entries(errors)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join(' | ');
  } catch {
    return JSON.stringify(errors);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = flattenErrors(data.errors);
    const msg = detail
      ? `${data.message ?? `PagarMe ${res.status}`} — ${detail}`
      : (data.message ?? `PagarMe error ${res.status}`);
    throw new PagarMeError(msg, res.status, data.errors ?? data);
  }
  return data as T;
}

export const pagarme = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
};
