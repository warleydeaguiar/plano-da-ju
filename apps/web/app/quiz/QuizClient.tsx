'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { QUIZ_STEPS, QuizAnswers, QuizStep } from '../../lib/quiz-questions'

// ╔══════════════════════════════════════════════════════════╗
// ║  V2 — Design moderno feminino                            ║
// ║  - Glassmorphism + gradientes quentes                    ║
// ║  - Tipografia serif elegante (Fraunces) + sans premium   ║
// ║  - Partículas flutuantes, sparkles, spring animations    ║
// ║  - Micro-interações: ripple, scale, glow, sparkle burst  ║
// ╚══════════════════════════════════════════════════════════╝

const T = {
  bg:        '#FFFAF5',
  bgWarm:    '#FFF1E8',
  ink:       '#2A1E2C',
  inkSoft:   '#7C6B7E',
  inkMuted:  '#B5A6B7',
  pink:      '#EC4899',
  pinkDeep:  '#BE185D',
  pinkSoft:  '#FCE7F3',
  pinkBlush: '#FFD1E0',
  gold:      '#C9A877',
  goldDeep:  '#9C7B4F',
  champagne: '#F5E6D3',
  cream:     '#FFF7EE',
  rose:      '#FFE4EA',
  border:    'rgba(196,140,150,0.18)',
}

const fonts = {
  display: '"Fraunces", "Cormorant Garamond", Georgia, serif',
  ui:      '"Plus Jakarta Sans", "Inter", -apple-system, system-ui, sans-serif',
  mono:    'ui-monospace, "SF Mono", monospace',
}

// ─── Helpers de analytics ─────────────────────────────────────
function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return ''
  const key = 'quiz_session_id'
  let id = sessionStorage.getItem(key)
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    sessionStorage.setItem(key, id)
  }
  return id
}
function trackView() {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  fetch('/api/quiz/view', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quiz_slug: 'plano-capilar',
      utm_source: params.get('utm_source'),
      utm_campaign: params.get('utm_campaign'),
    }),
  }).catch(() => {})
}
function trackAnswers(answersData: QuizAnswers) {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  fetch('/api/quiz/answers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id:   getOrCreateSessionId(),
      quiz_slug:    'plano-capilar',
      answers:      answersData,
      utm_source:   params.get('utm_source'),
      utm_campaign: params.get('utm_campaign'),
    }),
  }).catch(() => {})
}

// ─── Curva de progresso "manipulada" ─────────────────────────
function fakeProgress(step: number, total: number): number {
  if (step <= 0) return 0.04
  if (step >= total) return 1
  const t = step / total
  const eased = 1 - Math.pow(1 - t, 0.45)
  return 0.06 + eased * 0.86
}

function useFakeProgress(stepIndex: number, totalSteps: number) {
  const [pct, setPct] = useState(() => fakeProgress(stepIndex, totalSteps))
  const target = fakeProgress(stepIndex, totalSteps)
  useEffect(() => {
    let raf: number | null = null
    const t0 = performance.now()
    const start = pct
    const dur = stepIndex < 3 ? 500 : 900
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / dur)
      const eased = 1 - Math.pow(1 - k, 2.5)
      setPct(start + (target - start) * eased)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { if (raf) cancelAnimationFrame(raf) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])
  return pct
}

