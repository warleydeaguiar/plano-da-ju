// Resolução de webhook Discord por notificação — mesma tabela usada em /admin/notificacoes.
// O env var de cada rota vira só FALLBACK: banco tem prioridade. Migração 036.
import { createAdminClient } from './supabase';

type CacheEntrada = { ate: number; url: string; ativo: boolean };
const cache = new Map<string, CacheEntrada>();
const CACHE_MS = 30_000;

export async function resolveNotificacaoDiscord(
  chave: string,
  envFallback: string,
): Promise<{ url: string; ativo: boolean }> {
  const guardado = cache.get(chave);
  if (guardado && guardado.ate > Date.now()) return guardado;

  let url = envFallback;
  let ativo = true;
  try {
    const sb = createAdminClient();
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

export async function marcarNotificacaoEnviada(chave: string): Promise<void> {
  try {
    const sb = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb.from('wg_notif_discord') as any)
      .update({ last_sent_at: new Date().toISOString() })
      .eq('chave', chave);
  } catch { /* não crítico */ }
}
