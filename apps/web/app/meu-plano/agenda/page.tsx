'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const ACCENT  = '#C4607A';
const ACCENT2 = '#9B4A6A';
const DARK    = '#1C1C1E';
const SUB     = '#8E8E93';
const SEP     = '#E5E5EA';
const SURFACE = '#FFFFFF';
const GREEN   = '#34C759';
const BLUE    = '#007AFF';
const PURPLE  = '#5856D6';
const GOLD    = '#FF9500';

interface HairPlanRow {
  week_number: number;
  focus: string;
  tasks: Array<{ day: number; title: string; description: string; done: boolean }>;
}
interface HairEvent {
  event_type: string;
  occurred_at: string;
}

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function emojiFor(title: string) {
  const t = title.toLowerCase();
  if (t.includes('hidrat')) return { icon: '💧', color: BLUE,   label: 'Hidratação'   };
  if (t.includes('lav') || t.includes('shampoo')) return { icon: '🚿', color: PURPLE, label: 'Lavagem'     };
  if (t.includes('nutri'))  return { icon: '🥥', color: ACCENT, label: 'Nutrição'     };
  if (t.includes('recon'))  return { icon: '💪', color: '#5E5CE6', label: 'Reconstrução' };
  if (t.includes('óleo') || t.includes('oleo')) return { icon: '✨', color: GOLD, label: 'Óleo' };
  if (t.includes('descan')) return { icon: '😴', color: SUB,    label: 'Descanso'     };
  return { icon: '🌿', color: ACCENT, label: 'Cuidado' };
}

// Calendar utility
function buildCalendar(monthOffset = 0) {
  const today = new Date();
  const target = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const firstDay = new Date(target.getFullYear(), target.getMonth(), 1);
  const daysInMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const startWeekday = firstDay.getDay(); // 0=Sun

  // Reorder so Monday is first
  const cells: Array<{ day: number | null; date: Date | null; isToday: boolean }> = [];
  const startEmpty = startWeekday === 0 ? 6 : startWeekday - 1;
  for (let i = 0; i < startEmpty; i++) cells.push({ day: null, date: null, isToday: false });
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(target.getFullYear(), target.getMonth(), d);
    cells.push({ day: d, date, isToday: date.toDateString() === today.toDateString() });
  }
  return { cells, month: target.getMonth(), year: target.getFullYear() };
}

