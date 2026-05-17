'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const BG = '#F5EFF9';
const DARK = '#2D1B2E';
const PINK = '#C4607A';
const MID = '#6B5370';
const BORDER = '#EDE6F2';
const CARD = '#FFFFFF';
const GREEN = '#34C759';

type Tab = 'hoje' | 'plano';

interface HairState {
  last_wash_at: string | null;
  last_hydration_at: string | null;
  last_nutrition_at: string | null;
  last_reconstruction_at: string | null;
  last_oil_at: string | null;
  current_condition: string | null;
}

interface HairPlan {
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

// ── helpers ──────────────────────────────────────────────
function daysAgo(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

function idealWashFreq(hairType: string | null): number {
  if (!hairType) return 5;
  if (hairType.includes('oleoso')) return 3;
  if (hairType.includes('cacheado') || hairType.includes('crespo')) return 7;
  return 5;
}

function getRecommendation(state: HairState | null, profile: Profile | null, plans: HairPlan[]) {
  const washDays  = daysAgo(state?.last_wash_at ?? null);
  const hydrDays  = daysAgo(state?.last_hydration_at ?? null);
  const nutrDays  = daysAgo(state?.last_nutrition_at ?? null);
  const reconDays = daysAgo(state?.last_reconstruction_at ?? null);
  const freq = idealWashFreq(profile?.hair_type ?? null);

  if (washDays !== null && washDays >= freq)
    return { icon: '🚿', title: 'Hora de lavar o cabelo!', description: `Já faz ${washDays} dia${washDays !== 1 ? 's' : ''} desde a última lavagem. Sua rotina pede atenção hoje.`, action: 'Lavar com shampoo lowpoo e aplicar condicionador', color: '#C4607A' };

  if (hydrDays !== null && hydrDays >= 7)
    return { icon: '💧', title: 'Hidratação necessária!', description: `Faz ${hydrDays} dias sem hidratação profunda. Seus fios precisam de água e umidade.`, action: 'Aplicar máscara hidratante por 20 min', color: '#007AFF' };

  if (nutrDays !== null && nutrDays >= 14)
    return { icon: '🥥', title: 'Nutrição em dia!', description: `Faz ${nutrDays} dias sem nutrição. Reponha os lipídeos dos seus fios.`, action: 'Aplicar óleo ou máscara de nutrição', color: '#FF9500' };

  if (reconDays !== null && reconDays >= 21)
    return { icon: '💪', title: 'Reconstrução recomendada', description: `Faz ${reconDays} dias sem reconstrução. Fortaleça a estrutura dos seus fios.`, action: 'Aplicar máscara de reconstrução ou proteína', color: '#5856D6' };

  const task = plans[0]?.tasks?.[0];
  if (task)
    return { icon: '✨', title: task.title, description: task.description, action: plans[0].focus, color: PINK };

  return { icon: '💆‍♀️', title: 'Rotina em dia!', description: 'Continue seguindo seu cronograma personalizado. Consistência é o segredo.', action: 'Ver seu plano completo', color: PINK };
}

// ── constants ────────────────────────────────────────────
const EVENTS = [
  { type: 'wash',            icon: '🚿', label: 'Lavei' },
  { type: 'hydration_mask',  icon: '💧', label: 'Hidratei' },
  { type: 'nutrition_mask',  icon: '🥥', label: 'Nutri' },
  { type: 'reconstruction',  icon: '💪', label: 'Reconstruí' },
  { type: 'oil_treatment',   icon: '✨', label: 'Óleo' },
];

const HAIR_FEEL = [
  { value: 'bom',       label: '😊 Ótimo' },
  { value: 'normal',    label: '😐 Normal' },
  { value: 'muito_seco', label: '😟 Ressecado' },
  { value: 'oleoso',    label: '💧 Oleoso' },
];

const SCALP = [
  { value: 'normal',   label: '✓ Normal' },
  { value: 'coceira',  label: '😖 Coceira' },
  { value: 'oleoso',   label: '💧 Oleoso' },
];

// ── component ────────────────────────────────────────────
export default function MeuPlanoPage() {
  const router = useRouter();
  const [tab, setTab]           = useState<Tab>('hoje');
  const [profile, setProfile]   = useState<Profile | null>(null);
  const [plans, setPlans]       = useState<HairPlan[]>([]);
  const [hairState, setHairState] = useState<HairState | null>(null);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [activeWeek, setActiveWeek] = useState(1);
  const [loading, setLoading]   = useState(true);

  // check-in
  const [hairFeel, setHairFeel]   = useState('');
  const [scalpFeel, setScalpFeel] = useState('');
  const [savingCI, setSavingCI]   = useState(false);
  const [ciSaved, setCiSaved]     = useState(false);

  // event logging
  const [loggingEvt, setLoggingEvt] = useState<string | null>(null);
  const [justLogged, setJustLogged] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login'); return; }

    const uid   = session.user.id;
    const today = new Date().toISOString().split('T')[0];

    const [pRes, plRes, hsRes, ciRes] = await Promise.all([
      supabase.from('profiles')
        .select('full_name,hair_type,subscription_status,plan_status,quiz_answers')
        .eq('id', uid).single(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('hair_plans')
        .select('week_number,focus,tasks,products,tips,juliane_notes')
        .eq('user_id', uid).order('week_number'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('hair_state')
        .select('last_wash_at,last_hydration_at,last_nutrition_at,last_reconstruction_at,last_oil_at,current_condition')
        .eq('user_id', uid).maybeSingle(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('check_ins')
        .select('id').eq('user_id', uid)
        .gte('checked_at', today + 'T00:00:00').limit(1),
    ]);

    if (pRes.data)  setProfile(pRes.data as Profile);
    if (plRes.data) setPlans(plRes.data as HairPlan[]);
    if (hsRes.data) setHairState(hsRes.data as HairState);
    if (ciRes.data?.length) setCheckedInToday(true);
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  async function logEvent(eventType: string) {
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
        // Refresh hair state
        const { data: { session: s2 } } = await supabase.auth.getSession();
        if (s2) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data } = await (supabase as any).from('hair_state')
            .select('last_wash_at,last_hydration_at,last_nutrition_at,last_reconstruction_at,last_oil_at,current_condition')
            .eq('user_id', s2.user.id).maybeSingle();
          if (data) setHairState(data as HairState);
        }
      }
    } finally {
      setLoggingEvt(null);
    }
  }

  async function saveCheckIn() {
    if (!hairFeel) return;
    setSavingCI(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/meu-plano/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ hair_feel: hairFeel, scalp_feel: scalpFeel || null }),
      });
      if (res.ok) { setCiSaved(true); setCheckedInToday(true); }
    } finally {
      setSavingCI(false);
    }
  }

  // ── loading screen ──
  if (loading) return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 40, height: 40, border: `3px solid ${BORDER}`, borderTopColor: PINK, borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <p style={{ color: MID, fontSize: 14 }}>Carregando seu plano…</p>
    </div>
  );

  const rec        = getRecommendation(hairState, profile, plans);
  const currentPlan = plans.find(p => p.week_number === activeWeek);
  const washDays   = daysAgo(hairState?.last_wash_at ?? null);
  const firstName  = profile?.full_name?.split(' ')[0] ?? 'Usuária';
  const hour       = new Date().getHours();
  const greeting   = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <div style={{ minHeight: '100vh', background: BG, paddingBottom: 80 }}>
      {/* ── header ── */}
      <div style={{ background: `linear-gradient(135deg, ${DARK}, #6B3070)`, padding: '20px 20px 28px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, margin: '0 0 2px' }}>{greeting},</p>
              <h1 style={{ color: '#FFF', fontSize: 22, fontWeight: 800, margin: '0 0 10px' }}>{firstName}! 👋</h1>
              {washDays !== null ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: '5px 12px' }}>
                  <span style={{ fontSize: 13 }}>🚿</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>
                    {washDays === 0 ? 'Lavou hoje ✓' : `Dia ${washDays} sem lavar`}
                  </span>
                </div>
              ) : (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.12)', borderRadius: 20, padding: '5px 12px' }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Registre seu primeiro cuidado 💆‍♀️</span>
                </div>
              )}
            </div>
            <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, padding: '8px 14px', color: 'rgba(255,255,255,0.7)', fontSize: 13, cursor: 'pointer' }}>
              Sair
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '18px 16px 0' }}>

        {/* plan not ready */}
        {profile?.plan_status !== 'ready' && (
          <div style={{ background: '#FDE8EE', borderRadius: 14, padding: '14px 16px', marginBottom: 16, border: `1px solid ${BORDER}` }}>
            <p style={{ color: PINK, fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>Plano em preparação ⏳</p>
            <p style={{ color: MID, fontSize: 13, margin: 0 }}>A Juliane está analisando seu perfil. Seu plano ficará pronto em breve!</p>
          </div>
        )}

        {/* ══ TAB: HOJE ══ */}
        {tab === 'hoje' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Today's recommendation */}
            <div style={{ background: `linear-gradient(135deg, ${rec.color}, ${rec.color}BB)`, borderRadius: 18, padding: 20 }}>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px', fontWeight: 700 }}>HOJE PARA VOCÊ</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 30 }}>{rec.icon}</span>
                <h2 style={{ color: '#FFF', fontSize: 17, fontWeight: 800, margin: 0, lineHeight: 1.25 }}>{rec.title}</h2>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.88)', fontSize: 13, margin: '0 0 12px', lineHeight: 1.55 }}>{rec.description}</p>
              <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 10, padding: '8px 12px' }}>
                <span style={{ color: 'rgba(255,255,255,0.95)', fontSize: 12, fontWeight: 600 }}>💡 {rec.action}</span>
              </div>
            </div>

            {/* Quick event log */}
            <div style={{ background: CARD, borderRadius: 16, padding: 16, border: `1px solid ${BORDER}` }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: MID, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px' }}>REGISTRAR CUIDADO</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                {EVENTS.map(btn => {
                  const isLoading = loggingEvt === btn.type;
                  const wasDone   = justLogged === btn.type;
                  return (
                    <button
                      key={btn.type}
                      onClick={() => logEvent(btn.type)}
                      disabled={!!loggingEvt}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                        padding: '10px 4px', borderRadius: 12, border: `1.5px solid ${wasDone ? GREEN : BORDER}`,
                        background: wasDone ? '#E8F8EF' : '#FAFAFA',
                        cursor: loggingEvt ? 'default' : 'pointer',
                        opacity: isLoading ? 0.5 : 1,
                        transition: 'all 0.2s',
                      }}
                    >
                      <span style={{ fontSize: 20 }}>{wasDone ? '✅' : btn.icon}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: wasDone ? GREEN : MID, textAlign: 'center', lineHeight: 1.2 }}>
                        {isLoading ? '…' : btn.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              {justLogged && (
                <p style={{ fontSize: 12, color: GREEN, fontWeight: 600, margin: '10px 0 0', textAlign: 'center' }}>
                  ✓ Registrado! Seu histórico foi atualizado.
                </p>
              )}
            </div>

            {/* Daily check-in */}
            {!checkedInToday && !ciSaved ? (
              <div style={{ background: CARD, borderRadius: 16, padding: 16, border: `1px solid ${BORDER}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 18 }}>📊</span>
                  <p style={{ fontSize: 13, fontWeight: 700, color: DARK, margin: 0 }}>Check-in rápido</p>
                </div>
                <p style={{ fontSize: 12, color: MID, margin: '0 0 14px' }}>Como está seu cabelo hoje?</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                  {HAIR_FEEL.map(opt => (
                    <button key={opt.value} onClick={() => setHairFeel(opt.value)} style={{
                      padding: '9px 8px', borderRadius: 10,
                      border: `1.5px solid ${hairFeel === opt.value ? PINK : BORDER}`,
                      background: hairFeel === opt.value ? '#FDE8EE' : '#FAFAFA',
                      cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      color: hairFeel === opt.value ? PINK : MID,
                    }}>{opt.label}</button>
                  ))}
                </div>

                <p style={{ fontSize: 12, color: MID, fontWeight: 600, margin: '0 0 10px' }}>Couro cabeludo?</p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                  {SCALP.map(opt => (
                    <button key={opt.value} onClick={() => setScalpFeel(opt.value)} style={{
                      padding: '7px 12px', borderRadius: 20,
                      border: `1.5px solid ${scalpFeel === opt.value ? PINK : BORDER}`,
                      background: scalpFeel === opt.value ? '#FDE8EE' : '#FAFAFA',
                      cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      color: scalpFeel === opt.value ? PINK : MID,
                    }}>{opt.label}</button>
                  ))}
                </div>

                <button
                  onClick={saveCheckIn}
                  disabled={!hairFeel || savingCI}
                  style={{
                    width: '100%', padding: 11, borderRadius: 12, border: 'none',
                    background: hairFeel ? PINK : '#F2F2F7',
                    color: hairFeel ? '#FFF' : MID,
                    fontSize: 13, fontWeight: 700,
                    cursor: hairFeel ? 'pointer' : 'default',
                  }}
                >
                  {savingCI ? 'Salvando…' : 'Salvar check-in'}
                </button>
              </div>
            ) : (
              <div style={{ background: '#E8F8EF', borderRadius: 16, padding: 16, border: '1px solid rgba(52,199,89,0.2)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 28 }}>✅</span>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#1D7A3A', margin: '0 0 2px' }}>Check-in feito hoje!</p>
                  <p style={{ fontSize: 12, color: '#2E9D4F', margin: 0 }}>Continue assim — consistência é o segredo do cabelo saudável.</p>
                </div>
              </div>
            )}

            {/* Preview of this week's tasks */}
            {plans.length > 0 && (plans[0].tasks?.length ?? 0) > 0 && (
              <div style={{ background: CARD, borderRadius: 16, padding: 16, border: `1px solid ${BORDER}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: MID, textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>📅 ESTA SEMANA</p>
                  <button onClick={() => setTab('plano')} style={{ background: 'none', border: 'none', color: PINK, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    Ver tudo →
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(plans[0].tasks ?? []).slice(0, 3).map((task, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#FDE8EE', border: `1.5px solid ${PINK}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 10, color: PINK, fontWeight: 700 }}>{task.day}</span>
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: DARK, margin: '0 0 1px' }}>{task.title}</p>
                        <p style={{ fontSize: 12, color: MID, margin: 0, lineHeight: 1.4 }}>{task.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {plans[0].juliane_notes && (
                  <div style={{ background: '#FDE8EE', borderRadius: 10, padding: '10px 12px', marginTop: 12 }}>
                    <p style={{ fontSize: 12, color: PINK, fontStyle: 'italic', margin: 0, lineHeight: 1.5 }}>
                      💬 &ldquo;{plans[0].juliane_notes}&rdquo;
                    </p>
                    <p style={{ fontSize: 11, color: MID, margin: '4px 0 0' }}>— Juliane Cost</p>
                  </div>
                )}
              </div>
            )}

            {/* Last events summary */}
            {hairState && (hairState.last_wash_at || hairState.last_hydration_at) && (
              <div style={{ background: CARD, borderRadius: 16, padding: 16, border: `1px solid ${BORDER}` }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: MID, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px' }}>📈 HISTÓRICO RECENTE</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { key: 'last_wash_at',           icon: '🚿', label: 'Última lavagem' },
                    { key: 'last_hydration_at',      icon: '💧', label: 'Última hidratação' },
                    { key: 'last_nutrition_at',      icon: '🥥', label: 'Última nutrição' },
                    { key: 'last_reconstruction_at', icon: '💪', label: 'Última reconstrução' },
                    { key: 'last_oil_at',            icon: '✨', label: 'Último óleo' },
                  ]
                    .filter(item => hairState[item.key as keyof HairState])
                    .map(item => {
                      const d = daysAgo(hairState[item.key as keyof HairState] as string);
                      return (
                        <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 16, width: 24, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                          <span style={{ fontSize: 13, color: DARK, flex: 1 }}>{item.label}</span>
                          <span style={{ fontSize: 12, color: d === 0 ? GREEN : d !== null && d <= 3 ? MID : PINK, fontWeight: 700 }}>
                            {d === 0 ? 'hoje' : d === 1 ? 'ontem' : `${d}d atrás`}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ TAB: PLANO ══ */}
        {tab === 'plano' && (
          <div>
            {plans.length > 0 ? (
              <>
                <h2 style={{ fontSize: 13, fontWeight: 700, color: MID, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px' }}>
                  SEU CRONOGRAMA ({plans.length} SEMANAS)
                </h2>
                {/* Week selector */}
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 16, scrollbarWidth: 'none' }}>
                  {plans.map(p => (
                    <button key={p.week_number} onClick={() => setActiveWeek(p.week_number)} style={{
                      flexShrink: 0, padding: '8px 14px', borderRadius: 20,
                      border: `1.5px solid ${p.week_number === activeWeek ? PINK : BORDER}`,
                      background: p.week_number === activeWeek ? PINK : CARD,
                      color: p.week_number === activeWeek ? '#FFF' : DARK,
                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}>
                      Sem. {p.week_number}
                    </button>
                  ))}
                </div>

                {currentPlan && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Focus */}
                    <div style={{ background: `linear-gradient(135deg, ${DARK}, #6B3070)`, borderRadius: 16, padding: 20 }}>
                      <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 6px' }}>
                        SEMANA {currentPlan.week_number} · FOCO
                      </p>
                      <h3 style={{ color: '#FFF', fontSize: 19, fontWeight: 800, margin: '0 0 12px' }}>{currentPlan.focus}</h3>
                      {currentPlan.juliane_notes && (
                        <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px' }}>
                          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, margin: 0, fontStyle: 'italic', lineHeight: 1.5 }}>
                            💬 &ldquo;{currentPlan.juliane_notes}&rdquo;
                          </p>
                          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, margin: '6px 0 0' }}>— Juliane Cost</p>
                        </div>
                      )}
                    </div>

                    {/* Tasks */}
                    {(currentPlan.tasks ?? []).length > 0 && (
                      <div style={{ background: CARD, borderRadius: 16, padding: 16, border: `1px solid ${BORDER}` }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: MID, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 14px' }}>TAREFAS DA SEMANA</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                          {currentPlan.tasks.map((task, i) => (
                            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#FDE8EE', border: `2px solid ${PINK}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                                <span style={{ fontSize: 11, color: PINK, fontWeight: 800 }}>{task.day}</span>
                              </div>
                              <div>
                                <p style={{ fontSize: 14, fontWeight: 700, color: DARK, margin: '0 0 3px' }}>{task.title}</p>
                                <p style={{ fontSize: 13, color: MID, margin: 0, lineHeight: 1.5 }}>{task.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Products */}
                    {(currentPlan.products ?? []).length > 0 && (
                      <div style={{ background: CARD, borderRadius: 16, padding: 16, border: `1px solid ${BORDER}` }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: MID, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px' }}>🧴 PRODUTOS DESTA SEMANA</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {currentPlan.products.map((prod, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                              <span style={{ color: PINK, fontSize: 15, marginTop: 1 }}>✓</span>
                              <span style={{ fontSize: 13, color: DARK, lineHeight: 1.4 }}>{prod}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tips */}
                    {(currentPlan.tips ?? []).length > 0 && (
                      <div style={{ background: '#FDE8EE', borderRadius: 16, padding: 16, border: `1px solid rgba(196,96,122,0.2)` }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: PINK, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px' }}>💡 DICAS DA JULIANE</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {currentPlan.tips.map((tip, i) => (
                            <p key={i} style={{ fontSize: 13, color: DARK, margin: 0, lineHeight: 1.6, paddingLeft: 12, borderLeft: `2px solid ${PINK}` }}>{tip}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
                <p style={{ color: DARK, fontSize: 16, fontWeight: 700, margin: '0 0 8px' }}>Plano sendo preparado</p>
                <p style={{ color: MID, fontSize: 14, margin: 0 }}>A Juliane está personalizando seu cronograma. Em breve estará disponível aqui!</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── bottom tab bar ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        background: CARD, borderTop: `1px solid ${BORDER}`,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex' }}>
          {([
            { key: 'hoje',  icon: '🏠', label: 'Hoje' },
            { key: 'plano', icon: '📋', label: 'Plano' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, padding: '10px 0 8px', border: 'none', background: 'transparent', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            }}>
              <span style={{ fontSize: 20 }}>{t.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: tab === t.key ? PINK : MID }}>{t.label}</span>
              {tab === t.key && <div style={{ width: 20, height: 2.5, background: PINK, borderRadius: 2 }} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