// ─── Texto formatado com **bold** *italic* ───────────────────
function FmtText({ children }: { children: string }) {
  const parts = String(children).split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean)
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('**')) {
          const inner = p.slice(2, -2)
          if (inner === 'Plano Ideal') {
            return (
              <span key={i} style={{
                fontFamily: fonts.display, fontStyle: 'italic',
                background: `linear-gradient(135deg, ${T.pink}, ${T.gold})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text', fontWeight: 600,
              }}>{inner}</span>
            )
          }
          if (inner === '90 Dias') {
            return (
              <span key={i} style={{
                fontFamily: fonts.display, fontWeight: 700, color: T.ink,
                position: 'relative', display: 'inline-block',
              }}>
                {inner}
                <span style={{
                  position: 'absolute', left: 0, right: 0, bottom: -2, height: 5,
                  background: `linear-gradient(90deg, ${T.gold}, ${T.pink})`,
                  borderRadius: 99, opacity: 0.4,
                }} />
              </span>
            )
          }
          return <strong key={i} style={{ fontWeight: 700, color: T.ink }}>{inner}</strong>
        }
        if (p.startsWith('*') && !p.startsWith('**')) {
          return <em key={i} style={{ fontStyle: 'italic', fontFamily: fonts.display, fontWeight: 500 }}>{p.slice(1, -1)}</em>
        }
        return <span key={i}>{p}</span>
      })}
    </>
  )
}

// ─── Sparkle particles flutuantes no fundo ───────────────────
function FloatingPetals() {
  const petals = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 4 + Math.random() * 8,
    delay: Math.random() * 8,
    duration: 12 + Math.random() * 10,
    rotation: Math.random() * 360,
    type: i % 3, // 0=sparkle, 1=heart, 2=dot
    color: i % 2 === 0 ? T.pink : T.gold,
  })), [])

  return (
    <div style={{
      position: 'fixed', inset: 0, pointerEvents: 'none',
      overflow: 'hidden', zIndex: 0,
    }}>
      {petals.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            color: p.color,
            opacity: 0.35,
            animation: `petalFloat ${p.duration}s ${p.delay}s ease-in-out infinite, petalSpin ${p.duration * 0.7}s linear infinite`,
            transform: `rotate(${p.rotation}deg)`,
          }}
        >
          {p.type === 0 ? (
            <svg viewBox="0 0 16 16" fill="currentColor" width="100%" height="100%">
              <path d="M8 0 L9.5 6.5 L16 8 L9.5 9.5 L8 16 L6.5 9.5 L0 8 L6.5 6.5 Z" />
            </svg>
          ) : p.type === 1 ? (
            <svg viewBox="0 0 16 16" fill="currentColor" width="100%" height="100%">
              <path d="M8 14s-6-3.5-6-8a3.5 3.5 0 0 1 6-2.5A3.5 3.5 0 0 1 14 6c0 4.5-6 8-6 8z" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" fill="currentColor" width="100%" height="100%">
              <circle cx="8" cy="8" r="3" />
            </svg>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Sparkle burst animado em uma posição ────────────────────
function SparkleBurst({ trigger }: { trigger: number }) {
  if (trigger === 0) return null
  return (
    <div key={trigger} style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5,
    }}>
      {[...Array(8)].map((_, i) => {
        const angle = (i / 8) * Math.PI * 2
        const dist = 24
        return (
          <span
            key={i}
            style={{
              position: 'absolute', left: '50%', top: '50%',
              width: 6, height: 6,
              background: i % 2 === 0 ? T.pink : T.gold,
              borderRadius: '50%',
              transform: 'translate(-50%, -50%)',
              animation: `sparkleBurst 0.7s ease-out forwards`,
              animationDelay: `${i * 0.02}s`,
              ['--bx' as any]: `${Math.cos(angle) * dist}px`,
              ['--by' as any]: `${Math.sin(angle) * dist}px`,
            }}
          />
        )
      })}
    </div>
  )
}

// ─── Header (back + progress) ────────────────────────────────
function Header({ pct, canBack, onBack, showPercent }: { pct: number; canBack: boolean; onBack: () => void; showPercent?: boolean }) {
  return (
    <div style={{ padding: '24px 24px 0', display: 'flex', flexDirection: 'column', gap: 16, position: 'relative', zIndex: 2 }}>
      <div style={{ height: 28, display: 'flex', alignItems: 'center' }}>
        {canBack ? (
          <button
            onClick={onBack}
            aria-label="Voltar"
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(255,255,255,0.65)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: `1px solid ${T.border}`,
              cursor: 'pointer', padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: T.ink,
              boxShadow: '0 2px 8px rgba(190,24,93,0.06)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.92)'}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <svg width="14" height="14" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 4l-7 7 7 7" />
            </svg>
          </button>
        ) : <div style={{ width: 36, height: 36 }} />}
        <div style={{ flex: 1 }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          flex: 1, height: 8, background: 'rgba(196,140,150,0.13)',
          borderRadius: 99, overflow: 'hidden', position: 'relative',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)',
        }}>
          <div style={{
            position: 'absolute', inset: 0, width: `${pct * 100}%`,
            background: `linear-gradient(90deg, ${T.gold}, ${T.pink} 50%, ${T.pinkDeep})`,
            borderRadius: 99,
            transition: 'width 0.65s cubic-bezier(.2,.7,.3,1)',
            boxShadow: `0 0 14px ${T.pink}66`,
          }}>
            <div style={{
              position: 'absolute', right: 0, top: 0, bottom: 0, width: 28,
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.85), transparent)',
              animation: 'shimmer 1.8s linear infinite',
            }} />
          </div>
        </div>
        {showPercent && (
          <div style={{
            fontSize: 13, fontWeight: 700, color: T.pinkDeep, minWidth: 40,
            textAlign: 'right', fontFamily: fonts.ui,
          }}>
            {Math.round(pct * 100)}%
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Continue button (gradient pink with glow) ───────────────
function ContinueButton({ disabled, onClick, label = 'Continuar' }: { disabled?: boolean; onClick: () => void; label?: string }) {
  const [pressed, setPressed] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        width: '100%',
        background: disabled
          ? 'linear-gradient(135deg, #F9A8D4, #FBCFE8)'
          : `linear-gradient(135deg, ${T.pink} 0%, ${T.pinkDeep} 50%, ${T.pink} 100%)`,
        backgroundSize: '200% 200%',
        animation: disabled ? 'none' : 'gradientShift 3s ease infinite',
        color: '#fff',
        border: 'none', borderRadius: 99,
        padding: '20px',
        fontSize: 16, fontWeight: 700,
        fontFamily: fonts.ui,
        letterSpacing: 0.3,
        cursor: disabled ? 'default' : 'pointer',
        transition: 'all 0.18s cubic-bezier(.2,.7,.3,1)',
        boxShadow: disabled
          ? 'none'
          : pressed
            ? `0 2px 8px ${T.pinkDeep}44, inset 0 2px 4px rgba(0,0,0,0.1)`
            : `0 8px 24px ${T.pinkDeep}3D, 0 2px 6px ${T.pinkDeep}22`,
        transform: pressed ? 'scale(0.98) translateY(1px)' : 'scale(1) translateY(0)',
        position: 'relative', overflow: 'hidden',
      }}
    >
      <span style={{ position: 'relative', zIndex: 2, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        {label}
        {!disabled && (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M5 3l5 5-5 5" />
          </svg>
        )}
      </span>
    </button>
  )
}

// ─── Color swatch (premium look) ──────────────────────────────
function ColorSwatch({ color, size = 32, selected = false }: { color: string; size?: number; selected?: boolean }) {
  const lighter = useMemo(() => {
    const c = color.replace('#', '')
    const num = parseInt(c.length === 3 ? c.split('').map(x => x + x).join('') : c, 16)
    const r = Math.min(255, ((num >> 16) & 0xff) + 60)
    const g = Math.min(255, ((num >> 8) & 0xff) + 60)
    const b = Math.min(255, (num & 0xff) + 60)
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)
  }, [color])
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `radial-gradient(circle at 32% 28%, ${lighter}, ${color} 70%)`,
      boxShadow: selected
        ? `0 0 0 3px #fff, 0 0 0 5px ${T.pink}, 0 6px 20px ${color}88, inset 0 -3px 6px rgba(0,0,0,0.18), inset 0 2px 3px rgba(255,255,255,0.3)`
        : 'inset 0 -3px 6px rgba(0,0,0,0.22), inset 0 2px 3px rgba(255,255,255,0.32), 0 4px 14px rgba(0,0,0,0.12)',
      flexShrink: 0,
      transition: 'all 0.3s cubic-bezier(.2,.7,.3,1)',
      transform: selected ? 'scale(1.1)' : 'scale(1)',
    }} />
  )
}

// ─── Card de opção (single) — premium ────────────────────────
function SingleCard({ option, selected, onClick, indexDelay, hasColorSwatch }: {
  option: { id: string; label: string; color?: string }
  selected: boolean
  onClick: () => void
  indexDelay: number
  hasColorSwatch: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const [burst, setBurst] = useState(0)

  const handleClick = () => {
    setBurst(b => b + 1)
    onClick()
  }

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: selected
          ? `linear-gradient(135deg, #fff, ${T.cream})`
          : 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: `1.5px solid ${selected ? T.pink : 'rgba(196,140,150,0.18)'}`,
        borderRadius: 18,
        padding: '18px 18px',
        display: 'flex', alignItems: 'center', gap: 14,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: fonts.ui,
        boxShadow: selected
          ? `0 12px 32px ${T.pink}33, 0 2px 8px ${T.pink}22, inset 0 1px 0 rgba(255,255,255,0.6)`
          : hovered
            ? `0 8px 24px rgba(190,24,93,0.12), 0 2px 6px rgba(190,24,93,0.06)`
            : '0 2px 8px rgba(190,24,93,0.05), inset 0 1px 0 rgba(255,255,255,0.5)',
        transition: 'all 0.32s cubic-bezier(.2,.7,.3,1)',
        animation: `cardIn 0.55s ${indexDelay}ms both cubic-bezier(.2,.85,.25,1)`,
        width: '100%',
        position: 'relative',
        transform: selected ? 'translateY(-2px) scale(1.01)' : hovered ? 'translateY(-1px)' : 'translateY(0)',
        overflow: 'visible',
      }}
    >
      <SparkleBurst trigger={burst} />
      {hasColorSwatch && option.color && <ColorSwatch color={option.color} selected={selected} />}
      <span style={{
        flex: 1, fontSize: 16, color: T.ink, fontWeight: 500, lineHeight: 1.35,
        fontFamily: fonts.ui, letterSpacing: -0.1,
      }}>
        <FmtText>{option.label}</FmtText>
      </span>
      <span style={{
        width: 32, height: 32, borderRadius: '50%',
        background: selected
          ? `linear-gradient(135deg, ${T.pink}, ${T.pinkDeep})`
          : 'rgba(255,255,255,0.6)',
        border: selected ? 'none' : `1px solid ${T.border}`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        color: selected ? '#fff' : T.inkSoft,
        boxShadow: selected ? `0 4px 12px ${T.pink}44` : 'none',
        transition: 'all 0.3s',
        transform: selected ? 'scale(1.08)' : 'scale(1)',
      }}>
        {selected ? (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8l3 3 7-7" />
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 2l4 4-4 4" />
          </svg>
        )}
      </span>
    </button>
  )
}

