'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { QUIZ_STEPS, QuizAnswers, QuizStep } from '../../../lib/quiz-questions'

// ─── Design tokens ──────────────────────────────────────────
const T = {
  bg: '#FFFFFF',
  ink: '#0E0E0E',
  inkSoft: '#6B7280',
  border: '#E5E7EB',
  borderSoft: '#F3F4F6',
  pink: '#EC4899',
  pinkDeep: '#DB2777',
  pinkTrack: '#FBCFE8',
  pinkTrackSoft: '#FCE7F3',
  purple: '#7C3AED',
  shadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)',
}

const fontUi = '"Plus Jakarta Sans", "Inter", -apple-system, system-ui, sans-serif'

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

// ─── Texto formatado com **bold** *italic* ───────────────────
function FmtText({ children }: { children: string }) {
  const parts = String(children).split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean)
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('**')) {
          const inner = p.slice(2, -2)
          if (inner === 'Plano Ideal') {
            return <strong key={i} style={{ color: T.purple, fontWeight: 800 }}>{inner}</strong>
          }
          if (inner === '90 Dias') {
            return <strong key={i} style={{ color: T.ink, fontWeight: 800, borderBottom: `2px solid ${T.ink}`, paddingBottom: 1 }}>{inner}</strong>
          }
          return <strong key={i} style={{ fontWeight: 700 }}>{inner}</strong>
        }
        if (p.startsWith('*') && !p.startsWith('**')) {
          return <em key={i} style={{ fontStyle: 'italic' }}>{p.slice(1, -1)}</em>
        }
        return <span key={i}>{p}</span>
      })}
    </>
  )
}

// ─── Hook de progresso animado ───────────────────────────────
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

// ─── Header (back + progress) ────────────────────────────────
function Header({ pct, canBack, onBack, showPercent }: { pct: number; canBack: boolean; onBack: () => void; showPercent?: boolean }) {
  return (
    <div style={{ padding: '20px 24px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ height: 24, display: 'flex', alignItems: 'center' }}>
        {canBack ? (
          <button
            onClick={onBack}
            aria-label="Voltar"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: T.ink }}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 4l-7 7 7 7" />
            </svg>
          </button>
        ) : <div style={{ width: 22, height: 22 }} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, height: 6, background: T.pinkTrackSoft, borderRadius: 99, overflow: 'hidden', position: 'relative' }}>
          <div style={{
            position: 'absolute', inset: 0, width: `${pct * 100}%`,
            background: `linear-gradient(90deg, ${T.pink}, ${T.pinkDeep})`,
            borderRadius: 99,
            transition: 'width 0.6s cubic-bezier(.2,.7,.3,1)',
          }} />
        </div>
        {showPercent && (
          <div style={{ fontSize: 13, fontWeight: 600, color: T.inkSoft, minWidth: 36, textAlign: 'right' }}>
            {Math.round(pct * 100)}%
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Continue button (pink rounded) ──────────────────────────
function ContinueButton({ disabled, onClick, label = 'Continuar' }: { disabled?: boolean; onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        background: disabled ? '#F9A8D4' : T.pink,
        color: '#fff',
        border: 'none', borderRadius: 99,
        padding: '18px',
        fontSize: 17, fontWeight: 600,
        fontFamily: fontUi,
        cursor: disabled ? 'default' : 'pointer',
        transition: 'all 0.2s',
        boxShadow: disabled ? 'none' : '0 4px 12px rgba(236,72,153,0.25)',
      }}
    >{label}</button>
  )
}

// ─── Color swatch ─────────────────────────────────────────────
function ColorSwatch({ color, size = 28 }: { color: string; size?: number }) {
  const lighter = (() => {
    const c = color.replace('#', '')
    const num = parseInt(c.length === 3 ? c.split('').map(x => x + x).join('') : c, 16)
    const r = Math.min(255, ((num >> 16) & 0xff) + 50)
    const g = Math.min(255, ((num >> 8) & 0xff) + 50)
    const b = Math.min(255, (num & 0xff) + 50)
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)
  })()
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `radial-gradient(circle at 35% 30%, ${lighter}, ${color} 65%)`,
      boxShadow: 'inset 0 -2px 4px rgba(0,0,0,0.18), inset 0 1px 2px rgba(255,255,255,0.25)',
      flexShrink: 0,
    }} />
  )
}

