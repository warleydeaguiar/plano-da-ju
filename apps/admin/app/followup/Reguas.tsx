'use client'

import { useCallback, useEffect, useState } from 'react'

interface Regua {
  id: number
  dias: number
  rotulo: string | null
  ativa: boolean
  pendentes: number
}

const T = {
  ink: '#2A1E2C', inkSoft: '#7C6B7E', border: '#EDE0D2',
  accent: '#BE185D', accentSoft: '#FCE7F3', bg: '#FFFAF5', red: '#DC2626',
}

/**
 * Configuração das réguas de contato.
 *
 * "De quanto em quanto tempo falar com cada pessoa" era `const RULES =
 * [20, 60, 120]` dentro da API: mudar a cadência exigia deploy. Aqui a Juliane
 * cria, desliga e apaga régua sozinha, e vê na hora quantas tarefas cada uma
 * gera na fila.
 */
export default function Reguas() {
  const [reguas, setReguas] = useState<Regua[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [dias, setDias] = useState('')
  const [rotulo, setRotulo] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const r = await fetch('/api/followup/reguas')
      const d = await r.json()
      setReguas(d.reguas ?? [])
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function criar() {
    const n = parseInt(dias, 10)
    if (!n) { setErro('Informe de quantos em quantos dias.'); return }
    setSalvando(true); setErro(null)
    try {
      const r = await fetch('/api/followup/reguas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dias: n, rotulo }),
      })
      const d = await r.json()
      if (!r.ok) { setErro(d.error); return }
      setDias(''); setRotulo('')
      await carregar()
    } finally { setSalvando(false) }
  }

  async function alternar(g: Regua) {
    await fetch('/api/followup/reguas', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: g.id, ativa: !g.ativa }),
    })
    await carregar()
  }

  async function apagar(g: Regua) {
    if (!confirm(
      `Apagar a régua de ${g.dias} dias?\n\n` +
      'Ela para de gerar tarefas novas. Quem já foi contatado por ela continua no histórico.',
    )) return
    await fetch(`/api/followup/reguas?id=${g.id}`, { method: 'DELETE' })
    await carregar()
  }

  const campo: React.CSSProperties = {
    padding: '10px 12px', borderRadius: 9, border: `1px solid ${T.border}`,
    fontSize: 13, outline: 'none', fontFamily: 'inherit', background: '#fff',
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.55, marginBottom: 20 }}>
        Cada régua é um lembrete: <strong style={{ color: T.ink }}>falar com a pessoa X dias
        depois que ela entrou</strong>. Quem já foi contatado por uma régua não aparece de novo
        nela. Desligar para de gerar tarefas sem apagar o histórico.
      </div>

      {/* ── nova régua ── */}
      <div style={{
        background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12,
        padding: 16, marginBottom: 20,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 12 }}>
          Nova régua
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <input
            type="number" min={1} max={3650} value={dias}
            onChange={(e) => setDias(e.target.value)}
            placeholder="dias" style={{ ...campo, width: 110 }}
          />
          <input
            value={rotulo} onChange={(e) => setRotulo(e.target.value)}
            placeholder="apelido (opcional) — ex.: segundo contato"
            style={{ ...campo, flex: 1, minWidth: 220 }}
          />
          <button
            onClick={criar} disabled={salvando || !dias}
            style={{
              padding: '10px 18px', borderRadius: 9, border: 0,
              background: T.accent, color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: salvando || !dias ? 'default' : 'pointer',
              opacity: salvando || !dias ? 0.5 : 1, fontFamily: 'inherit',
            }}
          >
            {salvando ? 'Criando…' : 'Criar régua'}
          </button>
        </div>
        {erro && <div style={{ color: T.red, fontSize: 12.5, marginTop: 10 }}>{erro}</div>}
      </div>

      {/* ── lista ── */}
      {carregando ? (
        <div style={{ color: T.inkSoft, fontSize: 13, padding: '20px 0' }}>Carregando…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {reguas.map((g) => (
            <div
              key={g.id}
              style={{
                background: '#fff', border: `1px solid ${g.ativa ? T.border : '#F0F0F0'}`,
                borderRadius: 12, padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
                opacity: g.ativa ? 1 : 0.6,
              }}
            >
              <div style={{
                minWidth: 62, textAlign: 'center', padding: '8px 10px', borderRadius: 9,
                background: g.ativa ? T.accentSoft : '#F5F5F5',
                color: g.ativa ? T.accent : T.inkSoft, fontWeight: 800, fontSize: 15,
              }}>
                {g.dias}
                <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.8 }}>dias</div>
              </div>

              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>
                  {g.rotulo || `Contato aos ${g.dias} dias`}
                </div>
                <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                  {g.ativa
                    ? `${g.pendentes.toLocaleString('pt-BR')} ${g.pendentes === 1 ? 'pessoa esperando' : 'pessoas esperando'} contato`
                    : 'desligada — não gera tarefa'}
                </div>
              </div>

              <button
                onClick={() => alternar(g)}
                style={{
                  padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
                  border: `1px solid ${T.border}`, background: '#fff', color: T.ink,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {g.ativa ? 'Desligar' : 'Ligar'}
              </button>
              <button
                onClick={() => apagar(g)}
                title="Apagar a régua"
                style={{
                  padding: '8px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
                  border: `1px solid ${T.border}`, background: '#fff', color: T.red,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Apagar
              </button>
            </div>
          ))}
          {reguas.length === 0 && (
            <div style={{ color: T.inkSoft, fontSize: 13 }}>
              Nenhuma régua cadastrada — sem elas a fila fica vazia.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