// ─── Card de opção (multi) ────────────────────────────────────
function MultiCard({ option, selected, onClick, indexDelay }: {
  option: { id: string; label: string }
  selected: boolean
  onClick: () => void
  indexDelay: number
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: selected
          ? `linear-gradient(135deg, ${T.rose}, #fff)`
          : 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: `1.5px solid ${selected ? T.pink : 'rgba(196,140,150,0.18)'}`,
        borderRadius: 18,
        padding: '18px 18px',
        display: 'flex', alignItems: 'center', gap: 14,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: fonts.ui,
        boxShadow: selected
          ? `0 10px 28px ${T.pink}33, inset 0 1px 0 rgba(255,255,255,0.6)`
          : hovered
            ? `0 6px 18px rgba(190,24,93,0.1)`
            : '0 2px 8px rgba(190,24,93,0.05)',
        transition: 'all 0.3s cubic-bezier(.2,.7,.3,1)',
        animation: `cardIn 0.5s ${indexDelay}ms both cubic-bezier(.2,.85,.25,1)`,
        width: '100%',
        transform: selected ? 'translateY(-1px) scale(1.005)' : 'translateY(0)',
      }}
    >
      <span style={{ flex: 1, fontSize: 16, color: T.ink, fontWeight: 500, lineHeight: 1.35 }}>
        {option.label}
      </span>
      <span style={{
        width: 26, height: 26, borderRadius: 8,
        border: `2px solid ${selected ? T.pink : 'rgba(196,140,150,0.3)'}`,
        background: selected
          ? `linear-gradient(135deg, ${T.pink}, ${T.pinkDeep})`
          : 'rgba(255,255,255,0.5)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        boxShadow: selected ? `0 4px 12px ${T.pink}44` : 'none',
        transition: 'all 0.25s cubic-bezier(.2,1.4,.3,1)',
        transform: selected ? 'scale(1.05)' : 'scale(1)',
      }}>
        {selected && (
          <svg width="14" height="12" viewBox="0 0 14 12" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{
            animation: 'checkPop 0.32s cubic-bezier(.2,1.5,.3,1)',
          }}>
            <path d="M1 6l4 4 8-8" />
          </svg>
        )}
      </span>
    </button>
  )
}

// ─── Tela: pergunta single ────────────────────────────────────
function SingleScreen({ q, value, onChoose }: {
  q: QuizStep
  value: string | undefined
  onChoose: (v: string) => void
}) {
  const opts = q.options ?? []
  const isCor = q.id === 'cor'
  const useGrid = !isCor && opts.length === 4

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 24px 24px', position: 'relative' }}>
      {q.intro && (
        <div style={{
          fontSize: 26, lineHeight: 1.3, fontWeight: 500,
          fontFamily: fonts.display, color: T.ink,
          marginBottom: 32, textAlign: 'center',
          letterSpacing: -0.3,
        }}>
          <FmtText>{q.intro}</FmtText>
        </div>
      )}
      <h2 style={{
        fontSize: q.intro ? 22 : 28,
        fontFamily: fonts.display, fontWeight: 600, color: T.ink,
        lineHeight: 1.2, textAlign: 'center',
        margin: q.intro ? '0 0 24px' : '0 0 24px',
        letterSpacing: -0.4,
      }}>{q.title}</h2>

      {q.subtitle && !q.intro && (
        <div style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.55, textAlign: 'center', marginBottom: 24, fontFamily: fonts.ui }}>
          {q.subtitle}
        </div>
      )}

      <div
        style={useGrid
          ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }
          : { display: 'flex', flexDirection: 'column', gap: 12 }
        }
      >
        {opts.map((opt, i) => (
          <SingleCard
            key={opt.id}
            option={opt}
            selected={value === opt.id}
            onClick={() => onChoose(opt.id)}
            indexDelay={i * 65}
            hasColorSwatch={isCor}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Tela: pergunta multi ─────────────────────────────────────
function MultiScreen({ q, value, onToggle, onContinue }: {
  q: QuizStep
  value: string[]
  onToggle: (v: string) => void
  onContinue: () => void
}) {
  const opts = q.options ?? []
  const canContinue = value.length > 0
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '8px 24px 24px' }}>
      <h2 style={{
        fontSize: 26, fontFamily: fonts.display, fontWeight: 600, color: T.ink,
        lineHeight: 1.2, textAlign: 'center', margin: '20px 0 24px', letterSpacing: -0.4,
      }}>
        {q.title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
        {opts.map((opt, i) => (
          <MultiCard
            key={opt.id}
            option={opt}
            selected={value.includes(opt.id)}
            onClick={() => onToggle(opt.id)}
            indexDelay={i * 50}
          />
        ))}
      </div>
      <div style={{ marginTop: 'auto', paddingTop: 16 }}>
        <ContinueButton disabled={!canContinue} onClick={onContinue} />
      </div>
    </div>
  )
}

// ─── Tela: textarea ───────────────────────────────────────────
function TextareaScreen({ q, value, onChange, onContinue }: {
  q: QuizStep
  value: string
  onChange: (v: string) => void
  onContinue: () => void
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 24px 24px' }}>
      <h2 style={{
        fontSize: 26, fontFamily: fonts.display, fontWeight: 600, color: T.ink,
        lineHeight: 1.2, textAlign: 'center', margin: '12px 0 18px', letterSpacing: -0.4,
      }}>
        {q.title}
      </h2>
      {q.subtitle && (
        <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 8, fontFamily: fonts.ui, fontWeight: 500 }}>
          {q.subtitle}
        </div>
      )}
      <textarea
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={e => onChange(e.target.value.slice(0, 200))}
        placeholder={q.placeholder}
        rows={4}
        style={{
          width: '100%', padding: '18px 20px', fontSize: 16, fontFamily: fonts.ui,
          color: T.ink, background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(12px)',
          border: `1.5px solid ${focused ? T.pink : 'rgba(196,140,150,0.18)'}`,
          borderRadius: 18, outline: 'none', boxSizing: 'border-box',
          boxShadow: focused
            ? `0 0 0 4px ${T.pink}22, 0 8px 20px rgba(190,24,93,0.08)`
            : '0 2px 8px rgba(190,24,93,0.05)',
          resize: 'none', transition: 'all 0.25s',
          lineHeight: 1.5,
        }}
      />
      <div style={{ fontSize: 12, color: T.inkMuted, textAlign: 'right', marginTop: 6, fontFamily: fonts.mono }}>{value.length}/200</div>
      <div style={{ marginTop: 'auto', paddingTop: 16 }}>
        <ContinueButton onClick={onContinue} label={q.ctaText ?? 'Continuar'} />
      </div>
    </div>
  )
}

