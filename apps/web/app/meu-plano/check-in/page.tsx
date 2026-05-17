'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const ACCENT  = '#C4607A';
const ACCENT2 = '#9B4A6A';
const DARK    = '#1C1C1E';
const MID     = '#48484A';
const SUB     = '#8E8E93';
const SURFACE = '#FFFFFF';
const GREEN   = '#34C759';
const GOLD    = '#FF9500';

interface HairState {
  last_wash_at: string | null;
  last_hydration_at: string | null;
  current_condition: string | null;
}

function daysAgo(d: string | null): number | null {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
}

const QUESTIONS = [
  {
    key: 'hair_feel',
    title: 'Como você está sentindo seu cabelo agora?',
    type: 'detailed' as const,
    options: [
      { value: 'muito_seco', icon: '💧', label: 'Ressecado',    desc: 'Sem brilho, sensação de palha' },
      { value: 'bom',        icon: '✨', label: 'Normal / Bom', desc: 'Macio e com brilho'           },
      { value: 'oleoso',     icon: '💦', label: 'Oleoso',       desc: 'Pesado ou com raiz oleosa'    },
      { value: 'frizz',      icon: '🌪️', label: 'Com muito frizz', desc: 'Arrepiado, difícil de controlar' },
    ],
  },
  {
    key: 'breakage',
    title: 'Percebeu queda de cabelo hoje?',
    type: 'simple' as const,
    options: [
      { value: 'false', icon: '😌', label: 'Não, queda normal' },
      { value: 'true',  icon: '😟', label: 'Sim, mais que o normal' },
    ],
  },
  {
    key: 'scalp_feel',
    title: 'Como está seu couro cabeludo?',
    type: 'scale' as const,
    options: [
      { value: 'coceira', icon: '😣', label: 'Com coceira' },
      { value: 'normal',  icon: '😐', label: 'Normal'      },
      { value: 'oleoso',  icon: '😊', label: 'Bem limpo'   },
    ],
  },
];

