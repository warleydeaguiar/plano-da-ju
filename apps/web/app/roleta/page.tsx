'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'

// ─── Tema — idêntico ao quiz / oferta ─────────────────────────
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
}

// ─── Wheel config ─────────────────────────────────────────────
const SIZE    = 300
const CX      = SIZE / 2   // 150
const CY      = SIZE / 2   // 150
const R       = 136
const INNER_R = 36

const SEGMENTS = [
  { label: '42% OFF', sublabel: 'R$34,90', win: true },
  { label: '5%',      sublabel: 'PIX' },
  { label: '10%',     sublabel: 'CARTÃO' },
  { label: '5%',      sublabel: 'CARTÃO' },
  { label: '20%',     sublabel: 'PIX' },
  { label: '10%',     sublabel: 'PIX' },
  { label: '30%',     sublabel: 'CARTÃO' },
  { label: '5%',      sublabel: 'PIX' },
]

// Seg 0 = gold (vencedor), ímpares = vinho escuro, pares = rosa escuro
const SEG_BG   = ['#C9A877', '#5C1B3A', '#9D174D', '#5C1B3A', '#9D174D', '#5C1B3A', '#9D174D', '#5C1B3A']
const SEG_TEXT = ['#2A1E2C', '#FFF',    '#FFF',    '#FFF',    '#FFF',    '#FFF',    '#FFF',    '#FFF']

// ─── SVG helpers ─────────────────────────────────────────────
function polarXY(deg: number, radius: number) {
  const rad = (deg * Math.PI) / 180
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) }
}

function segPath(i: number): string {
  const n = SEGMENTS.length
  const s = polarXY(-90 + i * (360 / n), R)
  const e = polarXY(-90 + (i + 1) * (360 / n), R)
  return `M ${CX} ${CY} L ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${R} ${R} 0 0 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)} Z`
}

// Ângulo de rotação total para parar o segmento 0 embaixo do ponteiro (topo):
//   centro do seg-0 começa em -67,5°; precisa chegar em -90° (topo)
//   R = (-90 - (-67,5)) + 6×360 = -22,5 + 2160 = 2137,5°
const SPIN_TOTAL_DEG = 2137.5

