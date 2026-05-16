// Rate limiting in-memory (suficiente para single-instance Vercel serverless).
// Para multi-region: migrar para Upstash Redis com SLIDING_WINDOW.
//
// Uso:
//   const ok = await checkRateLimit(`pix:${ip}`, { max: 5, windowMs: 60_000 });
//   if (!ok) return 429;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Limpa buckets expirados periodicamente para não vazar memória
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k);
  }
}, 60_000).unref?.();

export function checkRateLimit(
  key: string,
  opts: { max: number; windowMs: number },
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + opts.windowMs };
    buckets.set(key, bucket);
  }

  bucket.count++;
  const allowed = bucket.count <= opts.max;
  return {
    allowed,
    remaining: Math.max(0, opts.max - bucket.count),
    resetAt: bucket.resetAt,
  };
}

// Extrai IP do request (Vercel envia x-forwarded-for)
export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  return 'unknown';
}