// ─── Mídias dos info screens ─────────────────────────────────
function InfoMediaJulianeVideo({ src }: { src: string }) {
  return (
    <div style={{
      width: '100%', borderRadius: 24, overflow: 'hidden',
      aspectRatio: '9/13', background: '#000',
      boxShadow: `0 24px 48px ${T.pinkDeep}22, 0 8px 20px rgba(0,0,0,0.1)`,
      position: 'relative',
      animation: 'mediaZoomIn 0.7s cubic-bezier(.2,.85,.25,1)',
      border: `3px solid #fff`,
    }}>
      <iframe
        src={src}
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        allowFullScreen
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
      />
    </div>
  )
}

function InfoMediaBeforeAfter({ src }: { src: string }) {
  return (
    <div style={{
      width: '100%', borderRadius: 22, overflow: 'hidden', aspectRatio: '4/3',
      background: '#F3F4F6',
      boxShadow: `0 20px 40px ${T.pinkDeep}1A, 0 6px 16px rgba(0,0,0,0.08)`,
      position: 'relative',
      animation: 'mediaZoomIn 0.7s cubic-bezier(.2,.85,.25,1)',
      border: `3px solid #fff`,
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Resultado capilar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{
        position: 'absolute', top: 12, right: 12,
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(8px)',
        padding: '4px 10px', borderRadius: 99,
        fontSize: 10, fontWeight: 700, color: T.pinkDeep,
        letterSpacing: 1, textTransform: 'uppercase',
      }}>
        ✨ Real
      </div>
    </div>
  )
}

function InfoBio({ photoSrc }: { photoSrc: string }) {
  return (
    <div>
      <div style={{
        width: '100%', maxWidth: 220, margin: '0 auto 18px',
        borderRadius: 100, overflow: 'hidden', aspectRatio: '1/1',
        boxShadow: `0 16px 36px ${T.pinkDeep}26, 0 0 0 4px #fff, 0 0 0 8px ${T.pinkSoft}`,
        animation: 'mediaZoomIn 0.7s cubic-bezier(.2,.85,.25,1)',
        position: 'relative',
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoSrc} alt="Juliane Cost" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <div style={{
          fontFamily: fonts.display, fontSize: 22, fontWeight: 600, color: T.ink,
          marginBottom: 4, letterSpacing: -0.3,
        }}>
          Juliane Cost
        </div>
        <div style={{
          fontSize: 11, fontWeight: 700, color: T.pinkDeep,
          letterSpacing: 2.5, textTransform: 'uppercase',
        }}>
          Tricologista · Especialista
        </div>
      </div>
      <div style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.7, fontFamily: fonts.ui }}>
        Prazer, sou a <strong style={{ color: T.ink, fontWeight: 700 }}>Juliane Cost</strong>, especialista em recuperação de cabelos femininos.
        <br /><br />
        Meu trabalho começou ajudando mulheres modificando hábitos e comprando os produtos certos.
        <br /><br />
        Eu sei que é difícil cuidar do cabelo, principalmente quando não sabemos o que fazer ou se temos pouco tempo. Por isso, criei meu plano personalizado capilar que vai te ajudar mostrando passo-a-passo e diariamente o que você precisa fazer.
        <br /><br />
        Já são <strong style={{ color: T.ink, fontWeight: 700 }}>3.500 mulheres atendidas individualmente</strong>, com casos reais que você verá durante seu plano.
        <br /><br />
        Esse plano vai te mostrar que cuidar de cabelo pode ser fácil e prazeroso. E o resultado da metodologia tem sido incrível.
        <br /><br />
        Além disso, você terá acesso a um <strong style={{ color: T.ink, fontWeight: 700 }}>grupo exclusivo de promoções no WhatsApp</strong>, com descontos diretos das fábricas que eu confio.
      </div>
      <div style={{
        marginTop: 22, padding: '16px 18px',
        background: `linear-gradient(135deg, ${T.rose}, ${T.cream})`,
        borderRadius: 16, fontSize: 14, color: T.ink, fontWeight: 600, textAlign: 'center',
        fontFamily: fonts.display, fontStyle: 'italic',
        border: `1px solid ${T.pinkSoft}`,
      }}>
        “Sem mais bla,bla,bla, apenas saberá o que fazer no seu cabelo, e sem mistérios.”
      </div>
    </div>
  )
}

