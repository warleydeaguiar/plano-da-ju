'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// ─── Tema ─────────────────────────────────────────────────────
const T = {
  gold:     '#C9A877',
  goldDeep: '#9C7B4F',
  pink:     '#EC4899',
  pinkDeep: '#BE185D',
}

const fonts = {
  display: '"Fraunces", "Cormorant Garamond", Georgia, serif',
  ui:      '"Plus Jakarta Sans", "Inter", -apple-system, system-ui, sans-serif',
}

// ─── Wheel config ─────────────────────────────────────────────
const SIZE    = 300
const CX      = SIZE / 2
const CY      = SIZE / 2
const R       = 138
const INNER_R = 36

const SEGMENTS = [
  { label: '65% OFF', sublabel: 'R$34,90', win: true },
  { label: '5%',      sublabel: 'PIX' },
  { label: '10%',     sublabel: 'CARTÃO' },
  { label: '5%',      sublabel: 'CARTÃO' },
  { label: '20%',     sublabel: 'PIX' },
  { label: '10%',     sublabel: 'PIX' },
  { label: '30%',     sublabel: 'CARTÃO' },
  { label: '5%',      sublabel: 'PIX' },
]

// Segment 0 (winner) = gold; odd = dark maroon; even = deep pink
const SEG_COLORS = ['#C9A877', '#5C1B3A', '#9D174D', '#5C1B3A', '#9D174D', '#5C1B3A', '#9D174D', '#5C1B3A']
const SEG_TEXT   = ['#2A1E2C', '#FFF',    '#FFF',    '#FFF',    '#FFF',    '#FFF',    '#FFF',    '#FFF']

// ─── SVG helpers ─────────────────────────────────────────────
function polarXY(deg: number, radius: number) {
  const rad = (deg * Math.PI) / 180
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) }
}

function segPath(i: number): string {
  const n   = SEGMENTS.length
  const s   = polarXY(-90 + i * (360 / n), R)
  const e   = polarXY(-90 + (i + 1) * (360 / n), R)
  return `M ${CX} ${CY} L ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${R} ${R} 0 0 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)} Z`
}

// Spin lands segment 0 center at top pointer:
// seg-0 center starts at −67.5°; to reach 270° (top):
//   R = (270 − (−67.5)) + (n−1)×360 = 337.5 + 5×360 = 2137.5°
const SPIN_DEG = 2137.5

