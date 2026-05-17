'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { T, fonts, shadow } from '../theme';
import { IconChevronLeft, IconChevronRight, iconForTask } from '../icons';

interface HairPlanRow {
  week_number: number;
  focus: string;
  tasks: Array<{ day: number; title: string; description: string; done: boolean }>;
}

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function metaForTask(title: string) {
  const t = title.toLowerCase();
  if (t.includes('hidrat')) return { color: '#3B82F6', label: 'Hidratação' };
  if (t.includes('lav') || t.includes('shampoo')) return { color: '#8B5CF6', label: 'Lavagem' };
  if (t.includes('nutri')) return { color: T.pinkDeep, label: 'Nutrição' };
  if (t.includes('recon')) return { color: '#6366F1', label: 'Reconstrução' };
  if (t.includes('óleo') || t.includes('oleo')) return { color: T.gold, label: 'Óleo' };
  if (t.includes('descan')) return { color: T.inkSoft, label: 'Descanso' };
  return { color: T.pink, label: 'Cuidado' };
}

function buildCalendar(monthOffset = 0) {
  const today = new Date();
  const target = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const daysInMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const startWeekday = target.getDay();
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

    const [pl, p] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('hair_plans').select('week_number,focus,tasks').eq('user_id', uid).order('week_number'),
      supabase.from('profiles').select('plan_released_at').eq('id', uid).single(),
    ]);
    if (pl.data) setPlans(pl.data as HairPlanRow[]);
    if (p.data?.plan_released_at) setPlanReleased(new Date(p.data.plan_released_at));
    else if (pl.data && pl.data.length > 0) setPlanReleased(new Date());
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return null;

  const cal = buildCalendar(monthOffset);
  const today = new Date();

  type AgendaEvent = { date: Date; title: string; description?: string; meta: ReturnType<typeof metaForTask>; status: 'done' | 'today' | 'future' };
  const scheduled: AgendaEvent[] = [];

  if (planReleased && plans.length > 0) {
    const localStart = new Date(planReleased.getFullYear(), planReleased.getMonth(), planReleased.getDate());
    const dow = localStart.getDay();
    const daysUntilMonday = dow === 1 ? 0 : (8 - dow) % 7;
    const week1Monday = new Date(localStart);
    week1Monday.setDate(localStart.getDate() + daysUntilMonday);
    week1Monday.setHours(12, 0, 0, 0);

    const todayLocal = new Date();
    todayLocal.setHours(0, 0, 0, 0);

    for (const plan of plans) {
      const weekMonday = new Date(week1Monday);
      weekMonday.setDate(week1Monday.getDate() + (plan.week_number - 1) * 7);
      for (const task of plan.tasks ?? []) {
        const date = new Date(weekMonday);
        date.setDate(weekMonday.getDate() + (task.day - 1));
        const dayKey = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
        const todayKey = todayLocal.getTime();
        scheduled.push({
          date, title: task.title, description: task.description,
          meta: metaForTask(task.title),
          status: dayKey < todayKey ? 'done' : dayKey === todayKey ? 'today' : 'future',
        });
      }
    }
  }

  scheduled.sort((a, b) => a.date.getTime() - b.date.getTime());

  const monthEvents = scheduled.filter(e => e.date.getFullYear() === cal.year && e.date.getMonth() === cal.month);
  const monthEventsByDay = new Map<number, AgendaEvent[]>();
  for (const ev of monthEvents) {
    const day = ev.date.getDate();
    if (!monthEventsByDay.has(day)) monthEventsByDay.set(day, []);
    monthEventsByDay.get(day)!.push(ev);
  }

  const weekFrom = new Date(today);
  const weekTo = new Date(today);
  weekTo.setDate(weekTo.getDate() + 7);
  const thisWeek = scheduled.filter(e => e.date >= weekFrom && e.date <= weekTo).slice(0, 8);
  const upcoming = scheduled.filter(e => e.date > weekTo).slice(0, 8);

  return (
    <div>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ padding: '24px 24px 18px' }}>
          <div style={{
            fontSize: 28, fontWeight: 600, color: T.ink,
            fontFamily: fonts.display, letterSpacing: -0.5,
          }}>
            <em style={{ fontStyle: 'italic' }}>Agenda</em>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
            <button onClick={() => setMonthOffset(o => o - 1)} style={{
              background: T.surface, border: `1px solid ${T.borderSoft}`,
              borderRadius: 10, padding: 6,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IconChevronLeft size={16} color={T.inkSoft} />
            </button>
            <div style={{
              fontSize: 14, color: T.ink, fontWeight: 600,
              minWidth: 140, textAlign: 'center',
              fontFamily: fonts.display,
            }}>
              {MONTHS[cal.month]} {cal.year}
            </div>
            <button onClick={() => setMonthOffset(o => o + 1)} style={{
              background: T.surface, border: `1px solid ${T.borderSoft}`,
              borderRadius: 10, padding: 6,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IconChevronRight size={16} color={T.inkSoft} />
            </button>
          </div>
        </div>

        {/* Calendar */}
        <div style={{
          margin: '0 16px 22px', background: T.surface, borderRadius: 18,
          padding: 16, boxShadow: shadow.card,
          border: `1px solid ${T.borderSoft}`,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 10 }}>
            {['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(d => (
              <div key={d} style={{
                textAlign: 'center', fontSize: 10.5, fontWeight: 700,
                color: T.inkSoft, textTransform: 'uppercase', letterSpacing: 0.5,
              }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {cal.cells.map((cell, i) => {
              const eventsOnDay = cell.day ? monthEventsByDay.get(cell.day) ?? [] : [];
              const hasEvent = eventsOnDay.length > 0;
              return (
                <div key={i} style={{
                  aspectRatio: '1',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  borderRadius: 10,
                  background: cell.isToday ? `linear-gradient(135deg, ${T.pinkDeep}, ${T.pink})` : 'transparent',
                  color: cell.isToday ? '#FFF' : cell.day ? T.ink : 'transparent',
                  fontSize: 13, fontWeight: cell.isToday ? 700 : 500,
                  fontFamily: fonts.display,
                  position: 'relative',
                  boxShadow: cell.isToday ? '0 4px 10px rgba(190,24,93,0.30)' : 'none',
                }}>
                  {cell.day}
                  {hasEvent && !cell.isToday && (
                    <div style={{ position: 'absolute', bottom: 5, display: 'flex', gap: 2 }}>
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
        <SectionLabel>Esta semana</SectionLabel>
        {thisWeek.length === 0 ? (
          <div style={{
            margin: '0 16px 18px', background: T.surface, borderRadius: 16,
            padding: '28px 18px', textAlign: 'center',
            boxShadow: shadow.card, border: `1px solid ${T.borderSoft}`,
          }}>
            <div style={{ fontSize: 32, marginBottom: 6 }}>📭</div>
            <div style={{ fontSize: 13, color: T.inkSoft }}>Nenhum cuidado agendado esta semana</div>
          </div>
        ) : (
          <div style={{ margin: '0 16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {thisWeek.map((ev, i) => {
              const TaskIcon = iconForTask(ev.title);
              const daysAway = Math.ceil((ev.date.getTime() - today.getTime()) / 86_400_000);
              return (
                <div key={i} style={{
                  background: T.surface, borderRadius: 14, padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: 12,
                  boxShadow: shadow.card,
                  border: `1px solid ${T.borderSoft}`,
                }}>
                  <div style={{ width: 46, textAlign: 'center', flexShrink: 0 }}>
                    <div style={{
                      fontSize: 10.5, color: T.inkSoft, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: 0.4,
                    }}>
                      {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][ev.date.getDay()]}
                    </div>
                    <div style={{
                      fontSize: 22, fontWeight: 700, lineHeight: 1,
                      color: ev.status === 'today' ? T.pinkDeep : T.ink,
                      fontFamily: fonts.display,
                    }}>{ev.date.getDate()}</div>
                  </div>
                  <div style={{
                    width: 38, height: 38, borderRadius: 11,
                    background: `${ev.meta.color}1A`, color: ev.meta.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <TaskIcon size={20} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 10.5, fontWeight: 700, color: ev.meta.color,
                      letterSpacing: 0.4, textTransform: 'uppercase',
                    }}>{ev.meta.label}</div>
                    <div style={{
                      fontSize: 13.5, fontWeight: 600, color: T.ink, marginTop: 1,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{ev.title}</div>
                  </div>
                  <div style={{
                    fontSize: 10.5, fontWeight: 700,
                    background: ev.status === 'done' ? T.greenSoft : ev.status === 'today' ? T.rose : T.cream,
                    color: ev.status === 'done' ? T.green : ev.status === 'today' ? T.pinkDeep : T.inkSoft,
                    borderRadius: 99, padding: '4px 10px', flexShrink: 0,
                  }}>
                    {ev.status === 'done' ? '✓' : ev.status === 'today' ? 'Hoje' : `${daysAway}d`}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Próximas semanas */}
        {upcoming.length > 0 && (
          <>
            <SectionLabel>Próximas semanas</SectionLabel>
            <div style={{
              margin: '0 16px 22px', background: T.surface, borderRadius: 16,
              overflow: 'hidden', boxShadow: shadow.card,
              border: `1px solid ${T.borderSoft}`,
            }}>
              {upcoming.map((ev, i) => {
                const TaskIcon = iconForTask(ev.title);
                return (
                  <div key={i} style={{
                    padding: '13px 16px',
                    display: 'flex', alignItems: 'center', gap: 12,
                    borderBottom: i < upcoming.length - 1 ? `1px solid ${T.borderSoft}` : 'none',
                  }}>
                    <div style={{
                      fontSize: 12, color: T.inkSoft, fontWeight: 700,
                      width: 50, flexShrink: 0,
                      fontFamily: fonts.display,
                    }}>
                      {ev.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ev.title}
                    </div>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: `${ev.meta.color}1A`, color: ev.meta.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <TaskIcon size={15} />
                    </div>
                    <IconChevronRight size={16} color={T.inkMuted} stroke={2} />
                  </div>
                );
              })}
            </div>
          </>
        )}

        {scheduled.length === 0 && (
          <div style={{ margin: '24px 16px', textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>📅</div>
            <div style={{
              fontSize: 17, fontWeight: 600, color: T.ink, marginBottom: 6,
              fontFamily: fonts.display,
            }}>Agenda em preparação</div>
            <div style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.5 }}>
              Assim que seu plano ficar pronto, todos os cuidados aparecerão aqui no calendário.
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '4px 24px 10px' }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: T.inkSoft,
        textTransform: 'uppercase', letterSpacing: 1.2,
      }}>{children}</div>
    </div>
  );
}