// ─── Card de opção (single) ───────────────────────────────────
function SingleCard({ option, selected, onClick, indexDelay, hasColorSwatch }: {
  option: { id: string; label: string; color?: string }
  selected: boolean
  onClick: () => void
  indexDelay: number
  hasColorSwatch: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: '#fff',
        border: `1px solid ${selected ? T.pink : T.border}`,
        borderRadius: 14,
        padding: '18px 18px',
        display: 'flex', alignItems: 'center', gap: 12,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: fontUi,
        boxShadow: selected ? `0 0 0 2px ${T.pinkTrackSoft}, ${T.shadow}` : T.shadow,
        transition: 'all 0.2s',
        animation: `qOptIn 0.35s ${indexDelay}ms both cubic-bezier(.2,.7,.3,1)`,
        width: '100%',
      }}
    >
      {hasColorSwatch && option.color && <ColorSwatch color={option.color} />}
      <span style={{ flex: 1, fontSize: 16, color: T.ink, fontWeight: 500, lineHeight: 1.3 }}>
        <FmtText>{option.label}</FmtText>
      </span>
      <span style={{
        width: 28, height: 28, borderRadius: '50%',
        border: `1px solid ${T.border}`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        color: T.inkSoft,
      }}>
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 2l4 4-4 4" />
        </svg>
      </span>
    </button>
  )
}

