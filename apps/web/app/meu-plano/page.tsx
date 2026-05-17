'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';

const ACCENT  = '#C4607A';
const ACCENT2 = '#9B4A6A';
const DARK    = '#1C1C1E';
const MID     = '#48484A';
const SUB     = '#8E8E93';
const SEP     = '#E5E5EA';
const SURFACE = '#FFFFFF';
const GREEN   = '#34C759';
const GOLD    = '#FF9500';

// ── types ────────────────────────────────────────────────
interface HairState {
  last_wash_at: string | null;
  last_hydration_at: string | null;
  last_nutrition_at: string | null;
  last_reconstruction_at: string | null;
  last_oil_at: string | null;
  current_condition: string | null;
}
interface HairPlanRow {
  week_number: number;
  focus: string;
  tasks: Array<{ day: number; title: string; description: string; done: boolean }>;
  products: string[];
  tips: string[];
  juliane_notes: string | null;
}
interface Profile {
  full_name: string | null;
  hair_type: string | null;
  subscription_status: string;
  plan_status: string;
  quiz_answers: Record<string, unknown> | null;
}
interface HairEvent {
  event_type: string;
  occurred_at: string;
}

// ── helpers ──────────────────────────────────────────────
function daysAgo(d: string | null): number | null {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
}

function idealWashFreq(hairType: string | null): number {
  if (!hairType) return 5;
  if (hairType.includes('oleoso')) return 3;
  if (hairType.includes('cacheado') || hairType.includes('crespo')) return 7;
  return 5;
}

function getRecommendation(state: HairState | null, profile: Profile | null, plan: HairPlanRow | undefined) {
  const w  = daysAgo(state?.last_wash_at ?? null);
  const h  = daysAgo(state?.last_hydration_at ?? null);
  const n  = daysAgo(state?.last_nutrition_at ?? null);
  const r  = daysAgo(state?.last_reconstruction_at ?? null);
  const f  = idealWashFreq(profile?.hair_type ?? null);

  if (w !== null && w >= f)
    return { icon: '🚿', title: 'Lavagem com Shampoo Lowpoo', desc: `Dia ${w} desde a última lavagem — hora de lavar com cuidado.`, chips: ['🧴 Iberaparis Lowpoo', '⏱️ 15 minutos', '📍 Hoje'] };
  if (h !== null && h >= 7)
    return { icon: '💧', title: 'Máscara de Hidratação', desc: `Dia ${w ?? '?'} desde a última lavagem — hora de hidratar profundamente.`, chips: ['🧴 Iberaparis Hydra', '⏱️ 20 minutos', '📍 Pós lavagem'] };
  if (n !== null && n >= 14)
    return { icon: '🥥', title: 'Tratamento de Nutrição', desc: `Faz ${n} dias sem nutrição — reponha os lipídeos.`, chips: ['🧴 Manteiga de Karité', '⏱️ 30 minutos', '📍 Comprimento e pontas'] };
  if (r !== null && r >= 21)
    return { icon: '💪', title: 'Reconstrução Capilar', desc: `Faz ${r} dias sem reconstrução — fortaleça a estrutura.`, chips: ['🧴 Máscara de Proteína', '⏱️ 25 minutos', '📍 Aplicar em todo o cabelo'] };
  const t = plan?.tasks?.[0];
  if (t) return { icon: '✨', title: t.title, desc: t.description, chips: [plan?.focus ?? '', '⏱️ Cronograma', '📍 Hoje'].filter(Boolean) };
  return { icon: '💆‍♀️', title: 'Rotina em dia!', desc: 'Continue seguindo seu cronograma personalizado.', chips: ['✓ Consistência'] };
}

