/**
 * Resolve (or create) the auth user ID for a given email.
 *
 * The profiles table has FK profiles.id -> auth.users.id. Inserting a
 * profile with a random UUID causes "violates foreign key constraint"
 * (Postgres 23503). This helper guarantees we always have a valid
 * auth.users.id before touching profiles.
 *
 * Flow:
 *  1. Try admin.createUser with a random temporary password (email_confirm:true).
 *  2. If user already exists, look them up via the admin REST endpoint.
 *  3. Return the canonical auth.users.id.
 *
 * After payment confirmation, the user sets their real password through
 * /api/auth/set-password.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export async function resolveAuthUserId(
  supabaseService: SupabaseClient,
  email: string,
): Promise<string> {
  const tempPassword = `tmp_${crypto.randomUUID()}`;

  // Try to create
  const { data, error } = await supabaseService.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });

  if (data?.user?.id) return data.user.id;

  if (!error) {
    throw new Error('Auth user creation returned no user and no error');
  }

  // Already exists — look up via admin endpoint
  const isAlreadyExists =
    error.message?.toLowerCase().includes('already') ||
    error.message?.toLowerCase().includes('exists') ||
    error.message?.toLowerCase().includes('registered') ||
    error.message?.toLowerCase().includes('duplicate');

  if (!isAlreadyExists) {
    throw error;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const res = await fetch(
    `${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
    {
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
    },
  );
  const json = await res.json();
  const existing = json.users?.[0];
  if (!existing?.id) {
    throw new Error(`Could not find existing auth user for ${email}`);
  }
  return existing.id;
}