// ─── Card de opção (multi, com checkbox) ──────────────────────
function MultiCard({ option, selected, onClick, indexDelay }: {
  option: { id: string; label: string }
  selected: boolean
  onClick: () => void
  indexDelay: number
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: '#fff',
        border: `1px solid ${selected ? T.pink : T.border}`,
        borderRadius: 14,
        padding: '18px 18px',
        display: 'flex', alignItems: 'center', gap: 12,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: fontUi,
        boxShadow: selected ? `0 0 0 2px ${T.pinkTrackSoft}, ${T.shadow}` : T.shadow,
        transition: 'all 0.2s',
        animation: `qOptIn 0.35s ${indexDelay}ms both cubic-bezier(.2,.7,.3,1)`,
        width: '100%',
      }}
    >
      <span style={{ flex: 1, fontSize: 16, color: T.ink, fontWeight: 500, lineHeight: 1.3 }}>
        {option.label}
      </span>
      <span style={{
        width: 24, height: 24, borderRadius: 6,
        border: `1.5px solid ${selected ? T.pink : T.border}`,
        background: selected ? T.pink : 'transparent',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        transition: 'all 0.2s',
      }}>
        {selected && (
          <svg width="13" height="11" viewBox="0 0 13 11" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 5.5l3.5 3.5L12 1" />
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
  // 4 opções (não cor) → 2x2 grid
  const useGrid = !isCor && opts.length === 4

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 24px 24px' }}>
      {q.intro && (
        <div style={{
          fontSize: 24, lineHeight: 1.3, fontWeight: 700, color: T.ink,
          marginBottom: 28, textAlign: 'center',
        }}>
          <FmtText>{q.intro}</FmtText>
        </div>
      )}
      <h2 style={{
        fontSize: q.intro ? 22 : 26,
        fontWeight: 800, color: T.ink, lineHeight: 1.2,
        textAlign: q.intro ? 'center' : 'center',
        margin: q.intro ? '0 0 20px' : '0 0 16px',
      }}>{q.title}</h2>

      {q.subtitle && !q.intro && (
        <div style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.5, textAlign: 'center', marginBottom: 22 }}>
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
            indexDelay={i * 50}
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
      <h2 style={{ fontSize: 26, fontWeight: 800, color: T.ink, lineHeight: 1.2, textAlign: 'center', margin: '20px 0 22px' }}>
        {q.title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {opts.map((opt, i) => (
          <MultiCard
            key={opt.id}
            option={opt}
            selected={value.includes(opt.id)}
            onClick={() => onToggle(opt.id)}
            indexDelay={i * 40}
          />
        ))}
      </div>
      <div style={{ marginTop: 'auto', paddingTop: 16 }}>
        <ContinueButton disabled={!canContinue} onClick={onContinue} />
      </div>
    </div>
  )
}

// ─── Tela: textarea (produtos em casa) ────────────────────────
function TextareaScreen({ q, value, onChange, onContinue }: {
  q: QuizStep
  value: string
  onChange: (v: string) => void
  onContinue: () => void
}) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 24px 24px' }}>
      <h2 style={{ fontSize: 26, fontWeight: 800, color: T.ink, lineHeight: 1.2, textAlign: 'center', margin: '12px 0 18px' }}>
        {q.title}
      </h2>
      {q.subtitle && (
        <div style={{ fontSize: 14, color: T.inkSoft, marginBottom: 8 }}>{q.subtitle}</div>
      )}
      <textarea
        value={value}
        onChange={e => onChange(e.target.value.slice(0, 200))}
        placeholder={q.placeholder}
        rows={4}
        style={{
          width: '100%',
          padding: '16px 18px',
          fontSize: 16,
          fontFamily: fontUi,
          color: T.ink,
          background: '#fff',
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          outline: 'none',
          boxSizing: 'border-box',
          boxShadow: T.shadow,
          resize: 'none',
        }}
      />
      <div style={{ fontSize: 12, color: T.inkSoft, textAlign: 'right', marginTop: 4 }}>{value.length}/200</div>
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
      width: '100%', borderRadius: 18, overflow: 'hidden',
      aspectRatio: '9/13', background: '#000',
      boxShadow: '0 12px 28px rgba(0,0,0,0.12)', position: 'relative',
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
    <div style={{ width: '100%', borderRadius: 14, overflow: 'hidden', background: '#F3F4F6' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Resultado capilar" style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'contain' }} />
    </div>
  )
}

function InfoBio({ photoSrc }: { photoSrc: string }) {
  return (
    <div>
      <div style={{ width: '100%', maxWidth: 240, margin: '0 auto 16px', borderRadius: 18, overflow: 'hidden' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoSrc} alt="Juliane Cost" style={{ width: '100%', height: 'auto', display: 'block' }} />
      </div>
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, marginBottom: 4 }}>
          Juliane Cost — TRICOLOGISTA
        </div>
        <div style={{ fontSize: 13, color: T.inkSoft }}>
          especialista em cabelo feminino
        </div>
      </div>
      <div style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.6 }}>
        Prazer, sou a <strong style={{ color: T.ink }}>Juliane Cost</strong> especialista em recuperação de cabelos femininos.
        <br /><br />
        Meu trabalho começou ajudando mulheres modificando hábitos e comprando os produtos certos.
        <br /><br />
        Eu sei que é difícil cuidar do cabelo, principalmente quando não sabemos o que fazer ou se temos pouco tempo. Por isso, criei meu plano personalizado capilar que vai te ajudar mostrando passo-a-passo e diariamente o que você precisa fazer.
        <br /><br />
        Já são <strong style={{ color: T.ink }}>3.500 mulheres atendidas e individualmente</strong>. com casos reais que você verá durante seu plano.
        <br /><br />
        Esse plano vai te mostrar que cuidar de cabelo pode ser fácil e prazeroso. E o resultado da metodologia tem sido incrível.
        <br /><br />
        Além disso, você terá acesso a um <strong style={{ color: T.ink }}>grupo exclusivo de promoções no WhatsApp</strong>, com descontos diretos das fábricas que eu confio.
        <br /><br />
        <strong style={{ color: T.ink }}>Aprenda a cuidar do cabelo com produtos baratos com o seu plano capilar feito por mim.</strong>
      </div>
      <div style={{ marginTop: 16, fontSize: 13, color: T.ink, fontWeight: 600, textAlign: 'center' }}>
        Sem mais bla,bla,bla, apenas saberá o que fazer no seu cabelo, e sem mistérios.
      </div>
    </div>
  )
}

