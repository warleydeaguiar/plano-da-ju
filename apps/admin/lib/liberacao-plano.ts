/**
 * Mesma regra de `apps/web/lib/liberacao-plano.ts` — os dois apps são
 * separados, então a regra existe duas vezes. Mudou lá, muda aqui.
 *
 * Contrato de `plan_released_at`:
 *   null            → retido, esperando alguém clicar em "Liberar plano";
 *   data no futuro  → abre sozinho naquela hora (só cortesia usa isso);
 *   data no passado → aberto.
 */
export interface PerfilLiberacao {
  subscription_type?: string | null
  is_gift?: boolean | null
  plan_released_at?: string | null
}

export function ehAcessoGratuito(perfil: PerfilLiberacao): boolean {
  return perfil?.subscription_type === 'parceria' || perfil?.is_gift === true
}

export function planoVisivel(perfil: PerfilLiberacao, agora = Date.now()): boolean {
  const bruto = perfil?.plan_released_at
  if (!bruto) return ehAcessoGratuito(perfil)
  const quando = new Date(bruto).getTime()
  return Number.isFinite(quando) ? quando <= agora : ehAcessoGratuito(perfil)
}
