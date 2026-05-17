import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const anon = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } },
    );
    const { data: { user } } = await anon.auth.getUser(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { story_id, completed } = await req.json();
    if (!story_id) return NextResponse.json({ error: 'story_id required' }, { status: 400 });

    const supabase = await createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('story_views') as any).upsert({
      user_id: user.id,
      story_id,
      viewed_at: new Date().toISOString(),
      completed: !!completed,
    }, { onConflict: 'user_id,story_id' });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[stories/view]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
