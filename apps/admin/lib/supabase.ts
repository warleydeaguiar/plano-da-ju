import { createClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client para o painel admin.
 * É CRUCIAL que isso só seja importado de Server Components / Route Handlers,
 * NUNCA de componentes client.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
