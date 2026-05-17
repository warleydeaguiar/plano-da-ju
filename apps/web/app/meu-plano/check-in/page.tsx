'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { T, fonts, gradient } from '../theme';
import { IconChevronLeft, IconCheck, IconArrowRight, IconSparkles, IconDrop } from '../icons';

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
      { value: 'muito_seco', emoji: '💧', label: 'Ressecado',     desc: 'Sem brilho, sensação de palha' },
      { value: 'bom',        emoji: '✨', label: 'Normal / Bom',  desc: 'Macio e com brilho'           },
      { value: 'oleoso',     emoji: '💦', label: 'Oleoso',        desc: 'Pesado ou com raiz oleosa'    },
      { value: 'frizz',      emoji: '🌪️', label: 'Com muito frizz', desc: 'Arrepiado, difícil de controlar' },
    ],
  },
  {
    key: 'breakage',
    title: 'Percebeu queda de cabelo hoje?',
    type: 'simple' as const,
    options: [
      { value: 'false', emoji: '😌', label: 'Não, queda normal' },
      { value: 'true',  emoji: '😟', label: 'Sim, mais que o normal' },
    ],
  },
  {
    key: 'scalp_feel',
    title: 'Como está seu couro cabeludo?',
    type: 'scale' as const,
    options: [
      { value: 'coceira', emoji: '😣', label: 'Com coceira' },
      { value: 'normal',  emoji: '😐', label: 'Normal'      },
      { value: 'oleoso',  emoji: '😊', label: 'Bem limpo'   },
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
          hair_feel:   answers.hair_feel ?? null,
          scalp_feel:  answers.scalp_feel ?? null,
          breakage:    answers.breakage === 'true',
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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{
          padding: '20px 24px 28px',
          background: gradient.hero,
          color: '#FFF',
          borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', right: -40, top: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.10)' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <button
              onClick={() => step > 0 ? setStep(step - 1) : router.back()}
              style={{
                background: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.22)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                color: '#FFF',
                borderRadius: 99, padding: '6px 12px 6px 8px',
                cursor: 'pointer', marginBottom: 18,
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 13, fontWeight: 600,
              }}
            >
              <IconChevronLeft size={14} color="#FFF" /> Voltar
            </button>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: 1.4,
              opacity: 0.88, textTransform: 'uppercase', marginBottom: 6,
            }}>
              Check-in diário
            </div>
            <h1 style={{
              fontSize: 26, fontWeight: 600, letterSpacing: -0.4,
              margin: 0, fontFamily: fonts.display,
            }}>
              Como está seu <em style={{ fontStyle: 'italic', fontWeight: 700 }}>cabelo hoje?</em>
            </h1>
            <div style={{ fontSize: 12.5, opacity: 0.88, marginTop: 8 }}>
              {todayName}{washDays !== null ? `, ${washDays === 0 ? 'lavou hoje' : `${washDays} dias após lavagem`}` : ''} · {totalSteps} perguntas
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
        </div>

        {/* Smart note */}
        {step === 0 && (
          <div style={{
            margin: '18px 16px 0',
            background: gradient.gold,
            border: `1px solid ${T.gold}55`,
            borderRadius: 14, padding: '12px 14px',
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <IconSparkles size={16} color={T.goldDeep} stroke={1.8} />
            <div>
              <div style={{ fontSize: 12.5, color: T.goldDeep, fontWeight: 700, marginBottom: 2 }}>
                Perguntas personalizadas para hoje
              </div>
              <div style={{ fontSize: 12, color: T.ink, lineHeight: 1.5, opacity: 0.85 }}>
                {washDays !== null && washDays < 2
                  ? 'Como você lavou recentemente, vamos focar em como o cabelo está reagindo aos cuidados.'
                  : washDays !== null && washDays >= 5
                  ? `Faz ${washDays} dias sem lavar — vamos entender como seu cabelo está se mantendo.`
                  : 'Vamos avaliar como seu cabelo está respondendo à sua rotina atual.'}
              </div>
            </div>
          </div>
        )}

        {/* Question */}
        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: T.inkSoft,
            textTransform: 'uppercase', letterSpacing: 1.2,
          }}>
            Pergunta {step + 1} de {totalSteps}
          </div>
          <h2 style={{
            fontSize: 21, fontWeight: 600, color: T.ink, margin: '8px 0 22px',
            lineHeight: 1.3,
            fontFamily: fonts.display, letterSpacing: -0.3,
          }}>
            {currentQ.title}
          </h2>

          {currentQ.type === 'detailed' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {currentQ.options.map(opt => {
                const sel = currentAnswer === opt.value;
                return (
                  <button key={opt.value} onClick={() => setAnswers({ ...answers, [currentQ.key]: opt.value })} style={{
                    background: sel ? T.rose : T.surface,
                    border: `1.5px solid ${sel ? T.pink : T.border}`,
                    borderRadius: 16, padding: '14px 16px',
                    display: 'flex', alignItems: 'center', gap: 14,
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.18s',
                  }}>
                    <div style={{ fontSize: 28, flexShrink: 0 }}>{opt.emoji}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: 15, fontWeight: 700,
                        color: sel ? T.pinkDeep : T.ink,
                        fontFamily: fonts.display,
                      }}>{opt.label}</div>
                      {'desc' in opt && (
                        <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 2 }}>{opt.desc}</div>
                      )}
                    </div>
                    {sel && (
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%', background: T.pink, color: '#FFF',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <IconCheck size={14} stroke={2.5} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {currentQ.type === 'simple' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {currentQ.options.map(opt => {
                const sel = currentAnswer === opt.value;
                return (
                  <button key={opt.value} onClick={() => setAnswers({ ...answers, [currentQ.key]: opt.value })} style={{
                    background: sel ? T.rose : T.surface,
                    border: `1.5px solid ${sel ? T.pink : T.border}`,
                    borderRadius: 16, padding: '14px 16px',
                    display: 'flex', alignItems: 'center', gap: 14,
                    cursor: 'pointer', textAlign: 'left',
                  }}>
                    <div style={{ fontSize: 26 }}>{opt.emoji}</div>
                    <div style={{
                      flex: 1, fontSize: 15, fontWeight: 600,
                      color: sel ? T.pinkDeep : T.ink,
                    }}>{opt.label}</div>
                    {sel && (
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%', background: T.pink, color: '#FFF',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <IconCheck size={14} stroke={2.5} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {currentQ.type === 'scale' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {currentQ.options.map(opt => {
                const sel = currentAnswer === opt.value;
                return (
                  <button key={opt.value} onClick={() => setAnswers({ ...answers, [currentQ.key]: opt.value })} style={{
                    background: sel ? T.rose : T.surface,
                    border: `1.5px solid ${sel ? T.pink : T.border}`,
                    borderRadius: 16, padding: '18px 8px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    cursor: 'pointer',
                  }}>
                    <div style={{ fontSize: 32 }}>{opt.emoji}</div>
                    <div style={{
                      fontSize: 11.5, fontWeight: 700,
                      color: sel ? T.pinkDeep : T.inkSoft, textAlign: 'center',
                    }}>{opt.label}</div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Skipped notice */}
          {step === totalSteps - 1 && washDays !== null && washDays < 1 && (
            <div style={{
              marginTop: 20, background: T.greenSoft,
              border: `1px solid ${T.green}33`, borderRadius: 14, padding: '12px 14px',
              display: 'flex', gap: 10, alignItems: 'flex-start',
            }}>
              <IconDrop size={16} color={T.green} />
              <div>
                <div style={{ fontSize: 12.5, color: T.green, fontWeight: 700, marginBottom: 2 }}>
                  Pulado automaticamente
                </div>
                <div style={{ fontSize: 12, color: T.ink, opacity: 0.75, lineHeight: 1.5 }}>
                  Como você lavou o cabelo recentemente, pulamos perguntas sobre frequência de lavagem.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom actions */}
        <div style={{
          padding: '16px 24px 28px',
          background: T.surface,
          borderTop: `1px solid ${T.borderSoft}`,
        }}>
          {!isLast ? (
            <button
              onClick={() => currentAnswer && setStep(step + 1)}
              disabled={!currentAnswer}
              style={{
                width: '100%', padding: 15, borderRadius: 14, border: 'none',
                background: currentAnswer ? gradient.heroSoft : T.cream,
                color: currentAnswer ? '#FFF' : T.inkMuted,
                fontSize: 15, fontWeight: 700, cursor: currentAnswer ? 'pointer' : 'default',
                fontFamily: fonts.ui,
                boxShadow: currentAnswer ? '0 6px 16px rgba(190,24,93,0.30)' : 'none',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              Próxima <IconArrowRight size={16} stroke={2.2} />
            </button>
          ) : (
            <button
              onClick={save}
              disabled={!currentAnswer || saving}
              style={{
                width: '100%', padding: 15, borderRadius: 14, border: 'none',
                background: currentAnswer ? gradient.heroSoft : T.cream,
                color: currentAnswer ? '#FFF' : T.inkMuted,
                fontSize: 15, fontWeight: 700, cursor: currentAnswer ? 'pointer' : 'default',
                fontFamily: fonts.ui,
                boxShadow: currentAnswer ? '0 6px 16px rgba(190,24,93,0.30)' : 'none',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {saving ? 'Salvando…' : <>Salvar check-in <IconArrowRight size={16} stroke={2.2} /></>}
            </button>
          )}
          <button onClick={() => router.push('/meu-plano')} style={{
            width: '100%', marginTop: 10, padding: '10px 14px', borderRadius: 12,
            border: 'none', background: 'transparent', color: T.inkSoft,
            fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
            fontFamily: fonts.ui,
          }}>
            Pular por hoje
          </button>
        </div>
      </div>
    </div>
  );
}
