import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/track/identity
 *
 * Persiste/enriquece a identidade de tracking de uma sessão (fbp, fbc, UTMs,
 * geo, IP, UA + PII quando conhecida). Faz MERGE: nunca apaga um valor já
 * conhecido (ex: email) com null. Alimenta o Advanced Matching de todos os
 * eventos do funil (inclusive Purchase via webhook e re-hidratação de retorno).
 *
 * Body: { session_id, fbp?, fbc?, fbclid?, utm_*?, landing_url?, referrer?,
 *         email?, phone?, cpf? }
 * IP / User-Agent / geo são capturados no servidor (mais confiável).
 */

// Campos que o cliente pode enviar (lista branca)
const CLIENT_FIELDS = [
  'fbp', 'fbc', 'fbclid',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'landing_url', 'referrer',
  'email', 'phone', 'cpf',
] as const;

function clean(v: unknown, max = 500): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const session_id = clean(body.session_id, 64);
    if (!session_id) {
      return NextResponse.json({ ok: false, error: 'session_id obrigatório' }, { status: 400 });
    }

    // Dados do servidor (mais confiáveis que o cliente)
    const ipRaw = getClientIp(req);
    const ip = ipRaw && ipRaw !== 'unknown' ? ipRaw : null;
    const user_agent = req.headers.get('user-agent')?.slice(0, 500) ?? null;
    const geo_country = req.headers.get('x-vercel-ip-country') ?? null;
    const geo_region  = req.headers.get('x-vercel-ip-country-region') ?? null;
    const geo_city    = req.headers.get('x-vercel-ip-city')
      ? decodeURIComponent(req.headers.get('x-vercel-ip-city')!)
      : null;

    // Campos vindos do cliente (só os não-vazios)
    const incoming: Record<string, string | null> = {};
    for (const f of CLIENT_FIELDS) {
      const val = clean(body[f]);
      if (val !== null) incoming[f] = val;
    }
    // Normaliza email/phone
    if (incoming.email) incoming.email = incoming.email.toLowerCase();
    if (incoming.phone) incoming.phone = incoming.phone.replace(/\D/g, '');
    if (incoming.cpf)   incoming.cpf = incoming.cpf.replace(/\D/g, '');

    const sb = await createServiceClient();

    // MERGE: busca existente, mescla preservando o que já é conhecido
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (sb.from('tracking_identity') as any)
      .select('*')
      .eq('session_id', session_id)
      .maybeSingle();

    const row: Record<string, unknown> = {
      session_id,
      ...incoming,
      // server-side: atualiza sempre (mais recente é melhor)
      ip, user_agent, geo_country, geo_region, geo_city,
    };

    if (existing) {
      // Não sobrescrever PII conhecida com null/ausente (já garantido: só mando não-nulos)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (sb.from('tracking_identity') as any).update(row).eq('session_id', session_id);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (sb.from('tracking_identity') as any).insert(row);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[track/identity]', err);
    // Nunca quebra o cliente — tracking é best-effort
    return NextResponse.json({ ok: true });
  }
}