// ─── Countdown helper ─────────────────────────────────────────
function fmt(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// ─── Floating petals — igual ao quiz ─────────────────────────
function FloatingPetals() {
  const petals = useMemo(() => Array.from({ length: 14 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 4 + Math.random() * 7,
    delay: Math.random() * 8,
    duration: 12 + Math.random() * 10,
    rotation: Math.random() * 360,
    type: i % 3,
    color: i % 2 === 0 ? T.pink : T.gold,
  })), [])

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
      {petals.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`, top: `${p.y}%`,
            width: p.size, height: p.size,
            color: p.color, opacity: 0.3,
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

// ─── Main page ────────────────────────────────────────────────
export default function RoletaPage() {
  const router = useRouter()

  const [spun,     setSpun]     = useState(false)
  const [spinning, setSpinning] = useState(false)
  const [won,      setWon]      = useState(false)
  const [rotation, setRotation] = useState(0)
  const [timeLeft, setTimeLeft] = useState(10 * 60) // 10 minutos em segundos

  // BUG FIX: guardar ref do timeout para cancelar se componente desmontar
  const spinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Limpar timer se componente desmontar antes do spin terminar
  useEffect(() => {
    return () => {
      if (spinTimerRef.current) clearTimeout(spinTimerRef.current)
    }
  }, [])

  // Contagem regressiva — só inicia depois de ganhar
  useEffect(() => {
    if (!won) return
    const id = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000)
    return () => clearInterval(id)
  }, [won])

  const spin = useCallback(() => {
    if (spun) return
    setSpun(true)
    setSpinning(true)
    setRotation(SPIN_TOTAL_DEG)

    // BUG FIX: zerar spinning após a animação (4s CSS + 200ms buffer)
    spinTimerRef.current = setTimeout(() => {
      setSpinning(false)   // remove a transition para evitar re-animações acidentais
      setWon(true)
    }, 4200)
  }, [spun])

  const redeem = useCallback(() => {
    router.push('/oferta')
  }, [router])

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,400&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <style>{`
        @keyframes petalFloat {
          0%,100% { transform: translateY(0) translateX(0) rotate(0deg); }
          25%     { transform: translateY(-28px) translateX(14px) rotate(90deg); }
          50%     { transform: translateY(-10px) translateX(-14px) rotate(180deg); }
          75%     { transform: translateY(18px) translateX(10px) rotate(270deg); }
        }
        @keyframes petalSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes prizeIn {
          from { opacity: 0; transform: translateY(24px) scale(0.95); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes pulseCta {
          0%,100% { box-shadow: 0 4px 20px rgba(190,24,93,.35); transform: scale(1); }
          50%     { box-shadow: 0 6px 28px rgba(190,24,93,.55); transform: scale(1.025); }
        }
        @keyframes shimmer {
          from { transform: translateX(-100%) skewX(-15deg); }
          to   { transform: translateX(260%) skewX(-15deg); }
        }
        @keyframes pointerBounce {
          0%,100% { transform: translateX(-50%) translateY(0); }
          50%     { transform: translateX(-50%) translateY(5px); }
        }
        @keyframes celebrate {
          0%   { opacity: 0; transform: scale(0.5) rotate(-8deg); }
          65%  { opacity: 1; transform: scale(1.08) rotate(3deg); }
          100% { opacity: 1; transform: scale(1) rotate(0); }
        }
      `}</style>

      {/* ── Fundo com petals — igual às outras páginas ─────── */}
      <div style={{
        minHeight: '100dvh',
        background: `
          radial-gradient(circle at 20% 0%, ${T.rose} 0%, transparent 45%),
          radial-gradient(circle at 80% 100%, ${T.champagne} 0%, transparent 50%),
          ${T.bg}
        `,
        fontFamily: fonts.ui,
        color: T.ink,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        overflowX: 'hidden',
        position: 'relative',
      }}>
        <FloatingPetals />

        <div style={{
          width: '100%', maxWidth: 480,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '28px 20px 52px',
          position: 'relative', zIndex: 1,
        }}>

          {/* ── Header ─────────────────────────────────────── */}
          <div style={{ textAlign: 'center', marginBottom: 20, width: '100%' }}>
            <div style={{
              display: 'inline-block',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: T.pinkDeep,
              background: T.pinkSoft,
              border: `1px solid ${T.pinkBlush}`,
              borderRadius: 99, padding: '4px 14px', marginBottom: 14,
            }}>
              🎯 Oferta exclusiva
            </div>
            <h1 style={{
              fontFamily: fonts.display,
              fontSize: 30, fontWeight: 700, lineHeight: 1.2,
              color: T.ink, margin: 0,
            }}>
              A melhor oferta<br />
              <span style={{
                background: `linear-gradient(135deg, ${T.pink}, ${T.gold})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                da história!
              </span>
            </h1>
            <p style={{ color: T.inkSoft, fontSize: 14, marginTop: 10, marginBottom: 0 }}>
              Gire a roleta e descubra seu desconto
            </p>
          </div>

          {/* ── Badge social proof ─────────────────────────── */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: T.cream,
            border: `1px solid ${T.border}`,
            borderRadius: 12, padding: '10px 18px',
            marginBottom: 28,
            boxShadow: '0 2px 8px rgba(196,140,150,0.1)',
          }}>
            <span style={{ fontSize: 15 }}>✨</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>
              Mais de <span style={{ color: T.pinkDeep }}>15 mil</span> planos personalizados entregues
            </span>
          </div>

          {/* ── Wheel area ─────────────────────────────────── */}
          <div style={{ position: 'relative', width: SIZE, flexShrink: 0, marginBottom: 16 }}>

            {/* Ponteiro ▼ fixo no topo */}
            <div style={{
              position: 'absolute', top: -10, left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10,
              width: 0, height: 0,
              borderLeft:  '10px solid transparent',
              borderRight: '10px solid transparent',
              borderTop:   `20px solid ${T.pinkDeep}`,
              filter: `drop-shadow(0 2px 5px rgba(190,24,93,.5))`,
              animation: !spun ? 'pointerBounce 1.6s ease-in-out infinite' : 'none',
            }} />

            {/* Anel decorativo externo */}
            <div style={{
              position: 'absolute',
              top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
              width: SIZE + 14, height: SIZE + 14,
              borderRadius: '50%',
              border: `3px solid ${T.border}`,
              boxShadow: `0 8px 32px rgba(190,24,93,0.12), 0 2px 8px rgba(196,140,150,0.1)`,
              background: 'transparent',
              pointerEvents: 'none',
            }} />

            {/* SVG Wheel */}
            <svg
              width={SIZE}
              height={SIZE}
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              style={{
                display: 'block',
                transform: `rotate(${rotation}deg)`,
                transformOrigin: `${CX}px ${CY}px`,
                // BUG FIX: transition só ativa enquanto spinning=true;
                // após setSpinning(false) ela é removida, evitando re-animações.
                transition: spinning
                  ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)'
                  : 'none',
                borderRadius: '50%',
                boxShadow: '0 4px 24px rgba(190,24,93,0.15)',
              }}
            >
              {SEGMENTS.map((seg, i) => {
                const n           = SEGMENTS.length
                const centerAngle = -90 + (i + 0.5) * (360 / n)
                const pos         = polarXY(centerAngle, R * 0.60)
                const fg          = SEG_TEXT[i]
                const fSize       = i === 0 ? 11 : 10
                const fSizeSub    = i === 0 ? 9  : 8

                return (
                  <g key={i}>
                    {/* Segmento */}
                    <path d={segPath(i)} fill={SEG_BG[i]} stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} />

                    {/* Linha divisória */}
                    {(() => {
                      const edge = polarXY(-90 + i * (360 / n), R)
                      return (
                        <line
                          x1={CX} y1={CY}
                          x2={edge.x.toFixed(2)} y2={edge.y.toFixed(2)}
                          stroke="rgba(255,255,255,0.2)" strokeWidth={1}
                        />
                      )
                    })()}

                    {/* Texto — rotacionado em torno do centro do segmento */}
                    <g transform={`rotate(${centerAngle}, ${pos.x.toFixed(2)}, ${pos.y.toFixed(2)})`}>
                      <text
                        x={pos.x.toFixed(2)}
                        y={(pos.y - fSizeSub * 0.6).toFixed(2)}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={fg}
                        fontSize={fSize}
                        fontWeight="800"
                        fontFamily={fonts.ui}
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {seg.label}
                      </text>
                      <text
                        x={pos.x.toFixed(2)}
                        y={(pos.y + fSize * 0.7).toFixed(2)}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={i === 0 ? 'rgba(42,30,44,0.75)' : 'rgba(255,255,255,0.8)'}
                        fontSize={fSizeSub}
                        fontWeight="600"
                        fontFamily={fonts.ui}
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {seg.sublabel}
                      </text>
                    </g>
                  </g>
                )
              })}

              {/* Hub central — sombra */}
              <circle cx={CX} cy={CY} r={INNER_R + 5} fill="rgba(0,0,0,0.18)" />
              {/* Hub central */}
              <circle cx={CX} cy={CY} r={INNER_R} fill={T.cream} stroke={T.gold} strokeWidth={2.5} />
            </svg>

            {/* Botão hub (não-rotativo, sobreposto ao SVG) */}
            <button
              onClick={spin}
              disabled={spun}
              aria-label={spun ? 'Roleta girada' : 'Girar a roleta'}
              style={{
                position: 'absolute',
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: INNER_R * 2, height: INNER_R * 2,
                borderRadius: '50%',
                background: spun ? T.champagne : T.gold,
                border: 'none',
                color: T.ink,
                fontSize: 8, fontWeight: 800,
                fontFamily: fonts.ui,
                letterSpacing: '0.05em',
                cursor: spun ? 'default' : 'pointer',
                zIndex: 5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                WebkitTapHighlightColor: 'transparent',
                transition: 'background 0.3s',
              }}
            >
              {spun ? '✓' : 'GIRAR'}
            </button>
          </div>

          {/* ── Botão principal "GIRAR A ROLETA" ─────────────── */}
          {!spun && (
            <div style={{ width: '100%', maxWidth: 340, textAlign: 'center' }}>
              <button
                onClick={spin}
                style={{
                  width: '100%',
                  padding: '17px 24px',
                  background: `linear-gradient(135deg, ${T.pinkDeep} 0%, #9D174D 100%)`,
                  border: 'none',
                  borderRadius: 14,
                  color: '#FFF',
                  fontSize: 18, fontWeight: 800,
                  fontFamily: fonts.ui,
                  cursor: 'pointer',
                  boxShadow: `0 4px 20px rgba(190,24,93,0.35)`,
                  letterSpacing: '0.02em',
                  marginBottom: 12,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                🎯 GIRAR A ROLETA
              </button>
              <p style={{ color: T.inkMuted, fontSize: 12, margin: 0 }}>
                ⚠️ Apenas uma tentativa disponível
              </p>
            </div>
          )}

          {/* Mensagem enquanto gira */}
          {spinning && !won && (
            <p style={{ color: T.inkSoft, fontSize: 14, textAlign: 'center', margin: '4px 0 0', fontStyle: 'italic' }}>
              Sorteando seu desconto…
            </p>
          )}

          {/* ── Cartão de prêmio ──────────────────────────────── */}
          {won && (
            <div style={{
              width: '100%', maxWidth: 340,
              background: '#FFFFFF',
              border: `2px solid ${T.gold}`,
              borderRadius: 22,
              padding: '28px 22px 24px',
              textAlign: 'center',
              boxShadow: `0 8px 40px rgba(190,24,93,0.12), 0 2px 8px rgba(196,140,150,0.1)`,
              animation: 'prizeIn 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Shimmer decorativo */}
              <div style={{
                position: 'absolute', top: 0, left: 0,
                width: '40%', height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(201,168,119,0.08), transparent)',
                animation: 'shimmer 3s ease-in-out 0.6s infinite',
                pointerEvents: 'none',
              }} />

              {/* Emoji celebrate */}
              <div style={{ fontSize: 36, marginBottom: 8, animation: 'celebrate 0.6s cubic-bezier(0.34,1.56,0.64,1)' }}>
                🎉
              </div>

              <p style={{ color: T.inkSoft, fontSize: 13, margin: '0 0 6px', fontFamily: fonts.ui }}>
                Parabéns! Você ganhou:
              </p>

              {/* Desconto principal */}
              <div style={{
                fontFamily: fonts.display,
                fontSize: 62, fontWeight: 700, lineHeight: 1,
                background: `linear-gradient(135deg, ${T.pinkDeep}, ${T.gold})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                marginBottom: 4,
              }}>
                42% OFF
              </div>
              <p style={{
                fontSize: 11, fontWeight: 700,
                letterSpacing: '0.14em', textTransform: 'uppercase',
                color: T.inkMuted, margin: '0 0 18px',
              }}>
                No cartão ou PIX
              </p>

              {/* Preços */}
              <div style={{
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 14,
                marginBottom: 20,
                padding: '12px 16px',
                background: T.pinkSoft,
                borderRadius: 12,
              }}>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: 11, color: T.inkMuted, display: 'block' }}>de</span>
                  <span style={{ fontSize: 17, color: T.inkMuted, textDecoration: 'line-through', fontFamily: fonts.ui }}>
                    R$59,90
                  </span>
                </div>
                <span style={{ fontSize: 22, color: T.inkMuted }}>→</span>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: 11, color: T.pinkDeep, fontWeight: 600, display: 'block' }}>por apenas</span>
                  <span style={{ fontSize: 34, fontWeight: 800, color: T.ink, fontFamily: fonts.ui, lineHeight: 1.1 }}>
                    R$34,90
                  </span>
                </div>
              </div>

              {/* Contagem regressiva */}
              <div style={{
                background: T.cream,
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                padding: '10px 16px',
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}>
                <span style={{ fontSize: 13, color: T.inkSoft }}>⏱ Oferta expira em:</span>
                <span style={{
                  fontSize: 22, fontWeight: 800,
                  color: timeLeft < 60 ? '#EF4444' : T.pinkDeep,
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '0.06em',
                }}>
                  {fmt(timeLeft)}
                </span>
              </div>

              {/* CTA */}
              <button
                onClick={redeem}
                style={{
                  width: '100%',
                  padding: '18px 24px',
                  background: `linear-gradient(135deg, ${T.pinkDeep} 0%, #9D174D 100%)`,
                  border: 'none',
                  borderRadius: 14,
                  color: '#FFF',
                  fontSize: 17, fontWeight: 800,
                  fontFamily: fonts.ui,
                  cursor: 'pointer',
                  letterSpacing: '0.02em',
                  animation: 'pulseCta 2.2s ease-in-out infinite',
                  position: 'relative',
                  overflow: 'hidden',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <span style={{ position: 'relative', zIndex: 1 }}>
                  RESGATAR DESCONTO →
                </span>
                <div style={{
                  position: 'absolute', top: 0, left: 0,
                  width: '35%', height: '100%',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)',
                  animation: 'shimmer 2.4s ease-in-out 1s infinite',
                  pointerEvents: 'none',
                }} />
              </button>

              <p style={{ color: T.inkMuted, fontSize: 11, marginTop: 14, marginBottom: 0 }}>
                🔒 Desconto aplicado automaticamente no checkout
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
