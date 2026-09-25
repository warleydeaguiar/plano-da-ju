'use client'
import { useCallback, useRef, useState } from 'react'

/**
 * Roleta do desconto da Progressiva Fashion Gold (variante B do teste).
 *
 * A roleta sempre para no prêmio da campanha. Ela não é um sorteio de verdade
 * — é a forma de apresentar a oferta que a peça já anuncia, com a pessoa
 * participando em vez de só ler. Por isso o texto diz "descubra o seu
 * desconto", e não "você pode ganhar".
 */
const R = 130
const CX = 150
const CY = 150

const SEGMENTOS = [
  { label: '48% OFF', premio: true },
  { label: '5% OFF',  premio: false },
  { label: '15% OFF', premio: false },
  { label: '10% OFF', premio: false },
  { label: '20% OFF', premio: false },
  { label: '5% OFF',  premio: false },
  { label: '30% OFF', premio: false },
  { label: '10% OFF', premio: false },
]
const FATIA = 360 / SEGMENTOS.length
// Dourado no prêmio, vinho e rosa da marca nos outros. Os marrons anteriores
// ficavam todos parecidos e a fatia premiada não se destacava.
const FUNDO = ['#C9A877', '#5C1B3A', '#9D174D', '#5C1B3A', '#9D174D', '#5C1B3A', '#9D174D', '#5C1B3A']
const TEXTO = ['#2A1E2C', '#FFF', '#FFF', '#FFF', '#FFF', '#FFF', '#FFF', '#FFF']

/**
 * Ângulo do meio da fatia, já no sistema do SVG (0° apontando para cima).
 * O texto acompanha o raio; quando cairia de cabeça para baixo (metade
 * esquerda da roda), gira 180° para continuar legível.
 */
function anguloDoTexto(i: number) {
  const centro = i * FATIA - 90 + FATIA / 2
  const invertido = centro > 90 && centro < 270
  return { centro, rotacao: invertido ? centro + 180 : centro }
}

function ponto(graus: number, raio: number) {
  const rad = (graus * Math.PI) / 180
  return { x: CX + raio * Math.cos(rad), y: CY + raio * Math.sin(rad) }
}

function fatia(i: number) {
  const ini = i * FATIA - 90
  const fim = ini + FATIA
  const a = ponto(ini, R)
  const b = ponto(fim, R)
  return `M ${CX} ${CY} L ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${R} ${R} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)} Z`
}

export default function RoletaFG({ onPremio }: { onPremio: () => void }) {
  const [girando, setGirando] = useState(false)
  const [rotacao, setRotacao] = useState(0)
  const jaGirou = useRef(false)

  const girar = useCallback(() => {
    if (jaGirou.current) return
    jaGirou.current = true
    setGirando(true)
    // 5 voltas + o ajuste que deixa o centro da fatia 0 debaixo do ponteiro.
    const alvo = 360 * 5 + (360 - FATIA / 2)
    setRotacao(alvo)
    window.setTimeout(() => { setGirando(false); onPremio() }, 4200)
  }, [onPremio])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 300 }}>
        {/* Ponteiro */}
        <div style={{
          position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)', zIndex: 2,
          width: 0, height: 0, borderLeft: '13px solid transparent', borderRight: '13px solid transparent',
          borderTop: '22px solid #2A1E2C', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.3))',
        }} />
        <svg viewBox="0 0 300 300" style={{ width: '100%', display: 'block' }} aria-label="Roleta de desconto">
          <g style={{
            transform: `rotate(${rotacao}deg)`, transformOrigin: '150px 150px',
            // Curva longa no fim: a roleta desacelera como uma de verdade.
            transition: girando ? 'transform 4s cubic-bezier(0.15, 0.85, 0.2, 1)' : 'none',
          }}>
            {SEGMENTOS.map((s, i) => {
              const { centro, rotacao } = anguloDoTexto(i)
              const p = ponto(centro, R * 0.62)
              return (
                <g key={i}>
                  <path d={fatia(i)} fill={FUNDO[i]} stroke="#FFF8EE" strokeWidth="2" />
                  <text
                    x={p.x} y={p.y}
                    fill={TEXTO[i]} fontSize={s.premio ? 16 : 13} fontWeight={s.premio ? 900 : 600}
                    textAnchor="middle" dominantBaseline="middle"
                    transform={`rotate(${rotacao.toFixed(1)} ${p.x.toFixed(2)} ${p.y.toFixed(2)})`}
                  >{s.label}</text>
                </g>
              )
            })}
          </g>
          <circle cx={CX} cy={CY} r={R + 6} fill="none" stroke="#C9A877" strokeWidth="5" />
        </svg>

        {/* O botão fica no EIXO da roleta, como numa roleta de verdade: é ele
            que a pessoa aperta, e some assim que o giro começa para não brigar
            com a animação. */}
        <button
          onClick={girar}
          disabled={girando || jaGirou.current}
          aria-label="Girar a roleta"
          style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            width: 84, height: 84, borderRadius: '50%', zIndex: 3,
            border: '4px solid #FFF8EE',
            background: girando ? '#B9A88E' : 'radial-gradient(circle at 35% 30%, #E4C99A, #9C7B4F)',
            color: '#2A1E2C', fontSize: 15, fontWeight: 900, letterSpacing: 0.5,
            cursor: girando ? 'default' : 'pointer',
            boxShadow: girando ? 'none' : '0 6px 18px -4px rgba(0,0,0,.45)',
            // Pulsa enquanto ninguém tocou: é o convite para a ação.
            animation: girando || jaGirou.current ? 'none' : 'pulsaGirar 1.6s ease-in-out infinite',
          }}
        >
          {girando ? '...' : 'GIRAR'}
        </button>
        <style>{`
          @keyframes pulsaGirar {
            0%, 100% { box-shadow: 0 6px 18px -4px rgba(0,0,0,.45), 0 0 0 0 rgba(201,168,119,.55); }
            50%      { box-shadow: 0 6px 18px -4px rgba(0,0,0,.45), 0 0 0 14px rgba(201,168,119,0); }
          }
        `}</style>
      </div>
    </div>
  )
}