// Daily tips (mini library)
const TIPS = [
  { intro: 'No dia 3 do cabelo cacheado',      text: 'use um difusor com ar frio para reativar o cacho sem causar frizz.' },
  { intro: 'Antes de dormir',                   text: 'faça uma trança ou um coque alto para preservar o penteado e reduzir o frizz pela manhã.' },
  { intro: 'Quando aplicar máscara',            text: 'use o cabelo levemente úmido — a fibra absorve melhor os ativos do que seco.' },
  { intro: 'Para reduzir queda',                text: 'massageie o couro cabeludo com as pontas dos dedos por 3 minutos antes de lavar.' },
  { intro: 'Cabelo com química',                text: 'capriche em nutrição (manteigas/óleos) — químicas removem lipídeos do fio.' },
  { intro: 'Frizz nas pontas',                  text: 'aplique um pingo de óleo (sem álcool) só nas pontas, com cabelo seco.' },
  { intro: 'Cabelo molhado',                    text: 'evite escovar — desembarace com os dedos ou pente de dentes largos.' },
];

const EVENT_TYPES = [
  { type: 'wash',            icon: '🚿', label: 'Lavei o cabelo',    sub: 'Marcar agora'    },
  { type: 'hydration_mask',  icon: '💧', label: 'Hidratação',         sub: 'Máscara, óleo…'  },
  { type: 'heat_used',       icon: '💨', label: 'Usei calor',         sub: 'Secador, chapinha' },
  { type: 'photo',           icon: '📸', label: 'Foto de progresso',  sub: 'Registrar evolução' },
];

// Build last 7 days week strip (today on the right - using current day)
function buildWeek() {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun..6=Sat
  // Start on Monday this week
  const monday = new Date(today);
  const offsetToMonday = dow === 0 ? -6 : 1 - dow;
  monday.setDate(today.getDate() + offsetToMonday);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push({
      label: ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'][i],
      num: d.getDate(),
      iso: d.toISOString().split('T')[0],
      isToday: d.toDateString() === today.toDateString(),
      isPast: d < today && d.toDateString() !== today.toDateString(),
    });
  }
  return days;
}

// Build upcoming care list (combines past events + plan tasks)
function buildUpcoming(plan: HairPlanRow | undefined, events: HairEvent[]) {
  const today = new Date();
  const labels: Record<string, { icon: string; name: string; note: string }> = {
    wash:           { icon: '🚿', name: 'Lavagem com Shampoo',         note: 'Iberaparis Lowpoo' },
    hydration_mask: { icon: '🧴', name: 'Máscara de Hidratação',       note: 'Iberaparis Hydra' },
    nutrition_mask: { icon: '💆', name: 'Tratamento de Nutrição',      note: 'Manteiga de Karité' },
    reconstruction: { icon: '💪', name: 'Reconstrução',                note: 'Máscara de proteína' },
    oil_treatment:  { icon: '✨', name: 'Aplicação de óleo',           note: 'Óleo de coco/argan' },
  };
  const items: Array<{ icon: string; day: string; name: string; note: string; status: 'done' | 'today' | 'future' }> = [];

  // Last 2 events as "done"
  const recent = [...events].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)).slice(0, 2);
  for (const e of recent) {
    const meta = labels[e.event_type] ?? { icon: '✓', name: e.event_type, note: '' };
    const d = Math.floor((today.getTime() - new Date(e.occurred_at).getTime()) / 86_400_000);
    items.push({
      icon: '✓',
      day: d === 0 ? `Hoje · ${meta.name}` : `Há ${d} dia${d > 1 ? 's' : ''}`,
      name: meta.name,
      note: meta.note,
      status: 'done',
    });
  }

  // Today + future from plan tasks (first 2 tasks)
  const tasks = plan?.tasks ?? [];
  const taskMeta = (title: string) => {
    const lower = title.toLowerCase();
    if (lower.includes('hidrata')) return labels.hydration_mask;
    if (lower.includes('lava'))    return labels.wash;
    if (lower.includes('nutri'))   return labels.nutrition_mask;
    if (lower.includes('recon'))   return labels.reconstruction;
    if (lower.includes('óleo') || lower.includes('oleo')) return labels.oil_treatment;
    return { icon: '✨', name: title, note: '' };
  };
  tasks.slice(0, 2).forEach((t, idx) => {
    const m = taskMeta(t.title);
    items.push({
      icon: m.icon,
      day: idx === 0 ? 'Hoje · Recomendado' : 'Próximos dias',
      name: t.title,
      note: t.description.length > 50 ? t.description.slice(0, 50) + '…' : t.description,
      status: idx === 0 ? 'today' : 'future',
    });
  });

  return items.slice(0, 4);
}

