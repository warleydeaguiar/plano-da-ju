import { createServiceClient } from '@/lib/supabase/server';

/**
 * Log de erro de servidor RICO e PERSISTENTE (tabela app_errors).
 *
 * Por que existe: a maioria das rotas só fazia `console.error` → some nos logs
 * efêmeros da Vercel e a equipe nunca enxerga. Ex.: /api/plan/generate falhava
 * em silêncio e deixava clientes pagantes com o plano travado em "processing"
 * sem ninguém saber. Aqui gravamos rota, mensagem, STACK e contexto pra
 * diagnosticar de verdade.
 *
 * Fire-and-forget: NUNCA lança (não pode mascarar/derrubar o fluxo original).
 */
export async function logServerError(input: {
  route: string;                       // ex: 'plan/generate', 'meu-plano/photo'
  err: unknown;                        // o erro capturado
  email?: string | null;
  severity?: 'error' | 'warning' | 'critical';
  context?: Record<string, unknown>;   // ids, payload resumido, etc.
}): Promise<void> {
  try {
    const { route, err, email, context } = input;
    const severity = input.severity ?? 'error';
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? (err.stack ?? null) : null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extra: any = {};
    // PagarMe e fetch-like errors carregam status/details — preserva se houver
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyErr = err as any;
    if (anyErr?.status) extra.status = anyErr.status;
    if (anyErr?.details) extra.details = anyErr.details;

    // Sempre loga no console também (útil no tail da Vercel em tempo real)
    console.error(`[${route}]`, message, context ?? '');

    const supabase = await createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('app_errors') as any).insert({
      route,
      severity,
      message: message?.slice(0, 2000) ?? null,
      stack: stack?.slice(0, 6000) ?? null,
      email: email ?? null,
      context: { ...(context ?? {}), ...extra, at: new Date().toISOString() },
    });
  } catch (logErr) {
    console.error('[server-log] falha ao gravar app_errors:', logErr);
  }
}