function InfoDepoimentos({ images }: { images: Record<string, string> }) {
  const fb = (key: string, fallback: string) => images[key] || fallback
  const cards = [
    { src: fb('plano_capilar_depoimento_1', '/images/resultado-antes1.png'), name: 'Gabriela Bernicki', desc: 'Mudou a rotina e todos os produtos' },
    { src: fb('plano_capilar_depoimento_2', '/images/resultado-antes2.png'), name: 'Beatriz', desc: 'Plano capilar' },
    { src: fb('plano_capilar_depoimento_3', '/images/resultado-antes3.png'), name: 'Fernanda', desc: 'Plano capilar' },
    { src: fb('plano_capilar_depoimento_4', '/images/resultado-antes4.png'), name: 'Rafaela Nascimento', desc: 'Resultado real' },
  ]
  return (
    <div>
      <h2 style={{
        fontSize: 24, fontFamily: fonts.display, fontWeight: 600, color: T.ink,
        lineHeight: 1.2, textAlign: 'center', margin: '0 0 24px', letterSpacing: -0.4,
      }}>
        Resultados de quem aplicou meu <em style={{ color: T.pinkDeep }}>plano personalizado</em>
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 18 }}>
        {cards.map((d, i) => (
          <div key={i} style={{
            borderRadius: 18, overflow: 'hidden',
            background: '#fff',
            boxShadow: '0 8px 20px rgba(190,24,93,0.08)',
            border: `1px solid ${T.border}`,
            animation: `cardIn 0.55s ${i * 80}ms both cubic-bezier(.2,.85,.25,1)`,
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={d.src} alt={d.name} style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', display: 'block' }} />
            <div style={{ padding: '10px 12px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.ink, fontFamily: fonts.ui }}>{d.name}</div>
              <div style={{ fontSize: 10, color: T.pinkDeep, marginTop: 2, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>{d.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{
        background: `linear-gradient(135deg, ${T.cream}, ${T.rose})`,
        borderRadius: 16, padding: '14px 18px', textAlign: 'center',
        marginBottom: 6, border: `1px solid ${T.pinkSoft}`,
      }}>
        <div style={{ fontFamily: fonts.display, fontSize: 16, fontWeight: 600, color: T.ink, marginBottom: 2 }}>
          Juliane Cost
        </div>
        <div style={{ fontSize: 11, color: T.pinkDeep, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>
          Tricologista · Especialista em cabelo feminino
        </div>
      </div>
    </div>
  )
}

function InfoScreen({ q, onContinue, images }: { q: QuizStep; onContinue: () => void; images: Record<string, string> }) {
  const videoSrc = images['plano_capilar_juliane_video'] || 'https://player-vz-a21ca3b7-7bf.tv.pandavideo.com.br/embed/?v=66a4914a-6513-4d27-804b-2c3b1d32880d'
  const beforeAfterSrc = images['plano_capilar_before_after'] || '/images/ju-depois.png'
  const bioPhotoSrc = images['plano_capilar_juliane_bio'] || '/images/ju-foto.jpg'

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '4px 24px 24px', gap: 18 }}>
      {q.media === 'juliane_video' && <InfoMediaJulianeVideo src={videoSrc} />}
      {q.media === 'before_after' && (
        <>
          <h2 style={{
            fontSize: 24, fontFamily: fonts.display, fontWeight: 600,
            color: T.pinkDeep, lineHeight: 1.25, textAlign: 'center', margin: '8px 0 4px',
            letterSpacing: -0.3,
          }}>{q.title}</h2>
          {q.body && (
            <div style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.6, textAlign: 'center', marginBottom: 6, fontFamily: fonts.ui }}>
              <FmtText>{q.body}</FmtText>
            </div>
          )}
          <InfoMediaBeforeAfter src={beforeAfterSrc} />
        </>
      )}
      {q.media === 'juliane_video' && q.title && (
        <>
          <h2 style={{
            fontSize: 24, fontFamily: fonts.display, fontWeight: 600, color: T.ink,
            lineHeight: 1.25, textAlign: 'center', margin: '12px 0 4px', letterSpacing: -0.3,
          }}>
            {q.title}
          </h2>
          {q.body && (
            <div style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.65, whiteSpace: 'pre-line', textAlign: 'center', fontFamily: fonts.ui }}>
              <FmtText>{q.body}</FmtText>
            </div>
          )}
        </>
      )}
      {q.media === 'juliane_bio' && (
        <>
          <h2 style={{
            fontSize: 22, fontFamily: fonts.display, fontWeight: 600, color: T.pinkDeep,
            lineHeight: 1.25, textAlign: 'center', margin: '8px 0 16px', letterSpacing: -0.3,
          }}>
            {q.title}
          </h2>
          <InfoBio photoSrc={bioPhotoSrc} />
        </>
      )}
      {q.media === 'depoimentos' && <InfoDepoimentos images={images} />}

      <div style={{ marginTop: 'auto', paddingTop: 14, position: 'sticky', bottom: 0, background: 'transparent', paddingBottom: 4 }}>
        <ContinueButton onClick={onContinue} label={q.ctaText ?? 'Continuar'} />
      </div>
    </div>
  )
}

// ─── Tela: loading com sparkles ───────────────────────────────
function LoadingScreen({ q, pct }: { q: QuizStep; pct: number }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: 32, gap: 24, position: 'relative',
    }}>
      {/* Anel animado com gradient */}
      <div style={{
        position: 'relative', width: 120, height: 120,
      }}>
        <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
          <defs>
            <linearGradient id="loadingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={T.gold} />
              <stop offset="50%" stopColor={T.pink} />
              <stop offset="100%" stopColor={T.pinkDeep} />
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" r="50" fill="none" stroke={T.pinkSoft} strokeWidth="6" />
          <circle
            cx="60" cy="60" r="50" fill="none"
            stroke="url(#loadingGrad)" strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 50}
            strokeDashoffset={(1 - pct) * 2 * Math.PI * 50}
            style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(.2,.7,.3,1)' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: fonts.display, fontSize: 32, fontWeight: 600, color: T.ink, letterSpacing: -1,
        }}>
          {Math.round(pct * 100)}%
        </div>
      </div>
      <h2 style={{
        fontSize: 18, fontWeight: 600, color: T.ink,
        fontFamily: fonts.display,
        lineHeight: 1.4, textAlign: 'center', margin: 0, maxWidth: 320,
        letterSpacing: -0.2,
      }}>
        {q.title}
      </h2>
      <div style={{ display: 'flex', gap: 6 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: '50%',
            background: T.pink,
            animation: `dotPulse 1.4s ${i * 0.2}s ease-in-out infinite`,
          }} />
        ))}
      </div>
    </div>
  )
}

// ─── Phone screen ─────────────────────────────────────────────
function PhoneScreen({ q, value, onChange, onSubmit }: {
  q: QuizStep
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
}) {
  const [focused, setFocused] = useState(false)
  const formatPhone = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11)
    if (d.length <= 2) return d
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  }
  const valid = value.replace(/\D/g, '').length >= 10

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 24px 24px' }}>
      <h2 style={{
        fontSize: 26, fontFamily: fonts.display, fontWeight: 600, color: T.ink,
        lineHeight: 1.2, textAlign: 'center', margin: '0 0 22px', letterSpacing: -0.4,
      }}>
        {q.title}
      </h2>
      {q.subtitle && (
        <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 8, fontFamily: fonts.ui, fontWeight: 500 }}>
          {q.subtitle}
        </div>
      )}
      <input
        type="tel" inputMode="tel" autoComplete="tel"
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={e => onChange(formatPhone(e.target.value))}
        placeholder={q.placeholder}
        style={{
          width: '100%', padding: '20px 22px', fontSize: 17, fontFamily: fonts.ui,
          color: T.ink, background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(12px)',
          border: `1.5px solid ${focused ? T.pink : 'rgba(196,140,150,0.18)'}`,
          borderRadius: 18, outline: 'none', boxSizing: 'border-box',
          boxShadow: focused
            ? `0 0 0 4px ${T.pink}22, 0 8px 20px rgba(190,24,93,0.08)`
            : '0 2px 8px rgba(190,24,93,0.05)',
          marginBottom: 18, fontWeight: 500, transition: 'all 0.25s',
          letterSpacing: 0.3,
        }}
      />
      <ContinueButton disabled={!valid} onClick={onSubmit} label={q.ctaText ?? 'Continuar'} />
    </div>
  )
}

// ─── Name + email ─────────────────────────────────────────────
function NameEmailScreen({ q, name, email, onChangeName, onChangeEmail, onSubmit, loading }: {
  q: QuizStep
  name: string; email: string
  onChangeName: (v: string) => void
  onChangeEmail: (v: string) => void
  onSubmit: () => void
  loading: boolean
}) {
  const [nameFocus, setNameFocus] = useState(false)
  const [emailFocus, setEmailFocus] = useState(false)
  const valid = name.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const inp = (focused: boolean): React.CSSProperties => ({
    width: '100%', padding: '20px 22px', fontSize: 17, fontFamily: fonts.ui,
    color: T.ink, background: 'rgba(255,255,255,0.85)',
    backdropFilter: 'blur(12px)',
    border: `1.5px solid ${focused ? T.pink : 'rgba(196,140,150,0.18)'}`,
    borderRadius: 18, outline: 'none', boxSizing: 'border-box',
    boxShadow: focused
      ? `0 0 0 4px ${T.pink}22, 0 8px 20px rgba(190,24,93,0.08)`
      : '0 2px 8px rgba(190,24,93,0.05)',
    fontWeight: 500, transition: 'all 0.25s',
  })
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 24px 24px' }}>
      <h2 style={{
        fontSize: 26, fontFamily: fonts.display, fontWeight: 600, color: T.ink,
        lineHeight: 1.2, textAlign: 'center', margin: '0 0 26px', letterSpacing: -0.4,
      }}>
        {q.title}
      </h2>
      <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 6, fontFamily: fonts.ui, fontWeight: 500 }}>Nome e sobrenome...</div>
      <input
        type="text" placeholder="Digite seu nome..."
        value={name} onChange={e => onChangeName(e.target.value)}
        onFocus={() => setNameFocus(true)} onBlur={() => setNameFocus(false)}
        style={{ ...inp(nameFocus), marginBottom: 16 }}
      />
      <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 6, fontFamily: fonts.ui, fontWeight: 500 }}>E-mail</div>
      <input
        type="email" inputMode="email" autoComplete="email" placeholder="Digite seu e-mail..."
        value={email} onChange={e => onChangeEmail(e.target.value)}
        onFocus={() => setEmailFocus(true)} onBlur={() => setEmailFocus(false)}
        style={{ ...inp(emailFocus), marginBottom: 18 }}
      />
      <ContinueButton disabled={!valid || loading} onClick={onSubmit} label={loading ? 'Enviando…' : (q.ctaText ?? 'Continuar')} />
    </div>
  )
}

