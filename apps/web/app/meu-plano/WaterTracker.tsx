'use client';

import { useEffect, useState, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { T, fonts } from './theme';

const CUP = 250; // ml por copo
const DEFAULT_GOAL = 2000;
const BLUE = '#2F80ED';
const BLUE_SOFT = '#E3F0FD';

function localDay(d: Date) {
  const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return x.toISOString().split('T')[0];
}

export default function WaterTracker() {
  const [goal, setGoal] = useState<number>(DEFAULT_GOAL);
  const [hasWeight, setHasWeight] = useState(true);
  const [ml, setMl] = useState(0);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }
    setToken(session.access_token);
    const uid = session.user.id;
    const [{ data: prof }, { data: evs }] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('profiles').select('water_goal_ml, weight_kg').eq('id', uid).maybeSingle(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('hair_events').select('quantity, occurred_at').eq('user_id', uid).eq('event_type', 'water').order('occurred_at', { ascending: false }).limit(60),
    ]);
    setGoal(prof?.water_goal_ml || DEFAULT_GOAL);
    setHasWeight(!!prof?.weight_kg);
    const todayKey = localDay(new Date());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const total = (evs ?? []).filter((e: any) => localDay(new Date(e.occurred_at)) === todayKey)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .reduce((s: number, e: any) => s + (Number(e.quantity) || 0), 0);
    setMl(total);
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function addWater(amount: number) {
    if (busy || !token) return;
    setBusy(true);
    setMl(m => Math.max(0, m + amount)); // otimista
    try {
      await fetch('/api/meu-plano/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ event_type: 'water', quantity: amount }),
      });
    } catch {
      setMl(m => Math.max(0, m - amount)); // reverte
    } finally { setBusy(false); }
  }

  const pct = Math.min(100, Math.round((ml / goal) * 100));
  const cups = Math.round(ml / CUP);
  const goalCups = Math.max(1, Math.round(goal / CUP));
  const reached = ml >= goal;

  return (
    <div style={{
      margin: '0 16px 12px', background: T.surface, borderRadius: 18, padding: 16,
      border: `1px solid ${T.borderSoft}`, boxShadow: '0 1px 3px rgba(42,30,44,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* Ring */}
        <div style={{
          width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
          background: `conic-gradient(${BLUE} ${pct * 3.6}deg, ${BLUE_SOFT} 0deg)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 50, height: 50, borderRadius: '50%', background: T.surface,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>💧</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>
            Água de hoje {reached ? '🎉' : ''}
          </div>
          <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 2 }}>
            {loading ? '…' : `${(ml / 1000).toFixed(1)}L de ${(goal / 1000).toFixed(1)}L`} · {cups}/{goalCups} copos
          </div>
          {/* barra */}
          <div style={{ height: 6, borderRadius: 99, background: BLUE_SOFT, marginTop: 8, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: BLUE, borderRadius: 99, transition: 'width 0.25s' }} />
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={() => addWater(CUP)} disabled={busy}
          style={{ flex: 1, padding: '10px 0', borderRadius: 11, border: `1px solid ${BLUE}`, background: BLUE_SOFT, color: BLUE, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: fonts.ui }}>
          + Copo (250ml)
        </button>
        <button onClick={() => addWater(500)} disabled={busy}
          style={{ flex: 1, padding: '10px 0', borderRadius: 11, border: `1px solid ${T.border}`, background: T.surface, color: T.ink, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: fonts.ui }}>
          + 500ml
        </button>
        {ml > 0 && (
          <button onClick={() => addWater(-CUP)} disabled={busy}
            style={{ width: 44, padding: '10px 0', borderRadius: 11, border: `1px solid ${T.border}`, background: T.surface, color: T.inkSoft, fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: fonts.ui }}>
            −
          </button>
        )}
      </div>
      {!hasWeight && !loading && (
        <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 8, lineHeight: 1.4 }}>
          Informe seu peso no perfil pra calcularmos sua meta ideal de água.
        </div>
      )}
    </div>
  );
}
