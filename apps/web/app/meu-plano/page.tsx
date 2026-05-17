'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { T, fonts, shadow, gradient } from './theme';
import {
  IconCheck, IconFlame, IconChevronRight, iconForEvent, iconForTask,
  IconWash, IconDrop, IconWind, IconCamera, IconSparkles,
  IconClock, IconPin, IconHeart, IconBag,
} from './icons';

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

type Recommendation = {
  Icon: React.ComponentType<{ size?: number; color?: string; stroke?: number }>;
  title: string;
  desc: string;
  product: string;
  duration: string;
  when: string;
};

function getRecommendation(state: HairState | null, profile: Profile | null, plan: HairPlanRow | undefined): Recommendation {
  const w  = daysAgo(state?.last_wash_at ?? null);
  const h  = daysAgo(state?.last_hydration_at ?? null);
  const n  = daysAgo(state?.last_nutrition_at ?? null);
  const r  = daysAgo(state?.last_reconstruction_at ?? null);
  const f  = idealWashFreq(profile?.hair_type ?? null);

  if (w !== null && w >= f)
    return { Icon: IconWash, title: 'Lavagem com Shampoo Lowpoo', desc: `Dia ${w} desde a última lavagem — hora de lavar com cuidado.`, product: 'Ybera Paris Lowpoo', duration: '15 minutos', when: 'Hoje' };
  if (h !== null && h >= 7)
    return { Icon: IconDrop, title: 'Máscara de Hidratação', desc: `Faz ${h} dias sem hidratação profunda — hora de hidratar os fios.`, product: 'Ybera Paris Hydra', duration: '20 minutos', when: 'Pós lavagem' };
  if (n !== null && n >= 14)
    return { Icon: IconHeart, title: 'Tratamento de Nutrição', desc: `Faz ${n} dias sem nutrição — reponha os lipídeos.`, product: 'Manteiga de Karité', duration: '30 minutos', when: 'Comprimento e pontas' };
  if (r !== null && r >= 21)
    return { Icon: IconCheck, title: 'Reconstrução Capilar', desc: `Faz ${r} dias sem reconstrução — fortaleça a estrutura.`, product: 'Máscara de Proteína', duration: '25 minutos', when: 'Todo o cabelo' };
  const t = plan?.tasks?.[0];
  if (t) {
    const TaskIcon = iconForTask(t.title);
    return { Icon: TaskIcon, title: t.title, desc: t.description, product: plan?.focus ?? 'Cronograma', duration: 'Cronograma', when: 'Hoje' };
  }
  return { Icon: IconSparkles, title: 'Rotina em dia!', desc: 'Continue seguindo seu cronograma personalizado.', product: 'Consistência', duration: 'Sempre', when: 'Hoje' };
}

// Daily tips (mini library)
const TIPS = [
  { intro: 'No dia 3 do cabelo cacheado',  text: 'use um difusor com ar frio para reativar o cacho sem causar frizz.' },
  { intro: 'Antes de dormir',               text: 'faça uma trança ou um coque alto para preservar o penteado e reduzir o frizz pela manhã.' },
  { intro: 'Quando aplicar máscara',        text: 'use o cabelo levemente úmido — a fibra absorve melhor os ativos do que seco.' },
  { intro: 'Para reduzir queda',            text: 'massageie o couro cabeludo com as pontas dos dedos por 3 minutos antes de lavar.' },
  { intro: 'Cabelo com química',            text: 'capriche em nutrição (manteigas/óleos) — químicas removem lipídeos do fio.' },
  { intro: 'Frizz nas pontas',              text: 'aplique um pingo de óleo (sem álcool) só nas pontas, com cabelo seco.' },
  { intro: 'Cabelo molhado',                text: 'evite escovar — desembarace com os dedos ou pente de dentes largos.' },
];

const EVENT_TYPES = [
  { type: 'wash',            Icon: IconWash,   label: 'Lavei o cabelo',    sub: 'Marcar agora'    },
  { type: 'hydration_mask',  Icon: IconDrop,   label: 'Hidratação',         sub: 'Máscara, óleo…'  },
  { type: 'heat_used',       Icon: IconWind,   label: 'Usei calor',         sub: 'Secador, chapinha' },
  { type: 'photo',           Icon: IconCamera, label: 'Foto de progresso',  sub: 'Registrar evolução' },
];