function InfoDepoimentos({ images }: { images: Record<string, string> }) {
  const fb = (key: string, fallback: string) => images[key] || fallback
  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: T.ink, lineHeight: 1.2, textAlign: 'center', margin: '0 0 20px' }}>
        Resultados de quem aplicou meu plano personalizado
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 18 }}>
        {[
          { src: fb('plano_capilar_depoimento_1', '/images/resultado-antes1.png'), name: 'Gabriela Bernicki', desc: 'Mudou a rotina e todos os produtos' },
          { src: fb('plano_capilar_depoimento_2', '/images/resultado-antes2.png'), name: 'Beatriz', desc: 'Plano capilar' },
          { src: fb('plano_capilar_depoimento_3', '/images/resultado-antes3.png'), name: 'Fernanda', desc: 'Plano capilar' },
          { src: fb('plano_capilar_depoimento_4', '/images/resultado-antes4.png'), name: 'Rafaela Nascimento', desc: 'Resultado real' },
        ].map((d, i) => (
          <div key={i} style={{ borderRadius: 12, overflow: 'hidden', background: '#F3F4F6' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={d.src} alt={d.name} style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', display: 'block' }} />
            <div style={{ padding: '8px 10px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.ink }}>{d.name}</div>
              <div style={{ fontSize: 10, color: T.inkSoft, marginTop: 1 }}>{d.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ background: T.pinkTrackSoft, borderRadius: 12, padding: '14px 16px', textAlign: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, marginBottom: 2 }}>
          Juliane Cost Tricologista
        </div>
        <div style={{ fontSize: 12, color: T.inkSoft }}>especialista em cabelo feminino</div>
      </div>
    </div>
  )
}

function InfoScreen({ q, onContinue, images }: { q: QuizStep; onContinue: () => void; images: Record<string, string> }) {
  const videoSrc = images['plano_capilar_juliane_video'] || 'https://player-vz-a21ca3b7-7bf.tv.pandavideo.com.br/embed/?v=66a4914a-6513-4d27-804b-2c3b1d32880d'
  const beforeAfterSrc = images['plano_capilar_before_after'] || '/images/ju-depois.png'
  const bioPhotoSrc = images['plano_capilar_juliane_bio'] || '/images/ju-foto.jpg'

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '4px 24px 24px', gap: 16 }}>
      {q.media === 'juliane_video' && <InfoMediaJulianeVideo src={videoSrc} />}
      {q.media === 'before_after' && (
        <>
          <h2 style={{
            fontSize: 22, fontWeight: 800, color: T.purple,
            lineHeight: 1.25, textAlign: 'center', margin: '8px 0 4px',
          }}>{q.title}</h2>
          {q.body && (
            <div style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.6, textAlign: 'center', marginBottom: 4 }}>
              <FmtText>{q.body}</FmtText>
            </div>
          )}
          <InfoMediaBeforeAfter src={beforeAfterSrc} />
        </>
      )}
      {q.media === 'juliane_video' && q.title && (
        <>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: T.ink, lineHeight: 1.25, textAlign: 'center', margin: '8px 0 4px' }}>{q.title}</h2>
          {q.body && (
            <div style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.6, whiteSpace: 'pre-line', textAlign: 'center' }}>
              <FmtText>{q.body}</FmtText>
            </div>
          )}
        </>
      )}
      {q.media === 'juliane_bio' && (
        <>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: T.pinkDeep, lineHeight: 1.25, textAlign: 'center', margin: '8px 0 12px' }}>
            {q.title}
          </h2>
          <InfoBio photoSrc={bioPhotoSrc} />
        </>
      )}
      {q.media === 'depoimentos' && <InfoDepoimentos images={images} />}

      <div style={{ marginTop: 'auto', paddingTop: 12, position: 'sticky', bottom: 0, background: T.bg, paddingBottom: 4 }}>
        <ContinueButton onClick={onContinue} label={q.ctaText ?? 'Continuar'} />
      </div>
    </div>
  )
}

// ─── Tela: loading ────────────────────────────────────────────
function LoadingScreen({ q, pct }: { q: QuizStep; pct: number }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 18 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: T.pinkDeep, lineHeight: 1.3, textAlign: 'center', margin: 0, maxWidth: 320 }}>
        {q.title}
      </h2>
      <div style={{ fontSize: 32, fontWeight: 800, color: T.ink }}>
        {Math.round(pct * 100)}%
      </div>
    </div>
  )
}

// ─── Tela: phone capture ──────────────────────────────────────
function PhoneScreen({ q, value, onChange, onSubmit }: {
  q: QuizStep
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
}) {
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
      <h2 style={{ fontSize: 22, fontWeight: 800, color: T.ink, lineHeight: 1.2, textAlign: 'center', margin: '0 0 18px' }}>
        {q.title}
      </h2>
      {q.subtitle && (
        <div style={{ fontSize: 14, color: T.inkSoft, marginBottom: 8 }}>{q.subtitle}</div>
      )}
      <input
        type="tel" inputMode="tel" autoComplete="tel"
        value={value}
        onChange={e => onChange(formatPhone(e.target.value))}
        placeholder={q.placeholder}
        style={{
          width: '100%', padding: '16px 18px', fontSize: 16, fontFamily: fontUi,
          color: T.ink, background: '#fff', border: `1px solid ${T.border}`,
          borderRadius: 14, outline: 'none', boxSizing: 'border-box', boxShadow: T.shadow,
          marginBottom: 14,
        }}
      />
      <ContinueButton disabled={!valid} onClick={onSubmit} label={q.ctaText ?? 'Continuar'} />
    </div>
  )
}