export default function CheckInPage() {
  const router = useRouter();
  const [hairState, setHairState] = useState<HairState | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login'); return; }
    const uid = session.user.id;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hs = await (supabase as any).from('hair_state').select('last_wash_at,last_hydration_at,current_condition').eq('user_id', uid).maybeSingle();
    if (hs.data) setHairState(hs.data as HairState);
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch('/api/meu-plano/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          hair_feel:  answers.hair_feel ?? null,
          scalp_feel: answers.scalp_feel ?? null,
          breakage:   answers.breakage === 'true',
          all_answers: answers,
        }),
      });
      router.push('/meu-plano');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  const washDays = daysAgo(hairState?.last_wash_at ?? null);
  const todayName = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'][new Date().getDay()];

  const currentQ = QUESTIONS[step];
  const totalSteps = QUESTIONS.length;
  const isLast = step === totalSteps - 1;
  const currentAnswer = answers[currentQ.key];

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{
          padding: '24px 24px 32px',
          background: `linear-gradient(135deg, #8B3A6E, ${ACCENT})`,
          color: '#FFF',
        }}>
          <button onClick={() => step > 0 ? setStep(step - 1) : router.back()} style={{
            background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.85)',
            fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '4px 0', marginBottom: 16,
          }}>‹ Voltar</button>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, opacity: 0.85, textTransform: 'uppercase', marginBottom: 6 }}>
            CHECK-IN DIÁRIO
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, margin: 0 }}>
            Como está seu cabelo hoje?
          </h1>
          <div style={{ fontSize: 12.5, opacity: 0.88, marginTop: 8 }}>
            {todayName}{washDays !== null ? `, ${washDays === 0 ? 'lavou hoje' : `${washDays} dias após lavagem`}` : ''} • {totalSteps} perguntas
          </div>

          {/* Progress bar */}
          <div style={{ marginTop: 18, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              width: `${((step + 1) / totalSteps) * 100}%`, height: '100%',
              background: '#FFF', borderRadius: 2, transition: 'width 0.3s',
            }} />
          </div>
          <div style={{ marginTop: 6, fontSize: 11.5, opacity: 0.85, textAlign: 'right' }}>
            {step + 1} de {totalSteps}
          </div>
        </div>

        {/* Smart note */}
        {step === 0 && (
          <div style={{ margin: '16px 16px 0', background: '#EDF7ED', border: `1px solid #C8E6C9`, borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 12.5, color: '#1B5E20', fontWeight: 600, marginBottom: 3 }}>✨ Perguntas personalizadas para hoje</div>
            <div style={{ fontSize: 12, color: '#33691E', lineHeight: 1.5 }}>
              {washDays !== null && washDays < 2
                ? 'Como você lavou recentemente, vamos focar em como o cabelo está reagindo aos cuidados.'
                : washDays !== null && washDays >= 5
                ? `Faz ${washDays} dias sem lavar — vamos entender como seu cabelo está se mantendo.`
                : 'Vamos avaliar como seu cabelo está respondendo à sua rotina atual.'}
            </div>
          </div>
        )}

        {/* Question area */}
        <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: SUB, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Pergunta {step + 1} de {totalSteps}
          </div>
          <h2 style={{ fontSize: 19, fontWeight: 700, color: DARK, margin: '6px 0 20px', lineHeight: 1.3 }}>
            {currentQ.title}
          </h2>

          {currentQ.type === 'detailed' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {currentQ.options.map(opt => (
                <button key={opt.value} onClick={() => setAnswers({ ...answers, [currentQ.key]: opt.value })} style={{
                  background: currentAnswer === opt.value ? '#FDE8EE' : SURFACE,
                  border: `1.5px solid ${currentAnswer === opt.value ? ACCENT : '#E5E5EA'}`,
                  borderRadius: 14, padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: 14,
                  cursor: 'pointer', textAlign: 'left',
                }}>
                  <div style={{ fontSize: 28, flexShrink: 0 }}>{opt.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: currentAnswer === opt.value ? ACCENT : DARK }}>{opt.label}</div>
                    {'desc' in opt && <div style={{ fontSize: 12.5, color: SUB, marginTop: 2 }}>{opt.desc}</div>}
                  </div>
                  {currentAnswer === opt.value && (
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: ACCENT, color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>✓</div>
                  )}
                </button>
              ))}
            </div>
          )}

          {currentQ.type === 'simple' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {currentQ.options.map(opt => (
                <button key={opt.value} onClick={() => setAnswers({ ...answers, [currentQ.key]: opt.value })} style={{
                  background: currentAnswer === opt.value ? '#FDE8EE' : SURFACE,
                  border: `1.5px solid ${currentAnswer === opt.value ? ACCENT : '#E5E5EA'}`,
                  borderRadius: 14, padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: 12,
                  cursor: 'pointer', textAlign: 'left',
                }}>
                  <div style={{ fontSize: 26 }}>{opt.icon}</div>
                  <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: currentAnswer === opt.value ? ACCENT : DARK }}>{opt.label}</div>
                  {currentAnswer === opt.value && (
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: ACCENT, color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>✓</div>
                  )}
                </button>
              ))}
            </div>
          )}

          {currentQ.type === 'scale' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {currentQ.options.map(opt => (
                <button key={opt.value} onClick={() => setAnswers({ ...answers, [currentQ.key]: opt.value })} style={{
                  background: currentAnswer === opt.value ? '#FDE8EE' : SURFACE,
                  border: `1.5px solid ${currentAnswer === opt.value ? ACCENT : '#E5E5EA'}`,
                  borderRadius: 14, padding: '16px 8px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  cursor: 'pointer',
                }}>
                  <div style={{ fontSize: 30 }}>{opt.icon}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: currentAnswer === opt.value ? ACCENT : MID, textAlign: 'center' }}>{opt.label}</div>
                </button>
              ))}
            </div>
          )}

          {/* Skipped notice */}
          {step === totalSteps - 1 && washDays !== null && washDays < 1 && (
            <div style={{ marginTop: 18, background: '#FFF3E0', border: `1px solid #FFB74D`, borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ fontSize: 12.5, color: '#E65100', fontWeight: 600, marginBottom: 3 }}>🤖 Pulado automaticamente</div>
              <div style={{ fontSize: 12, color: '#BF360C', lineHeight: 1.5 }}>
                Como você lavou o cabelo recentemente, pulamos perguntas sobre frequência de lavagem.
              </div>
            </div>
          )}
        </div>

        {/* Bottom actions */}
        <div style={{ padding: '16px 24px 28px', background: SURFACE, borderTop: '0.5px solid #E5E5EA' }}>
          {!isLast ? (
            <button
              onClick={() => currentAnswer && setStep(step + 1)}
              disabled={!currentAnswer}
              style={{
                width: '100%', padding: 14, borderRadius: 14, border: 'none',
                background: currentAnswer ? `linear-gradient(135deg, ${ACCENT2}, ${ACCENT})` : '#F2F2F7',
                color: currentAnswer ? '#FFF' : SUB,
                fontSize: 15, fontWeight: 700, cursor: currentAnswer ? 'pointer' : 'default',
                boxShadow: currentAnswer ? '0 4px 12px rgba(196,96,122,0.3)' : 'none',
              }}
            >
              Próxima →
            </button>
          ) : (
            <button
              onClick={save}
              disabled={!currentAnswer || saving}
              style={{
                width: '100%', padding: 14, borderRadius: 14, border: 'none',
                background: currentAnswer ? `linear-gradient(135deg, ${ACCENT2}, ${ACCENT})` : '#F2F2F7',
                color: currentAnswer ? '#FFF' : SUB,
                fontSize: 15, fontWeight: 700, cursor: currentAnswer ? 'pointer' : 'default',
                boxShadow: currentAnswer ? '0 4px 12px rgba(196,96,122,0.3)' : 'none',
              }}
            >
              {saving ? 'Salvando…' : 'Salvar check-in →'}
            </button>
          )}
          <button onClick={() => router.push('/meu-plano')} style={{
            width: '100%', marginTop: 10, padding: '10px 14px', borderRadius: 14,
            border: 'none', background: 'transparent', color: SUB,
            fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
          }}>
            Pular por hoje
          </button>
        </div>
      </div>
    </div>
  );
}

// silence unused warnings
void [GREEN, GOLD, MID];