// Build last 7 days week strip
function buildWeek() {
  const today = new Date();
  const dow = today.getDay();
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
      iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      isToday: d.toDateString() === today.toDateString(),
    });
  }
  return days;
}

type UpcomingItem = {
  Icon: React.ComponentType<{ size?: number; color?: string; stroke?: number }>;
  day: string;
  name: string;
  note: string;
  status: 'done' | 'today' | 'future';
};

function buildUpcoming(plan: HairPlanRow | undefined, events: HairEvent[]): UpcomingItem[] {
  const today = new Date();
  const labels: Record<string, { name: string; note: string }> = {
    wash:           { name: 'Lavagem com Shampoo',  note: 'Ybera Paris Lowpoo'     },
    hydration_mask: { name: 'Máscara de Hidratação', note: 'Ybera Paris Hydra'      },
    nutrition_mask: { name: 'Tratamento de Nutrição', note: 'Manteiga de Karité'    },
    reconstruction: { name: 'Reconstrução',           note: 'Máscara de proteína'   },
    oil_treatment:  { name: 'Aplicação de óleo',      note: 'Óleo de coco/argan'    },
    heat_used:      { name: 'Calor / Modelagem',      note: 'Secador ou chapinha'   },
  };
  const items: UpcomingItem[] = [];

  // Last 2 events as "done"
  const sortedEvents = [...events].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  const seenTypes = new Set<string>();
  for (const e of sortedEvents) {
    if (seenTypes.has(e.event_type)) continue;
    seenTypes.add(e.event_type);
    const meta = labels[e.event_type] ?? { name: e.event_type, note: '' };
    const d = Math.floor((today.getTime() - new Date(e.occurred_at).getTime()) / 86_400_000);
    const dayLabel = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'][new Date(e.occurred_at).getDay()];
    items.push({
      Icon: iconForEvent(e.event_type),
      day: d === 0 ? `Hoje · ${dayLabel}` : d === 1 ? 'Ontem' : `Há ${d} dias`,
      name: meta.name,
      note: meta.note,
      status: 'done',
    });
    if (items.length >= 2) break;
  }

  // Today + future from plan
  const tasks = plan?.tasks ?? [];
  tasks.slice(0, 2).forEach((t, idx) => {
    items.push({
      Icon: iconForTask(t.title),
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
      supabase.from('profiles')
        .select('full_name,hair_type,subscription_status,plan_status,quiz_answers')
        .eq('id', uid).single(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('hair_plans')
        .select('week_number,focus,tasks,products,tips,juliane_notes')
        .eq('user_id', uid).order('week_number'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('hair_state').select('*').eq('user_id', uid).maybeSingle(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('hair_events')
        .select('event_type,occurred_at').eq('user_id', uid)
        .order('occurred_at', { ascending: false }).limit(30),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('check_ins').select('id').eq('user_id', uid)
        .gte('checked_at', today + 'T00:00:00').limit(1),
    ]);

    if (p.data)  setProfile(p.data as Profile);
    if (pl.data) setPlans(pl.data as HairPlanRow[]);
    if (hs.data) setHairState(hs.data as HairState);
    if (ev.data) {
      setEvents(ev.data as HairEvent[]);
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

  if (loading) return null;

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Usuária';
  const initial   = firstName[0]?.toUpperCase() ?? 'U';
  const washDays  = daysAgo(hairState?.last_wash_at ?? null);
  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const week      = buildWeek();
  const tipIndex  = new Date().getDate() % TIPS.length;
  const tip       = TIPS[tipIndex];
  const rec       = getRecommendation(hairState, profile, plans[0]);
  const upcoming  = buildUpcoming(plans[0], events);

  return (
    <div>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        {/* Header */}
        <div style={{
          padding: '24px 24px 18px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <div>
            <div style={{ fontSize: 13, color: T.inkSoft, fontWeight: 500 }}>{greeting},</div>
            <div style={{
              fontSize: 28, fontWeight: 600, color: T.ink,
              fontFamily: fonts.display, letterSpacing: -0.5,
              lineHeight: 1.1, marginTop: 2,
            }}>
              <em style={{ fontStyle: 'italic', fontWeight: 600 }}>{firstName}</em>
            </div>
            {profile?.hair_type && (
              <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 4 }}>
                Cabelo {profile.hair_type}{washDays !== null && washDays > 0 ? ` · dia ${washDays}` : ''}
              </div>
            )}
          </div>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: gradient.heroSoft,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#FFF', fontWeight: 700, fontSize: 16,
            fontFamily: fonts.display,
            boxShadow: '0 4px 14px rgba(190,24,93,0.30)',
          }}>{initial}</div>
        </div>

        {/* Streak pills */}
        <div style={{ padding: '0 20px 16px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Pill icon={<IconFlame size={14} color={T.pink} />}>
            <strong>{streak}</strong> dia{streak !== 1 ? 's' : ''} seguido{streak !== 1 ? 's' : ''}
          </Pill>
          {washDays !== null && (
            <Pill icon={<IconWash size={14} color={T.gold} />}>
              {washDays === 0 ? 'Lavou hoje' : `Dia ${washDays} sem lavar`}
            </Pill>
          )}
        </div>

        {/* Week strip */}
        <div style={{ padding: '0 16px 16px', display: 'flex', gap: 6 }}>
          {week.map((d, i) => {
            const wasActive = events.some(e => e.occurred_at.split('T')[0] === d.iso);
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <div style={{
                  fontSize: 10.5, fontWeight: d.isToday ? 700 : 500,
                  color: d.isToday ? T.pinkDeep : T.inkSoft,
                  textTransform: 'uppercase', letterSpacing: 0.4,
                }}>{d.label}</div>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 600,
                  background: d.isToday ? gradient.heroSoft : wasActive ? T.greenSoft : 'transparent',
                  color: d.isToday ? '#FFF' : wasActive ? T.green : T.inkSoft,
                  boxShadow: d.isToday ? '0 3px 10px rgba(190,24,93,0.32)' : 'none',
                  fontFamily: fonts.display,
                }}>{d.num}</div>
                <div style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: d.isToday ? T.pink : wasActive ? T.green : T.border,
                }} />
              </div>
            );
          })}
        </div>

        {/* Plan banner */}
        {profile?.plan_status !== 'ready' && (
          <div style={{
            margin: '0 16px 14px',
            background: gradient.warm,
            border: `1px solid ${T.gold}55`,
            borderRadius: 14, padding: '14px 16px',
          }}>
            <div style={{ color: T.pinkDeep, fontSize: 14, fontWeight: 700, marginBottom: 3, fontFamily: fonts.display }}>
              Plano em preparação ⏳
            </div>
            <div style={{ color: T.inkSoft, fontSize: 13 }}>
              A Juliane está analisando seu perfil. Em breve!
            </div>
          </div>
        )}

        {/* Hero: Próximo tratamento */}
        <div style={{
          margin: '0 16px 18px',
          background: gradient.hero,
          borderRadius: 22, padding: 22,
          boxShadow: shadow.hero,
          color: '#FFF',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', right: -40, top: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.10)' }} />
          <div style={{ position: 'absolute', left: -20, bottom: -30, width: 100, height: 100, borderRadius: '50%', background: 'rgba(201,168,119,0.15)' }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              fontSize: 10.5, fontWeight: 700, letterSpacing: 1.5,
              opacity: 0.88, textTransform: 'uppercase', marginBottom: 10,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <IconSparkles size={13} color="#FFF" stroke={2} /> Próximo tratamento
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
              <div style={{
                width: 46, height: 46, borderRadius: 14,
                background: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <rec.Icon size={26} color="#FFF" stroke={1.8} />
              </div>
              <div style={{
                fontSize: 22, fontWeight: 600, letterSpacing: -0.3,
                fontFamily: fonts.display, lineHeight: 1.15,
              }}>
                {rec.title}
              </div>
            </div>
            <div style={{ fontSize: 13.5, opacity: 0.92, marginTop: 4, lineHeight: 1.5 }}>
              {rec.desc}
            </div>

            <div style={{ marginTop: 14, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <HeroChip icon={<IconBag size={13} stroke={2} />} text={rec.product} />
              <HeroChip icon={<IconClock size={13} stroke={2} />} text={rec.duration} />
              <HeroChip icon={<IconPin size={13} stroke={2} />} text={rec.when} />
            </div>

            {plans[0]?.tasks?.[1] && (
              <div style={{
                marginTop: 16, paddingTop: 14,
                borderTop: '1px solid rgba(255,255,255,0.20)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
              }}>
                <div style={{ fontSize: 11.5, opacity: 0.85, flex: 1, minWidth: 0 }}>
                  Próximo passo
                  <strong style={{
                    display: 'block', fontWeight: 700, color: '#FFF', opacity: 1, marginTop: 2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{plans[0].tasks[1].title}</strong>
                </div>
                <Link href="/meu-plano/plano" style={{
                  background: 'rgba(255,255,255,0.95)', color: T.pinkDeep,
                  fontSize: 12, fontWeight: 700, padding: '9px 14px', borderRadius: 11,
                  textDecoration: 'none', flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  Como fazer <IconChevronRight size={14} stroke={2.4} />
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Check-in card */}
        <Link href="/meu-plano/check-in" style={{ textDecoration: 'none' }}>
          <div style={{
            margin: '0 16px 18px',
            background: checkedInToday ? T.greenSoft : T.ink,
            borderRadius: 16, padding: '16px 18px',
            display: 'flex', alignItems: 'center', gap: 14,
            boxShadow: shadow.card,
            cursor: 'pointer',
            border: `1px solid ${checkedInToday ? '#22A06B33' : 'transparent'}`,
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 11,
              background: checkedInToday ? '#FFF' : 'rgba(255,255,255,0.10)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              color: checkedInToday ? T.green : '#FFF',
              border: checkedInToday ? `1px solid ${T.green}33` : '1px solid rgba(255,255,255,0.15)',
            }}>
              {checkedInToday ? <IconCheck size={20} stroke={2.4} /> : <IconHeart size={20} stroke={1.7} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 15, fontWeight: 700,
                color: checkedInToday ? '#0B5132' : '#FFF',
                fontFamily: fonts.display,
              }}>
                {checkedInToday ? 'Check-in feito hoje!' : 'Check-in de hoje'}
              </div>
              <div style={{
                fontSize: 12.5,
                color: checkedInToday ? '#247448' : 'rgba(255,255,255,0.65)',
                marginTop: 2,
              }}>
                {checkedInToday ? 'Continue assim — consistência é o segredo' : 'Como está seu cabelo? · 3 perguntas'}
              </div>
            </div>
            <IconChevronRight size={20} color={checkedInToday ? '#0B5132' : 'rgba(255,255,255,0.4)'} stroke={2.4} />
          </div>
        </Link>

        {/* Próximos cuidados */}
        {upcoming.length > 0 && (
          <>
            <SectionLabel rightLink={{ href: '/meu-plano/agenda', label: 'Ver agenda' }}>
              Próximos cuidados
            </SectionLabel>
            <div style={{
              margin: '0 16px 18px', background: T.surface, borderRadius: 16,
              overflow: 'hidden', boxShadow: shadow.card,
              border: `1px solid ${T.borderSoft}`,
            }}>
              {upcoming.map((row, i) => (
                <div key={i} style={{
                  padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12,
                  borderBottom: i < upcoming.length - 1 ? `1px solid ${T.borderSoft}` : 'none',
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 10,
                    background: row.status === 'done' ? T.greenSoft : row.status === 'today' ? T.rose : T.cream,
                    color: row.status === 'done' ? T.green : row.status === 'today' ? T.pinkDeep : T.inkSoft,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {row.status === 'done' ? <IconCheck size={17} stroke={2.4} /> : <row.Icon size={17} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 10.5, color: T.inkSoft, fontWeight: 600,
                      textTransform: 'uppercase', letterSpacing: 0.5,
                    }}>{row.day}</div>
                    <div style={{
                      fontSize: 14, fontWeight: 600, color: T.ink, marginTop: 1,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{row.name}</div>
                    {row.note && <div style={{
                      fontSize: 12, color: T.inkSoft, marginTop: 1,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{row.note}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {row.status === 'today' && (
                      <span style={{
                        background: T.pink, color: '#FFF',
                        borderRadius: 99, padding: '3px 10px',
                        fontSize: 10.5, fontWeight: 700,
                      }}>Hoje</span>
                    )}
                    <IconChevronRight size={16} color={T.inkMuted} stroke={2} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Quick log */}
        <SectionLabel>Registrar</SectionLabel>
        <div style={{ padding: '0 16px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {EVENT_TYPES.map(e => {
            const isLoading = loggingEvt === e.type;
            const wasDone = justLogged === e.type;
            return (
              <button key={e.type} onClick={() => logEvent(e.type)} disabled={!!loggingEvt} style={{
                background: T.surface, border: `1px solid ${wasDone ? T.green : T.borderSoft}`,
                textAlign: 'left',
                borderRadius: 16, padding: 14,
                cursor: loggingEvt ? 'default' : 'pointer',
                boxShadow: shadow.card,
                opacity: isLoading ? 0.5 : 1,
                display: 'flex', flexDirection: 'column', gap: 6,
                transition: 'all 0.18s',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: wasDone ? T.greenSoft : T.rose,
                  color: wasDone ? T.green : T.pinkDeep,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 4,
                }}>
                  {wasDone ? <IconCheck size={20} stroke={2.4} /> : <e.Icon size={20} />}
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: wasDone ? T.green : T.ink }}>
                  {e.label}
                </div>
                <div style={{ fontSize: 11.5, color: T.inkSoft }}>
                  {wasDone ? 'Registrado!' : isLoading ? 'Salvando…' : e.sub}
                </div>
              </button>
            );
          })}
        </div>

        {/* Dica do dia */}
        <SectionLabel>Dica do dia</SectionLabel>
        <div style={{
          margin: '0 16px 20px', background: gradient.gold,
          borderRadius: 16, padding: '16px 18px',
          display: 'flex', gap: 14, alignItems: 'flex-start',
          border: `1px solid ${T.gold}55`,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(255,255,255,0.6)',
            color: T.goldDeep,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <IconSparkles size={20} />
          </div>
          <div>
            <div style={{
              fontSize: 10.5, fontWeight: 700, letterSpacing: 1.2,
              color: T.goldDeep, textTransform: 'uppercase', marginBottom: 4,
            }}>
              Juliane recomenda
            </div>
            <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.55 }}>
              <strong style={{ color: T.ink }}>{tip.intro}</strong>: {tip.text}
            </div>
          </div>
        </div>

        {/* Logout */}
        <div style={{ padding: '0 24px 24px' }}>
          <button
            onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }}
            style={{
              background: 'transparent', border: 'none',
              color: T.inkSoft, fontSize: 12.5, cursor: 'pointer',
              padding: 0,
            }}
          >
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────────
function SectionLabel({ children, rightLink }: { children: React.ReactNode; rightLink?: { href: string; label: string } }) {
  return (
    <div style={{ padding: '4px 24px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: T.inkSoft,
        textTransform: 'uppercase', letterSpacing: 1.2,
      }}>{children}</div>
      {rightLink && (
        <Link href={rightLink.href} style={{
          fontSize: 12, fontWeight: 600, color: T.pinkDeep, textDecoration: 'none',
        }}>{rightLink.label}</Link>
      )}
    </div>
  );
}

function Pill({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{
      background: T.surface, borderRadius: 99,
      padding: '7px 14px 7px 11px',
      display: 'inline-flex', alignItems: 'center', gap: 7,
      fontSize: 12.5, fontWeight: 600, color: T.ink,
      boxShadow: shadow.card,
      border: `1px solid ${T.borderSoft}`,
    }}>
      {icon}
      <span>{children}</span>
    </div>
  );
}

function HeroChip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.18)',
      border: '1px solid rgba(255,255,255,0.22)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      borderRadius: 10, padding: '6px 10px',
      fontSize: 11.5, fontWeight: 600, color: '#FFF',
      display: 'inline-flex', alignItems: 'center', gap: 5,
    }}>
      {icon}{text}
    </div>
  );
}