// ─── Tela: nome + email ───────────────────────────────────────
function NameEmailScreen({ q, name, email, onChangeName, onChangeEmail, onSubmit, loading }: {
  q: QuizStep
  name: string
  email: string
  onChangeName: (v: string) => void
  onChangeEmail: (v: string) => void
  onSubmit: () => void
  loading: boolean
}) {
  const valid = name.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '16px 18px', fontSize: 16, fontFamily: fontUi,
    color: T.ink, background: '#fff', border: `1px solid ${T.border}`,
    borderRadius: 14, outline: 'none', boxSizing: 'border-box', boxShadow: T.shadow,
  }
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 24px 24px' }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: T.ink, lineHeight: 1.2, textAlign: 'center', margin: '0 0 22px' }}>
        {q.title}
      </h2>
      <div style={{ fontSize: 14, color: T.inkSoft, marginBottom: 6 }}>Nome e sobrenome...</div>
      <input type="text" placeholder="Digite seu nome..." value={name} onChange={e => onChangeName(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />
      <div style={{ fontSize: 14, color: T.inkSoft, marginBottom: 6 }}>E-mail</div>
      <input type="email" inputMode="email" autoComplete="email" placeholder="Digite seu e-mail..." value={email} onChange={e => onChangeEmail(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />
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
  // Curva: 5 pontos (Crítico, Baixo, Normal, Médio, Alto)
  const labels = ['Crítico', 'Baixo', 'Normal', 'Médio', 'Alto']
  const points = [
    { x: 30,  y: 145 },
    { x: 110, y: 110 },
    { x: 190, y: 75 },
    { x: 270, y: 40 },
    { x: 350, y: 18 },
  ]
  const pos = points[idx]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 20px 24px' }}>
      <div style={{ background: T.pinkTrackSoft, borderRadius: 12, padding: '12px 16px', textAlign: 'center', margin: '12px 0 16px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.pinkDeep, marginBottom: 2 }}>
          {q.title} <strong style={{ color: T.pinkDeep }}>{level}</strong>
        </div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, marginBottom: 10 }}>Nível de cuidados e rotina com o cabelo</div>

      {/* Gráfico */}
      <div style={{ position: 'relative', width: '100%', marginBottom: 20 }}>
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
              <stop offset="0%" stopColor="#FB7185" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#FB7185" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`M${points.map(p => `${p.x},${p.y}`).join(' L')}`} stroke="url(#gradLevel)" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d={`M${points[0].x},${points[0].y} L${points.map(p => `${p.x},${p.y}`).join(' L')} L${points[4].x},170 L${points[0].x},170 Z`} fill="url(#gradFill)" />
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={i === idx ? 6 : 4} fill={i === idx ? T.pink : '#fff'} stroke={i === idx ? T.pink : T.border} strokeWidth="2" />
          ))}
          {/* "Você" pin */}
          <g transform={`translate(${pos.x - 22}, ${pos.y - 30})`}>
            <rect x="0" y="0" width="44" height="20" rx="10" fill={T.pink} />
            <text x="22" y="14" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" fontFamily={fontUi}>Você</text>
          </g>
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 8px', marginTop: 4 }}>
          {labels.map(l => <span key={l} style={{ fontSize: 11, color: T.inkSoft }}>{l}</span>)}
        </div>
      </div>

      <div style={{ background: T.pinkTrackSoft, borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.pinkDeep, marginBottom: 4 }}>
          ⚠ Nível {level}
        </div>
        <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.5 }}>
          Você precisa urgentemente mudar sua rotina capilar para ter resultados melhores
        </div>
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 10 }}>
        Análise dos motivos pelas quais você não tem o cabelo dos seus sonhos
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {[
          { icon: '🧠', title: 'Melhorar a alimentação', desc: 'Você precisa de algumas vitaminas para que seu cabelo seja mais forte' },
          { icon: '📋', title: 'Rotina de cuidados', desc: 'Você precisa ter um cronograma de cuidados personalizado' },
          { icon: '🎯', title: 'Comprar os produtos certos', desc: 'Pare de gastar dinheiro com produtos baratos que não te ajudam em nada' },
        ].map((c, i) => (
          <div key={i} style={{
            background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12, padding: '12px 12px',
            gridColumn: i === 2 ? 'span 2' : 'auto',
          }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{c.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 4 }}>{c.title}</div>
            <div style={{ fontSize: 11, color: T.inkSoft, lineHeight: 1.4 }}>{c.desc}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 8 }}>
        <ContinueButton onClick={onContinue} label={q.ctaText ?? 'Continuar'} />
      </div>
    </div>
  )
}