export default function AgendaPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<HairPlanRow[]>([]);
  const [events, setEvents] = useState<HairEvent[]>([]);
  const [planReleased, setPlanReleased] = useState<Date | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login'); return; }
    const uid = session.user.id;

    const [pl, ev, p] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('hair_plans').select('week_number,focus,tasks').eq('user_id', uid).order('week_number'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('hair_events').select('event_type,occurred_at').eq('user_id', uid).order('occurred_at', { ascending: false }).limit(100),
      supabase.from('profiles').select('plan_released_at').eq('id', uid).single(),
    ]);
    if (pl.data) setPlans(pl.data as HairPlanRow[]);
    if (ev.data) setEvents(ev.data as HairEvent[]);
    if (p.data?.plan_released_at) setPlanReleased(new Date(p.data.plan_released_at));
    else if (pl.data && pl.data.length > 0) {
      // Use today as week 1 start if no plan_released_at
      setPlanReleased(new Date());
    }
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return null;

  const cal = buildCalendar(monthOffset);
  const today = new Date();
  const monthName = MONTHS[cal.month];

  // Build event index by date
  type AgendaEvent = { date: Date; iso: string; title: string; description?: string; meta: ReturnType<typeof emojiFor>; status: 'done' | 'today' | 'future' };
  const scheduled: AgendaEvent[] = [];

  // Plan tasks placed on actual weekday (task.day: 1=Mon..7=Sun) starting from
  // the Monday on/after plan_released_at. We use *local* date components to
  // avoid the UTC→local timezone shift that would push events back a day.
  if (planReleased && plans.length > 0) {
    // Local-midnight version of plan start (drops timezone offset)
    const localStart = new Date(planReleased.getFullYear(), planReleased.getMonth(), planReleased.getDate());
    // Find the Monday on or after the plan start (so week 1's day 1 is a Monday)
    const dow = localStart.getDay(); // 0=Sun..6=Sat
    const daysUntilMonday = dow === 1 ? 0 : (8 - dow) % 7;
    const week1Monday = new Date(localStart);
    week1Monday.setDate(localStart.getDate() + daysUntilMonday);
    week1Monday.setHours(12, 0, 0, 0); // noon to avoid DST edge cases

    const todayLocal = new Date();
    todayLocal.setHours(0, 0, 0, 0);

    for (const plan of plans) {
      const weekMonday = new Date(week1Monday);
      weekMonday.setDate(week1Monday.getDate() + (plan.week_number - 1) * 7);
      for (const task of plan.tasks ?? []) {
        const date = new Date(weekMonday);
        date.setDate(weekMonday.getDate() + (task.day - 1));
        const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const dayKey = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
        const todayKey = todayLocal.getTime();
        scheduled.push({
          date, iso, title: task.title, description: task.description,
          meta: emojiFor(task.title),
          status: dayKey < todayKey ? 'done' : dayKey === todayKey ? 'today' : 'future',
        });
      }
    }
  }

  // Sort by date
  scheduled.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Filter visible by current calendar month
  const monthEvents = scheduled.filter(e => e.date.getFullYear() === cal.year && e.date.getMonth() === cal.month);
  const monthEventsByDay = new Map<number, AgendaEvent[]>();
  for (const ev of monthEvents) {
    const day = ev.date.getDate();
    if (!monthEventsByDay.has(day)) monthEventsByDay.set(day, []);
    monthEventsByDay.get(day)!.push(ev);
  }

  // Esta semana (próximos 7 dias)
  const weekFrom = new Date(today);
  const weekTo   = new Date(today);
  weekTo.setDate(weekTo.getDate() + 7);
  const thisWeek = scheduled.filter(e => e.date >= weekFrom && e.date <= weekTo).slice(0, 8);

  // Próximas semanas
  const upcoming = scheduled.filter(e => e.date > weekTo).slice(0, 8);

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ padding: '20px 20px 14px' }}>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.5, color: DARK }}>Agenda</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <button onClick={() => setMonthOffset(o => o - 1)} style={{ background: 'transparent', border: 'none', fontSize: 18, color: SUB, cursor: 'pointer', padding: 0 }}>‹</button>
            <div style={{ fontSize: 13.5, color: SUB, fontWeight: 500, minWidth: 130, textAlign: 'center' }}>
              {monthName} {cal.year}
            </div>
            <button onClick={() => setMonthOffset(o => o + 1)} style={{ background: 'transparent', border: 'none', fontSize: 18, color: SUB, cursor: 'pointer', padding: 0 }}>›</button>
          </div>
        </div>

        {/* Calendar grid */}
        <div style={{ margin: '0 16px 20px', background: SURFACE, borderRadius: 14, padding: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
            {['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 10.5, fontWeight: 700, color: SUB, textTransform: 'uppercase' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {cal.cells.map((cell, i) => {
              const eventsOnDay = cell.day ? monthEventsByDay.get(cell.day) ?? [] : [];
              const hasEvent = eventsOnDay.length > 0;
              return (
                <div key={i} style={{
                  aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 8,
                  background: cell.isToday ? `linear-gradient(135deg, ${ACCENT2}, ${ACCENT})` : 'transparent',
                  color: cell.isToday ? '#FFF' : cell.day ? DARK : 'transparent',
                  fontSize: 13, fontWeight: cell.isToday ? 700 : 500,
                  position: 'relative',
                }}>
                  {cell.day}
                  {hasEvent && !cell.isToday && (
                    <div style={{ position: 'absolute', bottom: 4, display: 'flex', gap: 2 }}>
                      {eventsOnDay.slice(0, 3).map((e, j) => (
                        <div key={j} style={{ width: 4, height: 4, borderRadius: '50%', background: e.meta.color }} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Esta semana */}
        <div style={{ padding: '6px 24px 10px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: DARK }}>Esta semana</div>
        </div>
        {thisWeek.length === 0 ? (
          <div style={{ margin: '0 16px 16px', background: SURFACE, borderRadius: 14, padding: '24px 18px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>📭</div>
            <div style={{ fontSize: 13, color: SUB }}>Nenhum cuidado agendado esta semana</div>
          </div>
        ) : (
          <div style={{ margin: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {thisWeek.map((ev, i) => (
              <div key={i} style={{
                background: SURFACE, borderRadius: 14, padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}>
                <div style={{ width: 44, textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: 10.5, color: SUB, fontWeight: 600, textTransform: 'uppercase' }}>
                    {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][ev.date.getDay()]}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: ev.status === 'today' ? ACCENT : DARK, lineHeight: 1 }}>
                    {ev.date.getDate()}
                  </div>
                </div>
                <div style={{
                  background: `${ev.meta.color}1A`, color: ev.meta.color,
                  borderRadius: 10, padding: '4px 9px', fontSize: 11, fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
                }}>
                  <span>{ev.meta.icon}</span>{ev.meta.label}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: DARK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                  {ev.description && (
                    <div style={{ fontSize: 11.5, color: SUB, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.description}</div>
                  )}
                </div>
                <div style={{
                  fontSize: 10.5, fontWeight: 700,
                  background: ev.status === 'done' ? '#E8F8EE' : ev.status === 'today' ? '#FDE8EE' : '#F2F2F7',
                  color: ev.status === 'done' ? GREEN : ev.status === 'today' ? ACCENT : SUB,
                  borderRadius: 8, padding: '3px 8px', flexShrink: 0,
                }}>
                  {ev.status === 'done' ? '✓' : ev.status === 'today' ? 'Hoje' : `${Math.ceil((ev.date.getTime() - today.getTime()) / 86_400_000)}d`}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Próximas semanas */}
        {upcoming.length > 0 && (
          <>
            <div style={{ padding: '6px 24px 10px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: DARK }}>Próximas semanas</div>
            </div>
            <div style={{ margin: '0 16px 20px', background: SURFACE, borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              {upcoming.map((ev, i) => (
                <div key={i} style={{
                  padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
                  borderBottom: i < upcoming.length - 1 ? `0.5px solid ${SEP}` : 'none',
                }}>
                  <div style={{ fontSize: 12, color: SUB, fontWeight: 600, width: 48, flexShrink: 0 }}>
                    {ev.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, color: DARK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ev.title}
                  </div>
                  <div style={{
                    background: `${ev.meta.color}1A`, color: ev.meta.color,
                    borderRadius: 8, padding: '3px 8px', fontSize: 10.5, fontWeight: 700,
                    flexShrink: 0,
                  }}>
                    {ev.meta.icon}
                  </div>
                  <div style={{ fontSize: 16, color: SUB }}>›</div>
                </div>
              ))}
            </div>
          </>
        )}

        {scheduled.length === 0 && (
          <div style={{ margin: '24px 16px', textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>📅</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: DARK, marginBottom: 6 }}>Agenda em preparação</div>
            <div style={{ fontSize: 13, color: SUB, lineHeight: 1.5 }}>Assim que seu plano ficar pronto, todos os cuidados aparecerão aqui no calendário.</div>
          </div>
        )}

      </div>
    </div>
  );
}
