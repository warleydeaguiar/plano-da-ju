'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const BG = '#F5EFF9';
const DARK = '#2D1B2E';
const PINK = '#C4607A';
const MID = '#6B5370';
const BORDER = '#EDE6F2';
const CARD = '#FFFFFF';

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
}

export default function MeuPlanoPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [plans, setPlans] = useState<HairPlan[]>([]);
  const [activeWeek, setActiveWeek] = useState(1);
  const [loading, setLoading] = useState(true);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const [profileRes, planRes] = await Promise.all([
        supabase.from('profiles').select('full_name,hair_type,subscription_status,plan_status').eq('id', session.user.id).single(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from('hair_plans') as any).select('week_number,focus,tasks,products,tips,juliane_notes').eq('user_id', session.user.id).order('week_number'),
      ]);

      if (profileRes.data) setProfile(profileRes.data as Profile);
      if (planRes.data) setPlans(planRes.data as HairPlan[]);
      setLoading(false);
    }
    load();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 40, height: 40, border: `3px solid ${BORDER}`, borderTopColor: PINK, borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <p style={{ color: MID, fontSize: 14 }}>Carregando seu plano…</p>
      </div>
    );
  }

  const currentPlan = plans.find(p => p.week_number === activeWeek);

  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${DARK}, #6B3070)`, padding: '20px 20px 24px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, margin: '0 0 2px' }}>Olá,</p>
            <h1 style={{ color: '#FFF', fontSize: 20, fontWeight: 800, margin: 0 }}>
              {profile?.full_name?.split(' ')[0] ?? 'Usuária'} 👋
            </h1>
          </div>
          <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, padding: '8px 14px', color: 'rgba(255,255,255,0.7)', fontSize: 13, cursor: 'pointer' }}>
            Sair
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 20px 40px' }}>

        {/* Status banner */}
        {profile?.plan_status !== 'ready' && (
          <div style={{ background: '#FDE8EE', borderRadius: 14, padding: '14px 16px', marginBottom: 20, border: `1px solid ${BORDER}` }}>
            <p style={{ color: PINK, fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>Plano em preparação ⏳</p>
            <p style={{ color: MID, fontSize: 13, margin: 0 }}>A Juliane está analisando seu perfil. Seu plano ficará pronto em breve!</p>
          </div>
        )}

        {/* Week selector */}
        {plans.length > 0 && (
          <>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: MID, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px' }}>
              SEU CRONOGRAMA
            </h2>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 16 }}>
              {plans.map(p => (
                <button key={p.week_number} onClick={() => setActiveWeek(p.week_number)} style={{
                  flexShrink: 0, padding: '8px 14px', borderRadius: 20, border: `1.5px solid ${p.week_number === activeWeek ? PINK : BORDER}`,
                  background: p.week_number === activeWeek ? PINK : CARD, color: p.week_number === activeWeek ? '#FFF' : DARK,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                  Sem. {p.week_number}
                </button>
              ))}
            </div>

            {currentPlan && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Focus card */}
                <div style={{ background: `linear-gradient(135deg, ${DARK}, #6B3070)`, borderRadius: 16, padding: 20 }}>
                  <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 6px' }}>
                    SEMANA {currentPlan.week_number} · FOCO
                  </p>
                  <h3 style={{ color: '#FFF', fontSize: 20, fontWeight: 800, margin: '0 0 12px' }}>{currentPlan.focus}</h3>
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
                {currentPlan.tasks.length > 0 && (
                  <div style={{ background: CARD, borderRadius: 16, padding: 16, border: `1px solid ${BORDER}` }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: MID, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px' }}>TAREFAS DA SEMANA</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {currentPlan.tasks.map((task, i) => (
                        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                          <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#FDE8EE', border: `1.5px solid ${PINK}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                            <span style={{ fontSize: 10, color: PINK, fontWeight: 700 }}>{task.day}</span>
                          </div>
                          <div>
                            <p style={{ fontSize: 14, fontWeight: 700, color: DARK, margin: '0 0 2px' }}>{task.title}</p>
                            <p style={{ fontSize: 13, color: MID, margin: 0, lineHeight: 1.5 }}>{task.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Products */}
                {currentPlan.products.length > 0 && (
                  <div style={{ background: CARD, borderRadius: 16, padding: 16, border: `1px solid ${BORDER}` }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: MID, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px' }}>🧴 PRODUTOS DA SEMANA</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {currentPlan.products.map((prod, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ color: PINK, fontSize: 16 }}>✓</span>
                          <span style={{ fontSize: 14, color: DARK }}>{prod}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tips */}
                {currentPlan.tips.length > 0 && (
                  <div style={{ background: '#FDE8EE', borderRadius: 16, padding: 16, border: `1px solid rgba(196,96,122,0.2)` }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: PINK, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px' }}>💡 DICAS DA JULIANE</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {currentPlan.tips.map((tip, i) => (
                        <p key={i} style={{ fontSize: 13, color: DARK, margin: 0, lineHeight: 1.55, paddingLeft: 12, borderLeft: `2px solid ${PINK}` }}>{tip}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {plans.length === 0 && profile?.plan_status === 'ready' && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
            <p style={{ color: MID, fontSize: 14 }}>Nenhuma semana encontrada no seu plano.</p>
          </div>
        )}
      </div>
    </div>
  );
}