// ─── Tela: plano pronto ───────────────────────────────────────
function PlanReadyScreen({ q, onContinue }: { q: QuizStep; onContinue: () => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 20px 24px' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: T.ink, textAlign: 'center', margin: '12px 0 16px' }}>
        Seu Plano está pronto
      </h2>
      <h3 style={{ fontSize: 22, fontWeight: 800, color: T.ink, textAlign: 'center', lineHeight: 1.2, margin: '0 0 12px' }}>
        Montamos um plano e exclusivo para você ter um cabelo cheio, sem frizz e hidratado em até 90 dias
      </h3>
      {q.subtitle && (
        <div style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.5, textAlign: 'center', marginBottom: 20 }}>
          {q.subtitle}
        </div>
      )}

      {/* Curva */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <svg width="100%" height="200" viewBox="0 0 380 200">
          <defs>
            <linearGradient id="gradPlan" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FB7185" />
              <stop offset="50%" stopColor="#FACC15" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>
          </defs>
          <path d="M30,160 Q120,140 160,110 T280,55 L350,30" stroke="url(#gradPlan)" strokeWidth="4" fill="none" strokeLinecap="round" />
          {/* dots */}
          <circle cx="30" cy="160" r="5" fill="#fff" stroke={T.inkSoft} strokeWidth="2" />
          <circle cx="105" cy="135" r="6" fill="#fff" stroke={T.pink} strokeWidth="2" />
          <circle cx="185" cy="100" r="5" fill="#fff" stroke="#FACC15" strokeWidth="2" />
          <circle cx="265" cy="65" r="5" fill="#fff" stroke="#10B981" strokeWidth="2" />
          <circle cx="350" cy="30" r="6" fill="#fff" stroke="#10B981" strokeWidth="2" />
          {/* pins */}
          <g transform="translate(60, 110)">
            <rect x="0" y="0" width="78" height="22" rx="11" fill={T.pink} />
            <text x="39" y="15" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" fontFamily={fontUi}>Você hoje</text>
          </g>
          <g transform="translate(218, 30)">
            <rect x="0" y="0" width="118" height="22" rx="11" fill={T.pink} />
            <text x="59" y="15" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" fontFamily={fontUi}>Você em até 90 dias</text>
          </g>
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 8px', marginTop: 4 }}>
          {['Baixo', 'Aceitável', 'Normal', 'Bom', 'Ótimo'].map(l => (
            <span key={l} style={{ fontSize: 11, color: T.inkSoft }}>{l}</span>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 12 }}>
        <ContinueButton onClick={onContinue} label={q.ctaText ?? 'Continuar'} />
      </div>
    </div>
  )
}

