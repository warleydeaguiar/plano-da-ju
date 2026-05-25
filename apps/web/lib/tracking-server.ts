/**
 * tracking-server — lê a identidade de tracking persistida (tracking_identity)
 * para enriquecer o Advanced Matching de eventos server-side.
 *
 * Usado no Purchase (webhook PagarMe e polling do PIX): junta os sinais de match
 * mais fortes (fbp/fbc/ip/user_agent/zip/cpf) que foram capturados durante a
 * navegação — algo que o evento server-side não teria de outra forma (o webhook
 * roda sem contexto de navegador).
 *
 * Lookup por session_id (= profile.checkout_session_id) com fallback de
 * re-hidratação por email (índice em tracking_identity.email).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any;

export interface TrackingMatch {
  fbp?: string;
  fbc?: string;
  ip?: string;
  userAgent?: string;
  zip?: string;
  cpf?: string;
  email?: string;
  phone?: string;
}

const COLS = 'fbp, fbc, ip, user_agent, zip, cpf, email, phone';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(row: any | null): TrackingMatch {
  if (!row) return {};
  // ip pode ter sido gravado como 'unknown' (sem x-forwarded-for) — descarta.
  const ip = row.ip && row.ip !== 'unknown' ? row.ip : undefined;
  // phone: garante DDI 55 (Brasil) p/ o match do Meta funcionar.
  const phoneDigits = String(row.phone ?? '').replace(/\D/g, '');
  const phone = phoneDigits
    ? (phoneDigits.length === 10 || phoneDigits.length === 11 ? '55' + phoneDigits : phoneDigits)
    : undefined;
  return {
    fbp: row.fbp ?? undefined,
    fbc: row.fbc ?? undefined,
    ip,
    userAgent: row.user_agent ?? undefined,
    zip: row.zip ?? undefined,
    cpf: row.cpf ?? undefined,
    email: row.email ?? undefined,
    phone,
  };
}

export async function getTrackingIdentity(
  sb: Sb,
  opts: { sessionId?: string | null; email?: string | null },
): Promise<TrackingMatch> {
  try {
    if (opts.sessionId) {
      const { data } = await sb
        .from('tracking_identity')
        .select(COLS)
        .eq('session_id', opts.sessionId)
        .maybeSingle();
      if (data) return normalize(data);
    }
    if (opts.email) {
      const { data } = await sb
        .from('tracking_identity')
        .select(COLS)
        .eq('email', opts.email.toLowerCase())
        .order('last_seen_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) return normalize(data);
    }
  } catch (err) {
    console.error('[tracking-server] lookup falhou:', err);
  }
  return {};
}
