'use client';

import { useEffect, useState, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { T, fonts, gradient } from './theme';

function localDay(d: Date) {
  const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return x.toISOString().split('T')[0];
}

export default function TodayTasks() {
  const [tasks, setTasks] = useState<string[]>([]);
  const [week, setWeek] = useState(0);
  const [doneMap, setDoneMap] = useState<Record<string, string>>({}); // task -> event_id
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }
    setToken(session.access_token);
    const uid = session.user.id;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: prof } = await (supabase as any).from('profiles')
      .select('subscription_activated_at, plan_requested_at, created_at, plan_status').eq('id', uid).maybeSingle();
    if (!prof || prof.plan_status === 'pending_photo') { setLoading(false); return; }

    const startIso = prof.subscription_activated_at || prof.plan_requested_at || prof.created_at;
    const start = startIso ? new Date(startIso).getTime() : Date.now();
    const w = Math.min(12, Math.max(1, Math.floor((Date.now() - start) / (7 * 86400000)) + 1));
    setWeek(w);

    const [{ data: plan }, { data: evs }] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('hair_plans').select('tasks').eq('user_id', uid).eq('week_number', w).maybeSingle(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('hair_events').select('id, notes, occurred_at').eq('user_id', uid).eq('event_type', 'plan_task').order('occurred_at', { ascending: false }).limit(60),
    ]);
    const t: string[] = Array.isArray(plan?.tasks) ? plan.tasks.slice(0, 6) : [];
    setTasks(t);
    const today = localDay(new Date());
    const map: Record<string, string> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const e of (evs ?? []) as any[]) {
      if (e.notes && localDay(new Date(e.occurred_at)) === today && !map[e.notes]) map[e.notes] = e.id;
    }
    setDoneMap(map);
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggle(task: string) {
    if (busy || !token) return;
    setBusy(task);
    const doneId = doneMap[task];
    try {
      if (doneId) {
        await fetch('/api/meu-plano/event', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ event_id: doneId }),
        });
        setDoneMap(m => { const n = { ...m }; delete n[task]; return n; });
      } else {
        const r = await fetch('/api/meu-plano/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ event_type: 'plan_task', notes: task }),
        });
        const d = await r.json().catch(() => ({}));
        setDoneMap(m => ({ ...m, [task]: d.id ?? 'tmp' }));
      }
    } catch { /* noop */ } finally { setBusy(null); }
  }

  if (loading || tasks.length === 0) return null;

  const doneCount = tasks.filter(t => doneMap[t]).length;

  return (
    <div style={{ margin: '0 16px 12px', background: T.surface, borderRadius: 18, padding: 16, border: `1px solid ${T.borderSoft}`, boxShadow: '0 1px 3px rgba(42,30,44,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>💛 O que a Ju pediu hoje</div>
        <div style={{ fontSize: 11.5, color: T.inkMuted }}>Semana {week} · {doneCount}/{tasks.length}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tasks.map(task => {
          const done = !!doneMap[task];
          return (
            <button key={task} onClick={() => toggle(task)} disabled={busy === task}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                padding: '11px 12px', borderRadius: 12, cursor: 'pointer', fontFamily: fonts.ui,
                border: `1.5px solid ${done ? T.pink : T.border}`,
                background: done ? T.pinkSoft : T.surface,
              }}>
              <span style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? gradient.heroSoft : 'transparent',
                border: done ? 'none' : `1.5px solid ${T.border}`,
                color: '#fff', fontSize: 13, fontWeight: 700,
              }}>{done ? '✓' : ''}</span>
              <span style={{
                fontSize: 13.5, color: T.ink, lineHeight: 1.35,
                textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.6 : 1,
              }}>{task}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
