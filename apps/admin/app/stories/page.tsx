import { createAdminClient } from '../../lib/supabase';
import Sidebar from '../components/Sidebar';
import StoriesClient from './StoriesClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Stories da Juliane — Admin' };

export default async function StoriesPage() {
  const sb = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stories } = await (sb as any)
    .from('juliane_stories')
    .select('*')
    .order('created_at', { ascending: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: views } = await (sb as any).from('story_views').select('story_id');
  const countsByStory: Record<string, number> = {};
  (views ?? []).forEach((v: { story_id: string }) => {
    countsByStory[v.story_id] = (countsByStory[v.story_id] ?? 0) + 1;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const decorated = (stories ?? []).map((s: any) => ({ ...s, view_count: countsByStory[s.id] ?? 0 }));

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: '#F5F5F7',
      fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
    }}>
      <Sidebar />
      <main style={{ marginLeft: 220, flex: 1, height: '100vh', overflowY: 'auto' }}>
        <StoriesClient initialStories={decorated} />
      </main>
    </div>
  );
}
