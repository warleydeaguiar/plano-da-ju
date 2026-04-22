'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { QUIZ_STEPS, QuizAnswers } from '../../lib/quiz-questions';

const PINK = '#C4607A';
const BG = '#1C0020';
const CARD_BG = '#2A0A30';

export default function QuizClient() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [textInput, setTextInput] = useState('');
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const step = QUIZ_STEPS[stepIndex];
  const progress = Math.round(((stepIndex + 1) / QUIZ_STEPS.length) * 100);

  const saveAndNext = useCallback((id: string, value: string | string[]) => {
    const next = { ...answers, [id]: value };
    setAnswers(next);
    const nextIndex = stepIndex + 1;
    if (nextIndex >= QUIZ_STEPS.length) {
      localStorage.setItem('quiz_answers', JSON.stringify(next));
      router.push('/oferta');
      return;
    }
    if (QUIZ_STEPS[nextIndex].type === 'loading') {
      setStepIndex(nextIndex);
      setTimeout(() => {
        localStorage.setItem('quiz_answers', JSON.stringify(next));
        setStepIndex(nextIndex + 1);
      }, 3000);
      return;
    }
    setStepIndex(nextIndex);
    setTextInput('');
    setMultiSelected([]);
  }, [answers, stepIndex, router]);

  const handleSingle = (value: string) => saveAndNext(step.id, value);

  const handleMultiToggle = (value: string) => {
    setMultiSelected(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  const handleMultiConfirm = () => {
    if (multiSelected.length === 0) return;
    saveAndNext(step.id, multiSelected);
  };

  const handleText = () => {
    if (!textInput.trim()) return;
    saveAndNext(step.id, textInput.trim());
  };

  const goBack = () => {
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  };

  if (step.type === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 24 }}>🔬</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#FFF', textAlign: 'center', marginBottom: 12 }}>
          {step.question}
        </h2>
        <p style={{ color: '#8E8E93', textAlign: 'center', marginBottom: 40 }}>{step.subtitle}</p>
        <div style={{ width: '80%', maxWidth: 300, height: 6, background: CARD_BG, borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: PINK, borderRadius: 3, animation: 'progress 3s linear forwards', width: '100%' }} />
        </div>
        <style>{`@keyframes progress { from { transform: scaleX(0); transform-origin: left; } to { transform: scaleX(1); transform-origin: left; } }`}</style>
      </div>
    );
  }

  if (step.type === 'result') {
    router.push('/oferta');
    return null;
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        {stepIndex > 0 && (
          <button onClick={goBack} style={{ background: 'none', border: 'none', color: '#8E8E93', fontSize: 24, cursor: 'pointer', padding: 4 }}>
            ‹
          </button>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ height: 4, background: CARD_BG, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: PINK, borderRadius: 2, transition: 'width 0.3s ease' }} />
          </div>
        </div>
        <span style={{ fontSize: 12, color: '#8E8E93', minWidth: 40, textAlign: 'right' }}>
          {stepIndex + 1}/{QUIZ_STEPS.length}
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column' }}>
        {/* Step 0 header banner */}
        {stepIndex === 0 && (
          <div style={{ background: 'linear-gradient(160deg,#3D1040,#6B2060 45%,#9B4070 75%,#C4607A)', borderRadius: 16, padding: '24px 20px 20px', marginBottom: 24, textAlign: 'center' }}>
            <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: '4px 16px', fontSize: 12, color: '#FFF', marginBottom: 12 }}>
              ✨ Diagnóstico Gratuito
            </div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#FFF', margin: '0 0 8px', lineHeight: 1.4 }}>
              Descubra o Plano Ideal e Personalizado para Você Recuperar seu Cabelo em 90 Dias
            </h1>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', margin: 0 }}>+3.500 mulheres transformadas</p>
          </div>
        )}

        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#FFF', marginBottom: 8, lineHeight: 1.4 }}>
          {step.question}
        </h2>
        {step.subtitle && (
          <p style={{ fontSize: 13, color: '#8E8E93', marginBottom: 20, lineHeight: 1.5 }}>
            {step.subtitle}
          </p>
        )}

        {/* Single choice */}
        {step.type === 'single' && step.options && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {step.options.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleSingle(opt.value)}
                style={{
                  background: CARD_BG,
                  border: `1px solid rgba(255,255,255,0.08)`,
                  borderRadius: 14,
                  padding: '18px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'background 0.1s',
                  color: '#FFF',
                }}
              >
                {opt.icon && <span style={{ fontSize: 28 }}>{opt.icon}</span>}
                <span style={{ fontSize: 13, fontWeight: 600, textAlign: 'center', lineHeight: 1.3 }}>{opt.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Multi choice */}
        {step.type === 'multi' && step.options && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {step.options.map(opt => {
                const sel = multiSelected.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    onClick={() => handleMultiToggle(opt.value)}
                    style={{
                      background: sel ? 'rgba(196,96,122,0.15)' : CARD_BG,
                      border: `1px solid ${sel ? PINK : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 12,
                      padding: '14px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      color: '#FFF',
                    }}
                  >
                    {opt.icon && <span style={{ fontSize: 20 }}>{opt.icon}</span>}
                    <span style={{ fontSize: 14, flex: 1, textAlign: 'left' }}>{opt.label}</span>
                    <span style={{ fontSize: 18, color: sel ? PINK : '#48484A' }}>{sel ? '✓' : '○'}</span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={handleMultiConfirm}
              disabled={multiSelected.length === 0}
              style={{
                background: multiSelected.length > 0 ? PINK : '#48484A',
                border: 'none',
                borderRadius: 14,
                padding: '16px',
                fontSize: 15,
                fontWeight: 700,
                color: '#FFF',
                cursor: multiSelected.length > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              Continuar →
            </button>
          </>
        )}

        {/* Text input */}
        {step.type === 'text' && (
          <>
            <input
              type={step.id === 'email' ? 'email' : 'text'}
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleText()}
              placeholder={step.placeholder}
              style={{
                background: CARD_BG,
                border: `1px solid rgba(255,255,255,0.12)`,
                borderRadius: 14,
                padding: '16px',
                fontSize: 16,
                color: '#FFF',
                outline: 'none',
                marginBottom: 16,
                width: '100%',
              }}
            />
            <button
              onClick={handleText}
              disabled={!textInput.trim()}
              style={{
                background: textInput.trim() ? PINK : '#48484A',
                border: 'none',
                borderRadius: 14,
                padding: '16px',
                fontSize: 15,
                fontWeight: 700,
                color: '#FFF',
                cursor: textInput.trim() ? 'pointer' : 'not-allowed',
                width: '100%',
              }}
            >
              Continuar →
            </button>
          </>
        )}
      </div>
    </div>
  );
}