// ─── Calcular nível ───────────────────────────────────────────
function computeLevel(answers: QuizAnswers): { level: 'BAIXO' | 'MÉDIO' | 'ALTO'; idx: number } {
  let score = 0
  const chemicals = (answers.quimica as string[]) ?? []
  if (chemicals.includes('nenhuma')) score += 2
  else if (chemicals.length <= 1) score += 1
  const heat = (answers.calor as string[]) ?? []
  if (heat.includes('nenhum')) score += 2
  else if (heat.length === 1) score += 1
  if (answers.agua === '3' || answers.agua === '4+') score += 1
  if (answers.protetor === 'sim') score += 1
  if (answers.caspa === 'nao') score += 1
  if (answers.cronograma === 'sim') score += 1
  const probs = (answers.incomoda as string[]) ?? []
  if (probs.length >= 4) score -= 1
  if (score >= 5) return { level: 'ALTO', idx: 4 }
  if (score >= 3) return { level: 'MÉDIO', idx: 2 }
  return { level: 'BAIXO', idx: 1 }
}

// ─── Tela: nível resultado ────────────────────────────────────
function LevelScreen({ q, answers, onContinue }: {
  q: QuizStep
  answers: QuizAnswers
  onContinue: () => void
}) {
  const { level, idx } = computeLevel(answers)
  const labels = ['Crítico', 'Baixo', 'Normal', 'Médio', 'Alto']
  const points = [
    { x: 30, y: 145 }, { x: 110, y: 110 }, { x: 190, y: 75 },
    { x: 270, y: 40 }, { x: 350, y: 18 },
  ]
  const pos = points[idx]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 20px 24px' }}>
      <div style={{
        background: `linear-gradient(135deg, ${T.rose}, ${T.pinkSoft})`,
        borderRadius: 18, padding: '14px 18px', textAlign: 'center',
        margin: '12px 0 18px', border: `1px solid ${T.pinkSoft}`,
        animation: 'cardIn 0.6s cubic-bezier(.2,.85,.25,1)',
      }}>
        <div style={{ fontSize: 14, fontFamily: fonts.ui, fontWeight: 600, color: T.inkSoft, marginBottom: 2 }}>
          {q.title}
        </div>
        <div style={{
          fontFamily: fonts.display, fontSize: 28, fontWeight: 700, color: T.pinkDeep,
          letterSpacing: -0.5,
        }}>
          {level}
        </div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 10, fontFamily: fonts.ui }}>Nível de cuidados e rotina com o cabelo</div>

      {/* Gráfico */}
      <div style={{
        position: 'relative', width: '100%', marginBottom: 22,
        background: '#fff', borderRadius: 18, padding: 14,
        border: `1px solid ${T.border}`,
        boxShadow: '0 8px 20px rgba(190,24,93,0.06)',
      }}>
        <svg width="100%" height="180" viewBox="0 0 380 180" style={{ display: 'block' }}>
          <defs>
            <linearGradient id="gradLevel" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22D3EE" />
              <stop offset="25%" stopColor="#FACC15" />
              <stop offset="50%" stopColor="#FB923C" />
              <stop offset="75%" stopColor="#FB7185" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>
            <linearGradient id="gradFill" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FB7185" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#FB7185" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`M${points.map(p => `${p.x},${p.y}`).join(' L')}`} stroke="url(#gradLevel)" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <path d={`M${points[0].x},${points[0].y} L${points.map(p => `${p.x},${p.y}`).join(' L')} L${points[4].x},170 L${points[0].x},170 Z`} fill="url(#gradFill)" />
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={i === idx ? 8 : 4} fill={i === idx ? T.pink : '#fff'} stroke={i === idx ? T.pinkDeep : T.border} strokeWidth="2" />
          ))}
          <g transform={`translate(${pos.x - 26}, ${pos.y - 36})`}>
            <rect x="0" y="0" width="52" height="22" rx="11" fill={T.pinkDeep} />
            <text x="26" y="15" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" fontFamily={fonts.ui}>Você</text>
          </g>
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 8px', marginTop: 6 }}>
          {labels.map(l => <span key={l} style={{ fontSize: 11, color: T.inkMuted, fontFamily: fonts.ui, fontWeight: 500 }}>{l}</span>)}
        </div>
      </div>

      <div style={{
        background: `linear-gradient(135deg, ${T.rose}, ${T.cream})`,
        borderRadius: 16, padding: '14px 18px', marginBottom: 18,
        border: `1px solid ${T.pinkSoft}`,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.pinkDeep, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>⚠</span> Nível {level}
        </div>
        <div style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.5, fontFamily: fonts.ui }}>
          Você precisa urgentemente mudar sua rotina capilar para ter resultados melhores
        </div>
      </div>

      <div style={{ fontSize: 14, fontFamily: fonts.display, fontWeight: 600, color: T.ink, marginBottom: 12, textAlign: 'center', letterSpacing: -0.2 }}>
        Análise dos motivos pelas quais você não tem o cabelo dos seus sonhos
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
        {[
          { icon: '🧠', title: 'Melhorar a alimentação', desc: 'Você precisa de algumas vitaminas para que seu cabelo seja mais forte' },
          { icon: '📋', title: 'Rotina de cuidados', desc: 'Você precisa ter um cronograma de cuidados personalizado' },
          { icon: '🎯', title: 'Comprar os produtos certos', desc: 'Pare de gastar dinheiro com produtos baratos que não te ajudam em nada' },
        ].map((c, i) => (
          <div key={i} style={{
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(12px)',
            border: `1px solid ${T.border}`,
            borderRadius: 16, padding: '14px 12px',
            gridColumn: i === 2 ? 'span 2' : 'auto',
            boxShadow: '0 4px 12px rgba(190,24,93,0.05)',
            animation: `cardIn 0.5s ${i * 80}ms both cubic-bezier(.2,.85,.25,1)`,
          }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>{c.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 4, fontFamily: fonts.ui }}>{c.title}</div>
            <div style={{ fontSize: 11, color: T.inkSoft, lineHeight: 1.5, fontFamily: fonts.ui }}>{c.desc}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 8 }}>
        <ContinueButton onClick={onContinue} label={q.ctaText ?? 'Continuar'} />
      </div>
    </div>
  )
}