// ─── Tela: mini depoimentos ───────────────────────────────────
function MiniTestiScreen({ q, name, onContinue }: { q: QuizStep; name: string; onContinue: () => void }) {
  const testis = [
    { name: 'Fernanda Sanoli', handle: '@fernandasanoli', text: 'Finalmente consegui volume e brilho no meu cabelo! Cresceu muito rápido e ficou incrível, sem frizz!' },
    { name: 'Daniela Mendes', handle: '@daniel_1989oficial', text: 'Eu achava que não havia solução p meu cabelo por causa das químicas que usei por anos, mas o método de transformação capilar me provou o contrário. Áreas estão longas, alinhadas, brilhantes e extremamente hidratadas. É como se eu tivesse um cabelo novo! Muito obrigada por essa transformação.' },
    { name: 'Maria Santana', handle: '@mariasilv', text: 'Meu cabelo voltou a brilhar e crescer como nunca! Sem frizz, super liso e hidratado, mesmo depois de químicas.' },
  ]
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 20px 24px' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: T.ink, lineHeight: 1.3, margin: '12px 0 6px' }}>
        <strong style={{ color: T.pinkDeep }}>{name || 'Você'}</strong> você será a próxima transformação
      </div>
      <div style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.5, marginBottom: 14 }}>
        Você vai conquistar o cabelo dos seus sonhos e se transformará com o plano capilar que eu fiz para você completamente adaptável a sua jornada!
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, marginBottom: 4 }}>
        Depoimentos das meninas que aplicaram nosso plano de transformação capilar
      </div>
      <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 12 }}>
        Hoje somos mais de 43 mil mulheres que aplicam esse método personalizado e individual
      </div>

      <div style={{ marginBottom: 12 }}>
        <ContinueButton onClick={onContinue} label={q.ctaText ?? 'Continuar'} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {testis.map((t, i) => (
          <div key={i} style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12, padding: '14px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: T.pinkTrackSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: T.pinkDeep, fontSize: 15 }}>
                {t.name.charAt(0)}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{t.name}</div>
                <div style={{ fontSize: 11, color: T.inkSoft }}>{t.handle}</div>
              </div>
              <div style={{ marginLeft: 'auto', color: '#FACC15', fontSize: 13, letterSpacing: 1 }}>★★★★★</div>
            </div>
            <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.5 }}>{t.text}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ╔═══════════════════════════════════════════════════════════╗
// ║                   Main component                          ║
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

  // Carrega URLs dinâmicas das imagens (admin pode editar)
  useEffect(() => {
    fetch('/api/quiz/images')
      .then(r => r.json())
      .then((data: Record<string, string>) => {
        if (data && typeof data === 'object') setImages(data)
      })
      .catch(() => {})
  }, [])

  // Auto-advance no loading screen
  useEffect(() => {
    if (step?.kind === 'loading') {
      const t = setTimeout(() => setStepIndex(i => Math.min(total - 1, i + 1)), 3500)
      return () => clearTimeout(t)
    }
  }, [stepIndex, step, total])

  // Reset textInput quando muda step
  useEffect(() => {
    if (step?.kind === 'textarea') {
      const prior = answers[step.id]
      setTextInput(typeof prior === 'string' ? prior : '')
    }
    if (step?.kind === 'phone') {
      setPhoneInput(typeof answers[step.id] === 'string' ? (answers[step.id] as string) : phoneInput)
    }
  }, [stepIndex])  // eslint-disable-line react-hooks/exhaustive-deps

  const goNext = useCallback(() => {
    setStepIndex(i => Math.min(total - 1, i + 1))
  }, [total])

  const goBack = useCallback(() => {
    setStepIndex(i => Math.max(0, i - 1))
  }, [])

  const choose = useCallback((qid: string, v: string) => {
    setAnswers(a => ({ ...a, [qid]: v }))
    setTimeout(() => setStepIndex(i => Math.min(total - 1, i + 1)), 240)
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
    // Última tela (mini_testi) → vai para /oferta
    if (stepIndex >= total - 1) {
      try { localStorage.setItem('quiz_answers', JSON.stringify(answers)) } catch {}
      router.push('/oferta/v1')
    } else {
      goNext()
    }
  }, [stepIndex, total, answers, router, goNext])

  const canBack = stepIndex > 0 && step?.kind !== 'loading'
  const showPercent = step?.kind === 'loading'

  return (
    <>
      <style>{`
        @keyframes qOptIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes qFade { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        input::placeholder, textarea::placeholder { color: ${T.inkSoft}; opacity: 0.7; font-style: italic; }
        input:focus, textarea:focus { border-color: ${T.pink} !important; }
      `}</style>
      <div style={{
        minHeight: '100svh', background: T.bg, fontFamily: fontUi, color: T.ink,
        display: 'flex', flexDirection: 'column', WebkitTapHighlightColor: 'transparent',
      }}>
        <div style={{
          width: '100%', maxWidth: 480, margin: '0 auto', flex: 1,
          display: 'flex', flexDirection: 'column', minHeight: '100svh',
        }}>
          <Header pct={pct} canBack={canBack} onBack={goBack} showPercent={showPercent} />

          <div key={stepIndex} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            animation: 'qFade 0.4s cubic-bezier(.2,.7,.3,1)',
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
