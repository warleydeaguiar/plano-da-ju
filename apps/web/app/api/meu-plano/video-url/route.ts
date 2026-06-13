import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';

/**
 * POST /api/meu-plano/video-url
 * Body: { ext?: string }
 *
 * Gera uma URL ASSINADA de upload pra cliente subir o vídeo do cabelo DIRETO
 * pro Storage (sem passar pelo limite de ~4.5MB de corpo da serverless).
 * Retorna { path, token, publicUrl }. O client usa supabase.storage
 * .uploadToSignedUrl(path, token, file) e depois manda a publicUrl pro /photo.
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

    let ext = 'mp4';
    try {
      const body = await req.json();
      if (typeof body?.ext === 'string' && /^[a-z0-9]{2,5}$/i.test(body.ext)) ext = body.ext.toLowerCase();
    } catch { /* sem body, usa mp4 */ }

    const path = `${user.id}/video-${Date.now()}.${ext}`;
    const supabase = await createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.storage.from('hair-videos') as any).createSignedUploadUrl(path);
    if (error || !data?.token) {
      return NextResponse.json({ error: 'Não foi possível preparar o upload do vídeo' }, { status: 500 });
    }

    const publicUrl = supabase.storage.from('hair-videos').getPublicUrl(path).data.publicUrl;
    return NextResponse.json({ path, token: data.token, publicUrl });
  } catch {
    return NextResponse.json({ error: 'Erro ao preparar upload' }, { status: 500 });
  }
}