// ── component ────────────────────────────────────────────
export default function HojePage() {
  const router = useRouter();
  const [profile, setProfile]   = useState<Profile | null>(null);
  const [plans, setPlans]       = useState<HairPlanRow[]>([]);
  const [hairState, setHairState] = useState<HairState | null>(null);
  const [events, setEvents]     = useState<HairEvent[]>([]);
  const [streak, setStreak]     = useState(0);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [loading, setLoading]   = useState(true);
  const [loggingEvt, setLoggingEvt] = useState<string | null>(null);
  const [justLogged, setJustLogged] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login'); return; }
    const uid = session.user.id;
    const today = new Date().toISOString().split('T')[0];

    const [p, pl, hs, ev, ci] = await Promise.all([
      supabase.from('profiles').select('full_name,hair_type,subscription_status,plan_status,quiz_answers').eq('id', uid).single(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('hair_plans').select('week_number,focus,tasks,products,tips,juliane_notes').eq('user_id', uid).order('week_number'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('hair_state').select('*').eq('user_id', uid).maybeSingle(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('hair_events').select('event_type,occurred_at').eq('user_id', uid).order('occurred_at', { ascending: false }).limit(30),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('check_ins').select('id').eq('user_id', uid).gte('checked_at', today + 'T00:00:00').limit(1),
    ]);

    if (p.data)  setProfile(p.data as Profile);
    if (pl.data) setPlans(pl.data as HairPlanRow[]);
    if (hs.data) setHairState(hs.data as HairState);
    if (ev.data) {
      setEvents(ev.data as HairEvent[]);
      // Calculate streak from consecutive days with at least one event
      const days = new Set((ev.data as HairEvent[]).map((e: HairEvent) => e.occurred_at.split('T')[0]));
      let s = 0;
      const cur = new Date();
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const iso = cur.toISOString().split('T')[0];
        if (days.has(iso)) { s++; cur.setDate(cur.getDate() - 1); }
        else break;
      }
      setStreak(s);
    }
    if (ci.data?.length) setCheckedInToday(true);

    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function logEvent(eventType: string) {
    if (eventType === 'photo') { router.push('/meu-plano/progresso'); return; }
    setLoggingEvt(eventType);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/meu-plano/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ event_type: eventType }),
      });
      if (res.ok) {
        setJustLogged(eventType);
        setTimeout(() => setJustLogged(null), 3000);
        await load();
      }
    } finally {
      setLoggingEvt(null);
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 36, height: 36, border: `3px solid ${SEP}`, borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Usuária';
  const initial   = firstName[0]?.toUpperCase() ?? 'U';
  const washDays  = daysAgo(hairState?.last_wash_at ?? null);
  const hour      = new Date().getHours();
  const sun       = hour < 12 ? '☀️' : hour < 18 ? '🌤️' : '🌙';
  const week      = buildWeek();
  const tipIndex  = new Date().getDate() % TIPS.length;
  const tip       = TIPS[tipIndex];
  const rec       = getRecommendation(hairState, profile, plans[0]);
  const upcoming  = buildUpcoming(plans[0], events);

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ padding: '20px 20px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.5, color: DARK }}>Olá, {firstName} {sun}</div>
            <div style={{ fontSize: 13, color: SUB, marginTop: 3 }}>
              {profile?.hair_type ? `Seu cabelo ${profile.hair_type}` : 'Seu plano capilar'}{washDays !== null && washDays > 0 ? `, dia ${washDays}` : ''}
            </div>
          </div>
          <div style={{
            width: 42, height: 42, borderRadius: '50%',
            background: `linear-gradient(135deg, ${ACCENT2}, ${ACCENT})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#FFF', fontWeight: 700, fontSize: 16,
            boxShadow: '0 4px 12px rgba(196,96,122,0.3)',
          }}>{initial}</div>
        </div>

        {/* Streak pills */}
        <div style={{ padding: '0 20px 16px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{
            background: SURFACE, borderRadius: 20, padding: '7px 14px 7px 12px',
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontSize: 12.5, fontWeight: 600, color: DARK,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: GREEN }} />
            🔥 {streak} dia{streak !== 1 ? 's' : ''} seguido{streak !== 1 ? 's' : ''}
          </div>
          {washDays !== null && (
            <div style={{
              background: SURFACE, borderRadius: 20, padding: '7px 14px 7px 12px',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontSize: 12.5, fontWeight: 600, color: DARK,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: GOLD }} />
              {washDays === 0 ? 'Lavou hoje' : `Dia ${washDays} sem lavar`}
            </div>
          )}
        </div>

        {/* Week strip */}
        <div style={{ padding: '0 16px 14px', display: 'flex', gap: 6 }}>
          {week.map((d, i) => {
            const dayDots = events
              .filter(e => e.occurred_at.split('T')[0] === d.iso)
              .map(e => e.event_type);
            const wasActive = dayDots.length > 0;
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <div style={{ fontSize: 11, fontWeight: d.isToday ? 700 : 500, color: d.isToday ? ACCENT : SUB, textTransform: 'uppercase' }}>
                  {d.label}
                </div>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 600,
                  background: d.isToday ? `linear-gradient(135deg, ${ACCENT2}, ${ACCENT})` : wasActive ? '#E8F8EE' : 'transparent',
                  color: d.isToday ? '#FFF' : wasActive ? GREEN : MID,
                  boxShadow: d.isToday ? '0 3px 10px rgba(196,96,122,0.4)' : 'none',
                }}>
                  {d.num}
                </div>
                <div style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: d.isToday ? ACCENT : wasActive ? GREEN : SEP,
                }} />
              </div>
            );
          })}
        </div>

        {/* Plan not ready banner */}
        {profile?.plan_status !== 'ready' && (
          <div style={{ margin: '0 16px 14px', background: '#FDE8EE', borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ color: ACCENT, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Plano em preparação ⏳</div>
            <div style={{ color: MID, fontSize: 13 }}>A Juliane está analisando seu perfil. Em breve!</div>
          </div>
        )}

        {/* Hero card — Próximo tratamento */}
        <div style={{
          margin: '0 16px 16px',
          background: `linear-gradient(135deg, #8B3A6E, ${ACCENT})`,
          borderRadius: 20, padding: 22,
          boxShadow: '0 8px 24px rgba(155,74,106,0.35)',
          color: '#FFF',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, opacity: 0.85, textTransform: 'uppercase', marginBottom: 8 }}>
            ✨ PRÓXIMO TRATAMENTO
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, lineHeight: 1.2 }}>
            {rec.title}
          </div>
          <div style={{ fontSize: 13.5, opacity: 0.92, marginTop: 8, lineHeight: 1.45 }}>
            {rec.desc}
          </div>
          {rec.chips.length > 0 && (
            <div style={{ marginTop: 14, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {rec.chips.map((c, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.18)', borderRadius: 8, padding: '6px 10px', fontSize: 11.5, fontWeight: 500 }}>
                  {c}
                </div>
              ))}
            </div>
          )}
          {plans[0]?.tasks?.[1] && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.18)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 11.5, opacity: 0.85, flex: 1, minWidth: 0 }}>
                Próximo passo
                <strong style={{ display: 'block', fontWeight: 700, color: '#FFF', opacity: 1, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {plans[0].tasks[1].title}
                </strong>
              </div>
              <Link href="/meu-plano/plano" style={{
                background: 'rgba(255,255,255,0.95)', color: ACCENT2,
                fontSize: 12, fontWeight: 700, padding: '8px 14px', borderRadius: 10,
                textDecoration: 'none', flexShrink: 0,
              }}>Ver como fazer</Link>
            </div>
          )}
        </div>

        {/* Check-in card */}
        <Link href="/meu-plano/check-in" style={{ textDecoration: 'none' }}>
          <div style={{
            margin: '0 16px 16px',
            background: checkedInToday ? '#E8F8EE' : DARK,
            borderRadius: 16, padding: '16px 18px',
            display: 'flex', alignItems: 'center', gap: 14,
            boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
            cursor: 'pointer',
          }}>
            <div style={{ fontSize: 26 }}>{checkedInToday ? '✅' : '🌿'}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: checkedInToday ? '#1D7A3A' : '#FFF' }}>
                {checkedInToday ? 'Check-in feito hoje!' : 'Check-in de hoje'}
              </div>
              <div style={{ fontSize: 12.5, color: checkedInToday ? '#2E9D4F' : 'rgba(255,255,255,0.65)', marginTop: 2 }}>
                {checkedInToday ? 'Continue assim — consistência é o segredo' : 'Como está seu cabelo? • 3 perguntas'}
              </div>
            </div>
            <div style={{ fontSize: 22, color: checkedInToday ? '#1D7A3A' : 'rgba(255,255,255,0.4)' }}>›</div>
          </div>
        </Link>

        {/* Próximos cuidados */}
        {upcoming.length > 0 && (
          <>
            <div style={{ padding: '6px 24px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: DARK, letterSpacing: -0.2 }}>Próximos cuidados</div>
              <Link href="/meu-plano/agenda" style={{ fontSize: 12.5, fontWeight: 600, color: ACCENT, textDecoration: 'none' }}>Ver agenda</Link>
            </div>
            <div style={{ margin: '0 16px 16px', background: SURFACE, borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              {upcoming.map((row, i) => (
                <div key={i} style={{
                  padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: 12,
                  borderBottom: i < upcoming.length - 1 ? `0.5px solid ${SEP}` : 'none',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 10,
                    background: row.status === 'done' ? '#E8F8EE' : row.status === 'today' ? '#FDE8EE' : '#F2F2F7',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, flexShrink: 0,
                  }}>
                    {row.status === 'done' ? '✓' : row.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, color: SUB, fontWeight: 500, marginBottom: 2 }}>{row.day}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: DARK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.name}
                    </div>
                    {row.note && <div style={{ fontSize: 12, color: SUB, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.note}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {row.status === 'done' && (
                      <div style={{ background: GREEN, color: '#FFF', borderRadius: 12, padding: '3px 8px', fontSize: 11, fontWeight: 700 }}>✓</div>
                    )}
                    {row.status === 'today' && (
                      <div style={{ background: ACCENT, color: '#FFF', borderRadius: 12, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>Hoje</div>
                    )}
                    <div style={{ fontSize: 18, color: SUB }}>›</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Quick log */}
        <div style={{ padding: '6px 24px 10px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: DARK }}>Registrar</div>
        </div>
        <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {EVENT_TYPES.map(e => {
            const isLoading = loggingEvt === e.type;
            const wasDone = justLogged === e.type;
            return (
              <button key={e.type} onClick={() => logEvent(e.type)} disabled={!!loggingEvt} style={{
                background: SURFACE, border: 'none', textAlign: 'left',
                borderRadius: 14, padding: 14, cursor: loggingEvt ? 'default' : 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                opacity: isLoading ? 0.6 : 1,
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>{wasDone ? '✅' : e.icon}</div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: wasDone ? GREEN : DARK }}>
                  {e.label}
                </div>
                <div style={{ fontSize: 11.5, color: SUB }}>
                  {wasDone ? 'Registrado!' : isLoading ? 'Salvando…' : e.sub}
                </div>
              </button>
            );
          })}
        </div>

        {/* Dica do dia */}
        <div style={{ padding: '6px 24px 10px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: DARK }}>Dica do dia</div>
        </div>
        <div style={{
          margin: '0 16px 20px', background: SURFACE, borderRadius: 16,
          padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'flex-start',
          boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
        }}>
          <div style={{ fontSize: 22, marginTop: 1, flexShrink: 0 }}>💬</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.5, color: GOLD, textTransform: 'uppercase', marginBottom: 4 }}>
              Juliane recomenda
            </div>
            <div style={{ fontSize: 13.5, color: MID, lineHeight: 1.5 }}>
              <strong style={{ color: DARK }}>{tip.intro}</strong>: {tip.text}
            </div>
          </div>
        </div>

        {/* Logout */}
        <div style={{ padding: '0 24px 20px' }}>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }} style={{
            background: 'transparent', border: 'none', color: SUB, fontSize: 12.5, cursor: 'pointer',
          }}>
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  );
}
