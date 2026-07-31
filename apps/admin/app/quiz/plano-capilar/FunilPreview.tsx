'use client'

import { useState } from 'react'

const WEB = 'https://planodaju.julianecost.com'
const accent = '#BE185D'
const gray = '#7C6B7E'

type Stage = { id: string; label: string; url: string }

// Passos do quiz (na ordem) → prévia via ?preview=1&step=<id> (sem tracking).
const QUIZ_STEPS: Array<[string, string]> = [
  ['tipo', 'Tipo de cabelo'],
  ['cor', 'Cor do cabelo'],
  ['idade', 'Idade'],
  ['incomoda', 'O que mais incomoda'],
  ['quimica', 'Química feita'],
  ['info_juliane', 'Info: quem é a Juliane'],
  ['info_3500', 'Info: +3.500 mulheres'],
  ['corte_quimico', 'Corte químico'],
  ['espessura', 'Espessura'],
  ['oleosidade', 'Oleosidade'],
  ['porosidade', 'Porosidade'],
  ['caspa', 'Caspa'],
  ['elasticidade', 'Elasticidade'],
  ['lavagem', 'Frequência de lavagem'],
  ['calor', 'Fontes de calor'],
  ['cronograma', 'Cronograma capilar'],
  ['crescimento_desigual', 'Crescimento desigual'],
  ['sol_piscina', 'Sol / piscina'],
  ['agua', 'Água por dia'],
  ['protetor', 'Protetor térmico'],
  ['cortes', 'Frequência de cortes'],
  ['areas', 'Áreas de preocupação'],
  ['info_bio', 'Info: bio da Juliane'],
  ['info_depoimentos', 'Info: depoimentos'],
  ['loading', 'Analisando (loading)'],
  ['phone', 'Telefone'],
  ['name_email', 'Nome & e-mail'],
  ['level', 'Nível de cuidado'],
  ['plan_ready', 'Plano pronto'],
  ['mini_testi', 'Depoimento final'],
]

const QUIZ_STAGES: Stage[] = QUIZ_STEPS.map(([id, label]) => ({
  id: `quiz:${id}`, label, url: `${WEB}/quiz?preview=1&step=${id}`,
}))

// Páginas públicas depois do quiz.
const PAGE_STAGES: Stage[] = [
  { id: 'page:roleta', label: '🎡 Roleta de desconto', url: `${WEB}/roleta` },
  { id: 'page:oferta', label: '💳 Oferta / Checkout', url: `${WEB}/oferta` },
  { id: 'page:obrigado', label: '✅ Obrigado (pós-compra)', url: `${WEB}/obrigado` },
]

export default function FunilPreview() {
  const [active, setActive] = useState<Stage>(QUIZ_STAGES[0])
  const [reloadKey, setReloadKey] = useState(0)

  const Item = ({ s }: { s: Stage }) => {
    const on = active.id === s.id
    return (
      <button
        onClick={() => { setActive(s); setReloadKey(k => k + 1) }}
        style={{
          display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
          padding: '8px 12px', borderRadius: 8, marginBottom: 3, fontFamily: 'inherit',
          fontSize: 13, fontWeight: on ? 700 : 500,
          border: `1px solid ${on ? accent : 'transparent'}`,
          background: on ? '#FDF2F6' : 'transparent', color: on ? accent : '#2A1E2C',
        }}
      >
        {s.label}
      </button>
    )
  }

  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 22px', marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#2A1E2C' }}>👁 Pré-visualizar o funil</div>
        <a href={active.url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: accent, fontWeight: 600, textDecoration: 'none' }}>
          Abrir em nova aba ↗
        </a>
      </div>
      <div style={{ fontSize: 12.5, color: gray, marginBottom: 16 }}>
        Veja cada etapa exatamente como a cliente vê. As telas do quiz abrem em modo prévia — <strong>nada é registrado</strong> nas métricas.
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {/* Lista de etapas */}
        <div style={{ width: 240, flexShrink: 0, maxHeight: 720, overflowY: 'auto', paddingRight: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: gray, textTransform: 'uppercase', letterSpacing: 0.5, margin: '4px 0 6px 4px' }}>Quiz ({QUIZ_STAGES.length} passos)</div>
          {QUIZ_STAGES.map(s => <Item key={s.id} s={s} />)}
          <div style={{ fontSize: 11, fontWeight: 700, color: gray, textTransform: 'uppercase', letterSpacing: 0.5, margin: '14px 0 6px 4px' }}>Depois do quiz</div>
          {PAGE_STAGES.map(s => <Item key={s.id} s={s} />)}
        </div>

        {/* Moldura de celular com iframe */}
        <div style={{ flex: 1, minWidth: 340, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            width: 372, maxWidth: '100%', background: '#1A1420', borderRadius: 36, padding: 10,
            boxShadow: '0 20px 50px rgba(0,0,0,0.22)',
          }}>
            <div style={{ position: 'relative', borderRadius: 28, overflow: 'hidden', background: '#fff' }}>
              <iframe
                key={reloadKey}
                title="Prévia do funil"
                src={active.url}
                style={{ width: '100%', height: 720, border: 'none', display: 'block' }}
              />
            </div>
          </div>
          <div style={{ fontSize: 12, color: gray, marginTop: 10, textAlign: 'center' }}>
            {active.label}
          </div>
        </div>
      </div>
    </div>
  )
}