// ─── Timer helpers ────────────────────────────────────────────
function fmt(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// ─── Main page ────────────────────────────────────────────────
export default function RoletaPage() {
  const router = useRouter()

  const [spun,     setSpun]     = useState(false)
  const [spinning, setSpinning] = useState(false)
  const [won,      setWon]      = useState(false)
  const [rotation, setRotation] = useState(0)
  const [counter,  setCounter]  = useState(3482)
  const [timeLeft, setTimeLeft] = useState(10 * 60)

  // Fake live counter — slow random increments toward 3500
  useEffect(() => {
    const id = setInterval(() => {
      setCounter(c => c < 3499 && Math.random() > 0.65 ? c + 1 : c)
    }, 3500)
    return () => clearInterval(id)
  }, [])

  // Countdown after winning
  useEffect(() => {
    if (!won) return
    const id = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000)
    return () => clearInterval(id)
  }, [won])

  const spin = useCallback(() => {
    if (spun) return
    setSpun(true)
    setSpinning(true)
    setRotation(SPIN_DEG)
    setTimeout(() => {
      setWon(true)
    }, 4200)
  }, [spun])

  const redeem = useCallback(() => {
    router.push('/oferta')
  }, [router])

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <style>{`
        @keyframes prizeIn {
          from { opacity: 0; transform: translateY(28px) scale(0.94); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes pulseCta {
          0%,100% { transform: scale(1); box-shadow: 0 4px 20px rgba(201,168,119,.45); }
          50%     { transform: scale(1.03); box-shadow: 0 6px 28px rgba(201,168,119,.65); }
        }
        @keyframes glowBadge {
          0%,100% { box-shadow: 0 0 8px rgba(74,222,128,.6); }
          50%     { box-shadow: 0 0 16px rgba(74,222,128,.9); }
        }
        @keyframes shimmerGold {
          from { transform: translateX(-100%) skewX(-15deg); }
          to   { transform: translateX(220%) skewX(-15deg); }
        }
        @keyframes counterPop {
          0%,100% { transform: scale(1); }
          50%     { transform: scale(1.2); color: #F9D44A; }
        }
        @keyframes pointerBounce {
          0%,100% { transform: translateX(-50%) translateY(0); }
          50%     { transform: translateX(-50%) translateY(4px); }
        }
      `}</style>

      <div style={{
        minHeight: '100dvh',
        background: 'linear-gradient(160deg, #140818 0%, #2D0B2E 45%, #140818 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '28px 20px 48px',
        fontFamily: fonts.ui,
      }}>

        {/* ── Header ─────────────────────────────────────────── */}
        <div style={{ textAlign: 'center', marginBottom: 20, width: '100%', maxWidth: 360 }}>
          <div style={{
            display: 'inline-block',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: T.gold,
            background: 'rgba(201,168,119,0.12)',
            border: '1px solid rgba(201,168,119,0.25)',
            borderRadius: 99, padding: '4px 14px', marginBottom: 14,
          }}>
            🎯 Oferta exclusiva
          </div>
          <h1 style={{
            fontFamily: fonts.display,
            fontSize: 30, fontWeight: 700, lineHeight: 1.18,
            color: '#FFF', margin: 0,
          }}>
            A melhor oferta<br />
            <span style={{ color: T.gold }}>da história!</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, marginTop: 10, marginBottom: 0 }}>
            Gire a roleta e descubra seu desconto
          </p>
        </div>

        {/* ── Live counter ───────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(201,168,119,0.22)',
          borderRadius: 12, padding: '9px 18px',
          marginBottom: 28,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#4ADE80',
            animation: 'glowBadge 2s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>
            Planos ativos hoje:
          </span>
          <span style={{
            fontSize: 15, fontWeight: 800, color: T.gold,
            minWidth: 42, textAlign: 'center',
          }}>
            {counter.toLocaleString('pt-BR')}
          </span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>/3.500</span>
        </div>

        {/* ── Wheel area ─────────────────────────────────────── */}
        <div style={{ position: 'relative', width: SIZE, marginBottom: 16 }}>

          {/* Pointer ▼ */}
          <div style={{
            position: 'absolute',
            top: -10,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            width: 0, height: 0,
            borderLeft:  '10px solid transparent',
            borderRight: '10px solid transparent',
            borderTop:   '18px solid #F59E0B',
            filter: 'drop-shadow(0 2px 6px rgba(245,158,11,.8))',
            animation: !spun ? 'pointerBounce 1.6s ease-in-out infinite' : 'none',
          }} />

          {/* Outer glow ring */}
          <div style={{
            position: 'absolute',
            top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            width: SIZE + 16, height: SIZE + 16,
            borderRadius: '50%',
            background: 'transparent',
            boxShadow: `0 0 0 3px rgba(201,168,119,0.3), 0 0 40px rgba(201,168,119,0.15)`,
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
              transition: spinning
                ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)'
                : 'none',
              borderRadius: '50%',
            }}
          >
            {/* Segments */}
            {SEGMENTS.map((seg, i) => {
              const n           = SEGMENTS.length
              const centerAngle = -90 + (i + 0.5) * (360 / n)
              const pos         = polarXY(centerAngle, R * 0.61)
              const posLow      = polarXY(centerAngle, R * 0.61)
              const bg          = SEG_COLORS[i]
              const fg          = SEG_TEXT[i]
              const fSize       = i === 0 ? 12 : 11
              const fSizeSub    = i === 0 ? 10 : 9

              return (
                <g key={i}>
                  <path d={segPath(i)} fill={bg} stroke="rgba(0,0,0,0.35)" strokeWidth={1.5} />
                  {/* Divider lines */}
                  {(() => {
                    const edgeP = polarXY(-90 + i * (360 / n), R)
                    return (
                      <line
                        x1={CX} y1={CY}
                        x2={edgeP.x.toFixed(2)} y2={edgeP.y.toFixed(2)}
                        stroke="rgba(0,0,0,0.4)" strokeWidth={1.5}
                      />
                    )
                  })()}
                  {/* Label */}
                  <g transform={`rotate(${centerAngle}, ${pos.x.toFixed(2)}, ${pos.y.toFixed(2)})`}>
                    <text
                      x={pos.x.toFixed(2)}
                      y={(pos.y - (fSizeSub * 0.7)).toFixed(2)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={fg}
                      fontSize={fSize}
                      fontWeight="800"
                      fontFamily={fonts.ui}
                      style={{ pointerEvents: 'none' }}
                    >
                      {seg.label}
                    </text>
                    <text
                      x={posLow.x.toFixed(2)}
                      y={(posLow.y + (fSize * 0.65)).toFixed(2)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={i === 0 ? 'rgba(42,30,44,0.8)' : 'rgba(255,255,255,0.75)'}
                      fontSize={fSizeSub}
                      fontWeight="600"
                      fontFamily={fonts.ui}
                      style={{ pointerEvents: 'none' }}
                    >
                      {seg.sublabel}
                    </text>
                  </g>
                </g>
              )
            })}

            {/* Center shadow circle */}
            <circle cx={CX} cy={CY} r={INNER_R + 6} fill="rgba(0,0,0,0.5)" />
            {/* Center hub */}
            <circle cx={CX} cy={CY} r={INNER_R} fill="#1A0A1E" stroke={T.gold} strokeWidth={2.5} />
          </svg>

          {/* Center hub button (non-rotating overlay) */}
          <button
            onClick={spin}
            disabled={spun}
            style={{
              position: 'absolute',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: INNER_R * 2, height: INNER_R * 2,
              borderRadius: '50%',
              background: spun ? 'rgba(201,168,119,0.2)' : T.gold,
              border: 'none',
              color: spun ? T.gold : '#1A0A1E',
              fontSize: 9, fontWeight: 800,
              fontFamily: fonts.ui,
              letterSpacing: '0.04em',
              cursor: spun ? 'default' : 'pointer',
              zIndex: 5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
            }}
          >
            {spun ? '✓' : 'GIRAR'}
          </button>
        </div>

        {/* ── Spin button (before spin) ─────────────────────── */}
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
                boxShadow: '0 4px 24px rgba(190,24,93,0.45)',
                letterSpacing: '0.02em',
                marginBottom: 12,
              }}
            >
              🎯 GIRAR A ROLETA
            </button>
            <p style={{
              color: 'rgba(255,255,255,0.35)', fontSize: 12,
              margin: 0, fontFamily: fonts.ui,
            }}>
              ⚠️ Apenas uma tentativa disponível por usuária
            </p>
          </div>
        )}

        {/* Spinning message */}
        {spinning && !won && (
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center', margin: '4px 0 0' }}>
            Girando...
          </p>
        )}

        {/* ── Prize card (after spin) ──────────────────────── */}
        {won && (
          <div style={{
            width: '100%', maxWidth: 340,
            background: 'linear-gradient(135deg, rgba(201,168,119,0.13) 0%, rgba(201,168,119,0.04) 100%)',
            border: `2px solid ${T.gold}`,
            borderRadius: 22,
            padding: '28px 22px 24px',
            textAlign: 'center',
            animation: 'prizeIn 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Shimmer */}
            <div style={{
              position: 'absolute', top: 0, left: 0,
              width: '40%', height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
              animation: 'shimmerGold 3s ease-in-out infinite',
              pointerEvents: 'none',
            }} />

            <div style={{ fontSize: 32, marginBottom: 6 }}>🎉</div>
            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginBottom: 6 }}>
              Parabéns! Você ganhou:
            </div>

            {/* Main discount */}
            <div style={{
              fontFamily: fonts.display,
              fontSize: 64, fontWeight: 700,
              color: T.gold, lineHeight: 1,
              marginBottom: 4,
            }}>
              65% OFF
            </div>
            <div style={{
              fontSize: 11, fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.5)',
              marginBottom: 18,
            }}>
              No cartão ou PIX
            </div>

            {/* Price */}
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 14,
              marginBottom: 22,
            }}>
              <span style={{
                fontSize: 17, color: 'rgba(255,255,255,0.35)',
                textDecoration: 'line-through',
              }}>
                R$99,00
              </span>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
              }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1 }}>por apenas</span>
                <span style={{ fontSize: 36, fontWeight: 800, color: '#FFF', lineHeight: 1.1 }}>
                  R$34,90
                </span>
              </div>
            </div>

            {/* Countdown */}
            <div style={{
              background: 'rgba(0,0,0,0.35)',
              borderRadius: 10,
              padding: '10px 16px',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>
                ⏱ Oferta expira em:
              </span>
              <span style={{
                fontSize: 22, fontWeight: 800,
                color: timeLeft < 60 ? '#F87171' : '#FCA5A5',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '0.04em',
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
                background: T.gold,
                border: 'none',
                borderRadius: 14,
                color: '#1A0A1E',
                fontSize: 17, fontWeight: 800,
                fontFamily: fonts.ui,
                cursor: 'pointer',
                letterSpacing: '0.02em',
                animation: 'pulseCta 2.2s ease-in-out infinite',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <span style={{ position: 'relative', zIndex: 1 }}>
                RESGATAR DESCONTO →
              </span>
              {/* Button shimmer */}
              <div style={{
                position: 'absolute', top: 0, left: 0,
                width: '35%', height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)',
                animation: 'shimmerGold 2s ease-in-out infinite',
                pointerEvents: 'none',
              }} />
            </button>

            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 14, marginBottom: 0 }}>
              🔒 Desconto aplicado automaticamente no checkout
            </p>
          </div>
        )}
      </div>
    </>
  )
}
