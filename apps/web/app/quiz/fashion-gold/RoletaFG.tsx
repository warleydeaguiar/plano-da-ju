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
// Dourado no prêmio; os outros alternam para dar contraste sem virar arco-íris.
const FUNDO = ['#C9A877', '#3B2A1F', '#7A5C3A', '#3B2A1F', '#7A5C3A', '#3B2A1F', '#7A5C3A', '#3B2A1F']
const TEXTO = ['#2A1E2C', '#F5E6D3', '#F5E6D3', '#F5E6D3', '#F5E6D3', '#F5E6D3', '#F5E6D3', '#F5E6D3']

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
            {SEGMENTOS.map((s, i) => (
              <g key={i}>
                <path d={fatia(i)} fill={FUNDO[i]} stroke="#FFF8EE" strokeWidth="2" />
                <text
                  x={ponto(i * FATIA - 90 + FATIA / 2, R * 0.66).x}
                  y={ponto(i * FATIA - 90 + FATIA / 2, R * 0.66).y}
                  fill={TEXTO[i]} fontSize={s.premio ? 17 : 14} fontWeight={s.premio ? 800 : 600}
                  textAnchor="middle" dominantBaseline="middle"
                  transform={`rotate(${i * FATIA + FATIA / 2} ${ponto(i * FATIA - 90 + FATIA / 2, R * 0.66).x} ${ponto(i * FATIA - 90 + FATIA / 2, R * 0.66).y})`}
                >{s.label}</text>
              </g>
            ))}
          </g>
          <circle cx={CX} cy={CY} r={R + 6} fill="none" stroke="#C9A877" strokeWidth="5" />
          <circle cx={CX} cy={CY} r="26" fill="#FFF8EE" stroke="#C9A877" strokeWidth="3" />
        </svg>
      </div>

      <button
        onClick={girar}
        disabled={girando || jaGirou.current}
        style={{
          width: '100%', maxWidth: 340, padding: '17px 20px', borderRadius: 16, border: 'none',
          background: girando ? '#B9A88E' : 'linear-gradient(135deg,#C9A877,#9C7B4F)',
          color: '#fff', fontSize: 17, fontWeight: 800, letterSpacing: 0.3,
          cursor: girando ? 'default' : 'pointer',
          boxShadow: '0 14px 30px -14px rgba(156,123,79,.9)',
        }}
      >
        {girando ? 'Girando…' : 'GIRAR E VER MEU DESCONTO'}
      </button>
    </div>
  )
}