// ─── Plano pronto ─────────────────────────────────────────────
function PlanReadyScreen({ q, onContinue }: { q: QuizStep; onContinue: () => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 20px 24px' }}>
      <div style={{
        textAlign: 'center', margin: '12px 0 8px',
        animation: 'celebrate 0.7s cubic-bezier(.2,1.5,.3,1)',
      }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>✨</div>
        <h2 style={{
          fontSize: 18, fontFamily: fonts.ui, fontWeight: 700,
          color: T.pinkDeep, letterSpacing: 1, textTransform: 'uppercase',
          margin: '0 0 14px',
        }}>
          Seu Plano está pronto
        </h2>
      </div>
      <h3 style={{
        fontSize: 22, fontFamily: fonts.display, fontWeight: 600, color: T.ink,
        textAlign: 'center', lineHeight: 1.25, margin: '0 0 14px', letterSpacing: -0.3,
      }}>
        Montamos um plano <em style={{ color: T.pinkDeep }}>exclusivo</em> para você ter um cabelo cheio, sem frizz e hidratado em até <strong style={{ fontWeight: 700 }}>90 dias</strong>
      </h3>
      {q.subtitle && (
        <div style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.6, textAlign: 'center', marginBottom: 22, fontFamily: fonts.ui }}>
          {q.subtitle}
        </div>
      )}

      <div style={{
        position: 'relative', marginBottom: 14,
        background: '#fff', borderRadius: 18, padding: 14,
        border: `1px solid ${T.border}`,
        boxShadow: '0 12px 28px rgba(190,24,93,0.08)',
      }}>
        <svg width="100%" height="200" viewBox="0 0 380 200">
          <defs>
            <linearGradient id="gradPlan" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FB7185" />
              <stop offset="50%" stopColor="#FACC15" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>
          </defs>
          <path d="M30,160 Q120,140 160,110 T280,55 L350,30" stroke="url(#gradPlan)" strokeWidth="4.5" fill="none" strokeLinecap="round" />
          <circle cx="30" cy="160" r="5" fill="#fff" stroke={T.inkMuted} strokeWidth="2" />
          <circle cx="105" cy="135" r="7" fill="#fff" stroke={T.pink} strokeWidth="2.5" />
          <circle cx="185" cy="100" r="5" fill="#fff" stroke="#FACC15" strokeWidth="2" />
          <circle cx="265" cy="65" r="5" fill="#fff" stroke="#10B981" strokeWidth="2" />
          <circle cx="350" cy="30" r="7" fill="#fff" stroke="#10B981" strokeWidth="2.5" />
          <g transform="translate(60, 110)">
            <rect x="0" y="0" width="86" height="22" rx="11" fill={T.pinkDeep} />
            <text x="43" y="15" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" fontFamily={fonts.ui}>Você hoje</text>
          </g>
          <g transform="translate(218, 30)">
            <rect x="0" y="0" width="128" height="22" rx="11" fill="#10B981" />
            <text x="64" y="15" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" fontFamily={fonts.ui}>Você em até 90 dias</text>
          </g>
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 8px', marginTop: 6 }}>
          {['Baixo', 'Aceitável', 'Normal', 'Bom', 'Ótimo'].map(l => (
            <span key={l} style={{ fontSize: 11, color: T.inkMuted, fontFamily: fonts.ui, fontWeight: 500 }}>{l}</span>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 12 }}>
        <ContinueButton onClick={onContinue} label={q.ctaText ?? 'Continuar'} />
      </div>
    </div>
  )
}

