import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';

/**
 * POST /api/meu-plano/photo-url
 * Body: { slots?: string[] }  (ex.: ["front","back","root"] — default os três)
 *
 * Gera URLs ASSINADAS pra cliente subir as fotos DIRETO pro Storage, sem passar
 * pelo limite de ~4,5MB de corpo da serverless (era a causa do erro "Request
 * Entity Too Large" / "Unexpected token R ... is not valid JSON" no onboarding).
 * Retorna { uploads: { slot, path, token, publicUrl }[] }. O client usa
 * supabase.storage.from('hair-photos').uploadToSignedUrl(path, token, file) e
 * depois manda as publicUrls (JSON pequeno) pro /api/meu-plano/photo.
 */
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const anon = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } },
    );
    const { data: { user } } = await anon.auth.getUser(token);
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    let slots: string[] = ['front', 'back', 'root'];
    try {
      const body = await req.json();
      if (Array.isArray(body?.slots) && body.slots.length) {
        slots = body.slots.filter((s: unknown) => ['front', 'back', 'root'].includes(s as string));
      }
    } catch { /* sem body → usa os três */ }
    if (!slots.length) slots = ['front'];

    const supabase = await createServiceClient();
    const suffix: Record<string, string> = { front: '', back: '-costas', root: '-raiz' };
    const uploads: Array<{ slot: string; path: string; token: string; publicUrl: string }> = [];
    for (const slot of slots) {
      const path = `${user.id}/${Date.now()}${suffix[slot] ?? ''}-${Math.round(performance.now())}.jpg`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.storage.from('hair-photos') as any).createSignedUploadUrl(path);
      if (error || !data?.token) {
        return NextResponse.json({ error: 'Não foi possível preparar o upload das fotos' }, { status: 500 });
      }
      const publicUrl = supabase.storage.from('hair-photos').getPublicUrl(path).data.publicUrl;
      uploads.push({ slot, path, token: data.token, publicUrl });
    }

    return NextResponse.json({ uploads });
  } catch {
    return NextResponse.json({ error: 'Erro ao preparar upload' }, { status: 500 });
  }
}
