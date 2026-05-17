import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';

// GET — returns the list of unseen stories matching the user's profile,
// ranked by priority. Falls back to "any" stories when no specific match.
export async function GET(req: NextRequest) {
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

    const supabase = await createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase.from('profiles') as any)
      .select('hair_type,porosity,chemical_history,main_problems,plan_released_at,plan_status')
      .eq('id', user.id).single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: viewed } = await (supabase.from('story_views') as any)
      .select('story_id').eq('user_id', user.id);
    const seenIds = new Set((viewed ?? []).map((v: { story_id: string }) => v.story_id));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: stories } = await (supabase.from('juliane_stories') as any)
      .select('*')
      .eq('active', true)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    const daysSincePlan = profile?.plan_released_at
      ? Math.floor((Date.now() - new Date(profile.plan_released_at).getTime()) / 86_400_000)
      : 0;

    type Story = {
      id: string;
      target_hair_types: string[];
      target_problems: string[];
      target_porosity: string[];
      target_chemicals: string[];
      trigger_phase: string;
      trigger_day_min: number;
      trigger_day_max: number | null;
    };

    const userHair  = (profile?.hair_type ?? '').toLowerCase();
    const userPoros = (profile?.porosity ?? '').toLowerCase();
    const userChem  = (profile?.chemical_history ?? '').toLowerCase();
    const userProbs = (profile?.main_problems ?? []).map((p: string) => p.toLowerCase());

    const matches = (stories as Story[] ?? [])
      .filter(s => !seenIds.has(s.id))
      .filter(s => {
        // Hair type filter — if list is set, user must match
        if (s.target_hair_types.length > 0 && userHair &&
            !s.target_hair_types.some(t => userHair.includes(t.toLowerCase()))) return false;
        if (s.target_porosity.length > 0 && userPoros &&
            !s.target_porosity.some(t => userPoros.includes(t.toLowerCase()))) return false;
        if (s.target_chemicals.length > 0 && userChem &&
            !s.target_chemicals.some(t => userChem.includes(t.toLowerCase()))) return false;
        if (s.target_problems.length > 0 &&
            !s.target_problems.some(t => userProbs.includes(t.toLowerCase()))) return false;

        // Phase / day window
        if (s.trigger_phase === 'plan_delivery' && profile?.plan_status !== 'ready') return false;
        if (s.trigger_day_min > daysSincePlan) return false;
        if (s.trigger_day_max != null && s.trigger_day_max < daysSincePlan) return false;

        return true;
      })
      .slice(0, 10);

    return NextResponse.json({ stories: matches });
  } catch (err) {
    console.error('[meu-plano/stories GET]', err);
    return NextResponse.json({ stories: [] });
  }
}