// ─── Mini depoimentos ─────────────────────────────────────────
function MiniTestiScreen({ q, name, onContinue }: { q: QuizStep; name: string; onContinue: () => void }) {
  const testis = [
    { name: 'Fernanda Sanoli', handle: '@fernandasanoli', text: 'Finalmente consegui volume e brilho no meu cabelo! Cresceu muito rápido e ficou incrível, sem frizz!' },
    { name: 'Daniela Mendes', handle: '@daniel_1989oficial', text: 'Eu achava que não havia solução p meu cabelo por causa das químicas que usei por anos, mas o método de transformação capilar me provou o contrário. Áreas estão longas, alinhadas, brilhantes e extremamente hidratadas.' },
    { name: 'Maria Santana', handle: '@mariasilv', text: 'Meu cabelo voltou a brilhar e crescer como nunca! Sem frizz, super liso e hidratado, mesmo depois de químicas.' },
  ]
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 20px 24px' }}>
      <div style={{
        fontSize: 22, fontFamily: fonts.display, fontWeight: 600, color: T.ink,
        lineHeight: 1.3, margin: '12px 0 8px', letterSpacing: -0.3,
      }}>
        <strong style={{ color: T.pinkDeep, fontWeight: 700 }}>{name || 'Você'}</strong>, você será a próxima <em style={{ fontStyle: 'italic' }}>transformação</em>
      </div>
      <div style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.6, marginBottom: 18, fontFamily: fonts.ui }}>
        Você vai conquistar o cabelo dos seus sonhos com o plano capilar que eu fiz para você completamente adaptável a sua jornada!
      </div>
      <div style={{
        fontSize: 16, fontFamily: fonts.display, fontWeight: 600, color: T.ink,
        marginBottom: 4, letterSpacing: -0.2,
      }}>
        Depoimentos das meninas
      </div>
      <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 14, fontFamily: fonts.ui }}>
        Hoje somos mais de 43 mil mulheres que aplicam esse método personalizado e individual
      </div>

      <div style={{ marginBottom: 14 }}>
        <ContinueButton onClick={onContinue} label={q.ctaText ?? 'Continuar'} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {testis.map((t, i) => (
          <div key={i} style={{
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(12px)',
            border: `1px solid ${T.border}`,
            borderRadius: 18, padding: '16px 16px',
            boxShadow: '0 4px 12px rgba(190,24,93,0.06)',
            animation: `cardIn 0.5s ${i * 80}ms both cubic-bezier(.2,.85,.25,1)`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%',
                background: `linear-gradient(135deg, ${T.pink}, ${T.pinkDeep})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, color: '#fff', fontSize: 15, fontFamily: fonts.ui,
                boxShadow: `0 4px 10px ${T.pink}44`,
              }}>
                {t.name.charAt(0)}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, fontFamily: fonts.ui }}>{t.name}</div>
                <div style={{ fontSize: 11, color: T.inkSoft, fontFamily: fonts.mono }}>{t.handle}</div>
              </div>
              <div style={{ marginLeft: 'auto', color: T.gold, fontSize: 13, letterSpacing: 1 }}>★★★★★</div>
            </div>
            <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.55, fontFamily: fonts.ui }}>{t.text}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ╔═══════════════════════════════════════════════════════════╗
// ║                Main component                             ║
// ╚═══════════════════════════════════════════════════════════╝
export default function QuizClient() {
  const router = useRouter()
  const [stepIndex, setStepIndex] = useState(0)
  const [answers, setAnswers] = useState<QuizAnswers>({})
  const [phoneInput, setPhoneInput] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [textInput, setTextInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [images, setImages] = useState<Record<string, string>>({})
  const total = QUIZ_STEPS.length
  const step = QUIZ_STEPS[stepIndex]
  const pct = useFakeProgress(stepIndex, total)
  const trackedRef = useRef(false)

  useEffect(() => { trackView() }, [])

  useEffect(() => {
    fetch('/api/quiz/images')
      .then(r => r.json())
      .then((data: Record<string, string>) => {
        if (data && typeof data === 'object') setImages(data)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (step?.kind === 'loading') {
      const t = setTimeout(() => setStepIndex(i => Math.min(total - 1, i + 1)), 3500)
      return () => clearTimeout(t)
    }
  }, [stepIndex, step, total])

  useEffect(() => {
    if (step?.kind === 'textarea') {
      const prior = answers[step.id]
      setTextInput(typeof prior === 'string' ? prior : '')
    }
  }, [stepIndex])  // eslint-disable-line react-hooks/exhaustive-deps

  const goNext = useCallback(() => setStepIndex(i => Math.min(total - 1, i + 1)), [total])
  const goBack = useCallback(() => setStepIndex(i => Math.max(0, i - 1)), [])

  const choose = useCallback((qid: string, v: string) => {
    setAnswers(a => ({ ...a, [qid]: v }))
    setTimeout(() => setStepIndex(i => Math.min(total - 1, i + 1)), 320)
  }, [total])

  const toggleMulti = useCallback((qid: string, v: string) => {
    setAnswers(a => {
      const cur = (a[qid] as string[] | undefined) ?? []
      const next = cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v]
      return { ...a, [qid]: next }
    })
  }, [])

  const saveTextarea = useCallback(() => {
    if (!step) return
    setAnswers(a => ({ ...a, [step.id]: textInput.trim() }))
    setTimeout(() => setStepIndex(i => Math.min(total - 1, i + 1)), 100)
  }, [step, textInput, total])

  const savePhone = useCallback(() => {
    if (!step) return
    setAnswers(a => ({ ...a, phone: phoneInput.replace(/\D/g, '') }))
    setTimeout(() => setStepIndex(i => Math.min(total - 1, i + 1)), 100)
  }, [step, phoneInput, total])

  const submitNameEmail = useCallback(async () => {
    setSubmitting(true)
    const finalAnswers = { ...answers, name: nameInput.trim(), email: emailInput.trim(), phone: phoneInput.replace(/\D/g, '') }
    if (!trackedRef.current) {
      trackAnswers(finalAnswers)
      trackedRef.current = true
    }
    setAnswers(finalAnswers)
    try { localStorage.setItem('quiz_answers', JSON.stringify(finalAnswers)) } catch {}
    setSubmitting(false)
    setStepIndex(i => Math.min(total - 1, i + 1))
  }, [answers, nameInput, emailInput, phoneInput, total])

  const finalContinue = useCallback(() => {
    if (stepIndex >= total - 1) {
      try { localStorage.setItem('quiz_answers', JSON.stringify(answers)) } catch {}
      router.push('/oferta')
    } else {
      goNext()
    }
  }, [stepIndex, total, answers, router, goNext])

  const canBack = stepIndex > 0 && step?.kind !== 'loading'
  const showPercent = step?.kind === 'loading'

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400;1,9..144,500;1,9..144,600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes cardIn { from { opacity: 0; transform: translateY(14px) scale(.97); } to { opacity: 1; transform: none; } }
        @keyframes pageFade { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
        @keyframes shimmer { from { transform: translateX(-100%); } to { transform: translateX(180%); } }
        @keyframes gradientShift { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        @keyframes petalFloat {
          0%, 100% { transform: translateY(0) translateX(0) rotate(0deg); }
          25% { transform: translateY(-30px) translateX(15px) rotate(90deg); }
          50% { transform: translateY(-10px) translateX(-15px) rotate(180deg); }
          75% { transform: translateY(20px) translateX(10px) rotate(270deg); }
        }
        @keyframes petalSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes sparkleBurst {
          0% { opacity: 1; transform: translate(-50%, -50%) translate(0, 0) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) translate(var(--bx), var(--by)) scale(0.3); }
        }
        @keyframes checkPop {
          0% { opacity: 0; transform: scale(0); }
          60% { opacity: 1; transform: scale(1.25); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes mediaZoomIn {
          from { opacity: 0; transform: scale(0.92) translateY(12px); }
          to { opacity: 1; transform: none; }
        }
        @keyframes dotPulse {
          0%, 100% { opacity: 0.3; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes celebrate {
          0% { opacity: 0; transform: scale(0.6) rotate(-10deg); }
          60% { opacity: 1; transform: scale(1.1) rotate(5deg); }
          100% { opacity: 1; transform: scale(1) rotate(0); }
        }
        input::placeholder, textarea::placeholder {
          color: ${T.inkMuted}; opacity: 0.85; font-weight: 400; font-style: italic;
        }
      `}</style>
      <div style={{
        minHeight: '100svh', position: 'relative',
        background: `
          radial-gradient(circle at 20% 0%, ${T.rose} 0%, transparent 45%),
          radial-gradient(circle at 80% 100%, ${T.champagne} 0%, transparent 50%),
          ${T.bg}
        `,
        fontFamily: fonts.ui, color: T.ink,
        display: 'flex', flexDirection: 'column',
        WebkitTapHighlightColor: 'transparent',
        overflowX: 'hidden',
      }}>
        <FloatingPetals />
        <div style={{
          width: '100%', maxWidth: 480, margin: '0 auto', flex: 1,
          display: 'flex', flexDirection: 'column', minHeight: '100svh',
          position: 'relative', zIndex: 1,
        }}>
          <Header pct={pct} canBack={canBack} onBack={goBack} showPercent={showPercent} />

          <div key={stepIndex} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            animation: 'pageFade 0.5s cubic-bezier(.2,.85,.25,1)',
            paddingTop: 8,
          }}>
            {step?.kind === 'single' && (
              <SingleScreen q={step} value={answers[step.id] as string | undefined} onChoose={(v) => choose(step.id, v)} />
            )}
            {step?.kind === 'multi' && (
              <MultiScreen q={step} value={(answers[step.id] as string[] | undefined) ?? []} onToggle={(v) => toggleMulti(step.id, v)} onContinue={goNext} />
            )}
            {step?.kind === 'textarea' && (
              <TextareaScreen q={step} value={textInput} onChange={setTextInput} onContinue={saveTextarea} />
            )}
            {step?.kind === 'info' && <InfoScreen q={step} onContinue={goNext} images={images} />}
            {step?.kind === 'loading' && <LoadingScreen q={step} pct={pct} />}
            {step?.kind === 'phone' && (
              <PhoneScreen q={step} value={phoneInput} onChange={setPhoneInput} onSubmit={savePhone} />
            )}
            {step?.kind === 'name_email' && (
              <NameEmailScreen
                q={step} name={nameInput} email={emailInput}
                onChangeName={setNameInput} onChangeEmail={setEmailInput}
                onSubmit={submitNameEmail} loading={submitting}
              />
            )}
            {step?.kind === 'level' && <LevelScreen q={step} answers={answers} onContinue={goNext} />}
            {step?.kind === 'plan_ready' && <PlanReadyScreen q={step} onContinue={goNext} />}
            {step?.kind === 'mini_testi' && <MiniTestiScreen q={step} name={nameInput} onContinue={finalContinue} />}
          </div>
        </div>
      </div>
    </>
  )
}
