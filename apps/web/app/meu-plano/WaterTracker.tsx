'use client';

import { useEffect, useState, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { T, fonts } from './theme';

const BLUE = '#2F80ED';
const BLUE_SOFT = '#E3F0FD';
const GRAY = '#D8DEE6';
const DEFAULT_GOAL = 2000;
const DEFAULT_CUPS = 4; // padrão: copos de 500ml (2000 / 4)

function localDay(d: Date) {
  const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return x.toISOString().split('T')[0];
}
function cupLabel(ml: number) {
  return ml >= 1000 ? `${(ml / 1000).toFixed(1)}L` : `${ml}ml`;
}

function Cup({ state, onClick }: { state: 'full' | 'next' | 'empty'; onClick?: () => void }) {
  const stroke = state === 'empty' ? GRAY : BLUE;
  const fill = state === 'full' ? BLUE : state === 'next' ? BLUE_SOFT : 'transparent';
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      style={{ background: 'none', border: 'none', padding: 0, cursor: onClick ? 'pointer' : 'default', lineHeight: 0 }}
      aria-label={state === 'next' ? 'Adicionar copo' : 'Copo'}
    >
      <svg width="46" height="56" viewBox="0 0 46 56">
        <path
          d="M8 4 L38 4 L34 52 L12 52 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeDasharray={state === 'next' ? '5 4' : undefined}
        />
        {state === 'next' && (
          <text x="23" y="32" textAnchor="middle" fontSize="20" fill={BLUE} fontWeight="700">+</text>
        )}
        {state === 'full' && (
          <path d="M16 28 L21 34 L31 21" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
    </button>
  );
}

export default function WaterTracker() {
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [cupMl, setCupMl] = useState(0);
  const [ml, setMl] = useState(0);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftGoalL, setDraftGoalL] = useState('');
  const [draftCups, setDraftCups] = useState('');

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
      (supabase as any).from('profiles').select('water_goal_ml, water_cup_ml').eq('id', uid).maybeSingle(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('hair_events').select('quantity, occurred_at').eq('user_id', uid).eq('event_type', 'water').order('occurred_at', { ascending: false }).limit(80),
    ]);
    const g = prof?.water_goal_ml || DEFAULT_GOAL;
    setGoal(g);
    setCupMl(prof?.water_cup_ml || Math.max(100, Math.round(g / DEFAULT_CUPS / 50) * 50));
    const todayKey = localDay(new Date());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const total = (evs ?? []).filter((e: any) => localDay(new Date(e.occurred_at)) === todayKey)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .reduce((s: number, e: any) => s + (Number(e.quantity) || 0), 0);
    setMl(Math.max(0, total));
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function addWater(amount: number) {
    if (busy || !token || amount === 0) return;
    setBusy(true);
    setMl(m => Math.max(0, m + amount));
    try {
      await fetch('/api/meu-plano/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ event_type: 'water', quantity: amount }),
      });
    } catch {
      setMl(m => Math.max(0, m - amount));
    } finally { setBusy(false); }
  }

  function openEdit() {
    setDraftGoalL((goal / 1000).toString());
    setDraftCups(String(Math.max(1, Math.round(goal / (cupMl || 1)))));
    setEditing(true);
  }
  async function saveEdit() {
    const gL = parseFloat(draftGoalL.replace(',', '.'));
    const cups = parseInt(draftCups, 10);
    if (isNaN(gL) || gL < 0.5 || gL > 8 || isNaN(cups) || cups < 1 || cups > 20) { setEditing(false); return; }
    const goalMl = Math.round(gL * 1000);
    const newCup = Math.max(100, Math.round(goalMl / cups));
    setGoal(goalMl); setCupMl(newCup); setEditing(false);
    try {
      await fetch('/api/meu-plano/avatar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ water_goal_ml: goalMl, water_cup_ml: newCup }),
      });
    } catch { /* noop */ }
  }

  const cup = cupMl || Math.round(goal / DEFAULT_CUPS);
  const count = Math.min(20, Math.max(1, Math.round(goal / cup)));
  const filled = Math.min(count, Math.floor(ml / cup));
  const reached = ml >= goal;

  return (
    <div style={{
      margin: '0 16px 12px', background: T.surface, borderRadius: 20, padding: 18,
      border: `1px solid ${T.borderSoft}`, boxShadow: '0 1px 3px rgba(42,30,44,0.06)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft, letterSpacing: 2, textTransform: 'uppercase' }}>Água</div>
          <button onClick={openEdit} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: reached ? T.green : BLUE, fontFamily: fonts.display }}>
              {ml >= 1000 ? `${(ml / 1000).toFixed(1)}L` : `${ml}ml`}
            </span>
            <span style={{ fontSize: 15, color: T.inkSoft }}>de {(goal / 1000).toFixed(1)}L ✎</span>
          </button>
        </div>
        <button onClick={openEdit} style={{
          background: BLUE_SOFT, color: BLUE, border: 'none', borderRadius: 99, padding: '6px 11px',
          fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          🥛 {count} ✎
        </button>
      </div>

      {editing ? (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <label style={{ flex: 1, fontSize: 12, color: T.inkSoft }}>
              Meta (litros)
              <input type="number" inputMode="decimal" value={draftGoalL} onChange={e => setDraftGoalL(e.target.value)}
                style={{ width: '100%', marginTop: 4, padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 15, fontFamily: fonts.ui, outline: 'none' }} />
            </label>
            <label style={{ flex: 1, fontSize: 12, color: T.inkSoft }}>
              Copos por dia
              <input type="number" inputMode="numeric" value={draftCups} onChange={e => setDraftCups(e.target.value)}
                style={{ width: '100%', marginTop: 4, padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 15, fontFamily: fonts.ui, outline: 'none' }} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={saveEdit} style={{ flex: 1, padding: 11, borderRadius: 10, border: 'none', background: BLUE, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: fonts.ui }}>Salvar</button>
            <button onClick={() => setEditing(false)} style={{ padding: '11px 16px', borderRadius: 10, border: `1px solid ${T.border}`, background: 'transparent', color: T.inkSoft, fontSize: 13, cursor: 'pointer', fontFamily: fonts.ui }}>Cancelar</button>
          </div>
        </div>
      ) : (
        <>
          {/* Copos */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center', margin: '16px 0 6px' }}>
            {Array.from({ length: count }).map((_, i) => {
              const state: 'full' | 'next' | 'empty' = i < filled ? 'full' : i === filled ? 'next' : 'empty';
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <Cup state={state} onClick={state === 'next' && !loading ? () => addWater(cup) : undefined} />
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: state === 'empty' ? T.inkMuted : BLUE }}>{cupLabel(cup)}</span>
                </div>
              );
            })}
          </div>

          {/* −/+ */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 8 }}>
            <button onClick={() => addWater(-cup)} disabled={busy || ml <= 0}
              style={{ width: 96, padding: 12, borderRadius: 14, border: 'none', background: T.cream, color: T.inkSoft, fontSize: 20, fontWeight: 700, cursor: ml <= 0 ? 'default' : 'pointer', opacity: ml <= 0 ? 0.5 : 1 }}>−</button>
            <button onClick={() => addWater(cup)} disabled={busy}
              style={{ width: 96, padding: 12, borderRadius: 14, border: 'none', background: BLUE, color: '#fff', fontSize: 20, fontWeight: 700, cursor: 'pointer' }}>+</button>
          </div>
        </>
      )}
    </div>
  );
}
