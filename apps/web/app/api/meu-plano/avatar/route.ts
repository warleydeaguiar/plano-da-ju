import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';

/**
 * POST /api/meu-plano/avatar
 * Body: multipart com `photo` (foto de perfil)
 * Faz upload no bucket hair-photos/avatars/{user_id}.ext e atualiza profiles.avatar_url
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

    const form = await req.formData();
    const file = form.get('photo');
    if (!file || typeof file === 'string') return NextResponse.json({ error: 'Foto não enviada' }, { status: 400 });

    const f = file as File;
    if (f.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'Foto muito grande (máx. 5 MB)' }, { status: 400 });
    if (!f.type.startsWith('image/')) return NextResponse.json({ error: 'Arquivo precisa ser uma imagem' }, { status: 400 });

    const supabase = await createServiceClient();
    const ext = f.type === 'image/png' ? 'png' : f.type === 'image/webp' ? 'webp' : 'jpg';
    // Caminho fixo por usuário com timestamp — upsert sobrescreve a anterior
    const fileName = `avatars/${user.id}.${ext}`;

    const buffer = new Uint8Array(await f.arrayBuffer());
    const { error: upErr } = await supabase.storage.from('hair-photos').upload(fileName, buffer, {
      contentType: f.type,
      upsert: true,
    });
    if (upErr) {
      console.error('[avatar] upload error', upErr);
      return NextResponse.json({ error: 'Falha ao salvar foto' }, { status: 500 });
    }

    const { data: pub } = supabase.storage.from('hair-photos').getPublicUrl(fileName);
    // Adiciona ?t={timestamp} pra cachebust quando atualiza
    const avatarUrl = `${pub.publicUrl}?t=${Date.now()}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('profiles') as any)
      .update({ avatar_url: avatarUrl })
      .eq('id', user.id);

    return NextResponse.json({ ok: true, avatar_url: avatarUrl });
  } catch (err) {
    console.error('[avatar POST]', err);
    return NextResponse.json({ error: 'Erro inesperado' }, { status: 500 });
  }
}

/**
 * PATCH /api/meu-plano/avatar
 * Body: { full_name?: string }
 * Atualiza informações simples do perfil (nome).
 */
export async function PATCH(req: NextRequest) {
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

    const body = await req.json();
    const full_name = typeof body.full_name === 'string' ? body.full_name.trim().slice(0, 120) : null;

    const supabase = await createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = {};
    if (full_name) updates.full_name = full_name;
    // Peso → recalcula meta de água (35ml × kg, arredondado a 50ml)
    if (body.weight_kg !== undefined) {
      const w = parseFloat(String(body.weight_kg).replace(',', '.'));
      if (!isNaN(w) && w >= 30 && w <= 300) {
        updates.weight_kg = w;
        updates.water_goal_ml = Math.round((w * 35) / 50) * 50;
      }
    }
    if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('profiles') as any).update(updates).eq('id', user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[avatar PATCH]', err);
    return NextResponse.json({ error: 'Erro inesperado' }, { status: 500 });
  }
}
