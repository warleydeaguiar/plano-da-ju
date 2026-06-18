// Log de cada disparo do CAPI → tabela capi_event_log (self-hosted).
// Best-effort: NUNCA lança, NUNCA bloqueia o fluxo do cliente.
// Alimenta o painel de "Sinal de Compra" no admin (/anuncios) e o índice
// de correspondência (proxy da Event Match Quality da Meta).

import { createServiceClient } from '@/lib/supabase/server';

export interface CapiLogRow {
  event_name: string;
  status: 'sent' | 'error' | 'skipped';
  has_email: boolean;
  has_phone: boolean;
  has_fbc: boolean;
  has_fbp: boolean;
  has_ip: boolean;
  has_ua: boolean;
  has_cpf: boolean;
  value?: number;
  source_url?: string;
  error_msg?: string;
}

export async function logCapiEvent(row: CapiLogRow): Promise<void> {
  try {
    const fields_count =
      (row.has_email ? 1 : 0) + (row.has_phone ? 1 : 0) + (row.has_fbc ? 1 : 0) +
      (row.has_fbp ? 1 : 0) + (row.has_ip ? 1 : 0) + (row.has_ua ? 1 : 0) +
      (row.has_cpf ? 1 : 0);
    const sb = await createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb.from('capi_event_log') as any).insert({
      event_name: row.event_name,
      status: row.status,
      fields_count,
      has_email: row.has_email,
      has_phone: row.has_phone,
      has_fbc: row.has_fbc,
      has_fbp: row.has_fbp,
      has_ip: row.has_ip,
      has_ua: row.has_ua,
      has_cpf: row.has_cpf,
      value: typeof row.value === 'number' ? row.value : null,
      source_url: row.source_url ?? null,
      error_msg: row.error_msg ?? null,
    });
  } catch {
    // silencioso — monitoramento nunca pode derrubar o tracking
  }
}
