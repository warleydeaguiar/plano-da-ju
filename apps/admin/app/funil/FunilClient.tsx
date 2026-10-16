'use client'

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { T, fonts, shadow } from '../theme'
import type { Canal, Etapa, Funil, Passo, Previa, Status } from '@/lib/funil/mapa'
import type { PreviaPronta, Vivo } from '@/lib/funil/dados'
import type { Evento, Pessoa } from '@/lib/funil/pessoa'

type Dados = { previas: Record<string, PreviaPronta>; vivo: Record<string, Vivo>; problemas: string[] }
type ResultadoPessoa = { pessoa: Pessoa; eventos: Evento[] } | { erro: string } | null
type Aberta = { titulo: string; previa: PreviaPronta | null; chave?: string; propria?: boolean }

const CANAL: Record<Canal, { rotulo: string; cor: string; fundo: string }> = {
  whatsapp: { rotulo: 'WhatsApp', cor: '#15803D', fundo: '#DCFCE7' },
  sms:      { rotulo: 'SMS', cor: '#B45309', fundo: '#FEF3C7' },
  email:    { rotulo: 'E-mail', cor: T.pinkDeep, fundo: T.pinkSoft },
  ligacao:  { rotulo: 'Ligação', cor: '#4338CA', fundo: '#E0E7FF' },
  pagina:   { rotulo: 'Página', cor: T.blue, fundo: T.blueSoft },
  rastreio: { rotulo: 'Pixel / CAPI', cor: T.purple, fundo: T.purpleSoft },
  sistema:  { rotulo: 'Sistema', cor: T.inkSoft, fundo: T.cream },
}
const STATUS: Record<Status, { rotulo: string; cor: string; fundo: string }> = {
  ativo:  { rotulo: 'ligado', cor: T.green, fundo: T.greenSoft },
  manual: { rotulo: 'manual', cor: T.goldDeep, fundo: T.goldSoft },
  off:    { rotulo: 'desligado', cor: '#64748B', fundo: '#EEF1F4' },
  gap:    { rotulo: 'com problema', cor: T.danger, fundo: T.dangerSoft },
}
const MENSAGEM: Canal[] = ['whatsapp', 'sms', 'email', 'ligacao']

// ── utilidades ──────────────────────────────────────────────────────────────
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
/** Horário de Brasília (UTC−3, sem horário de verão) — igual no servidor e no navegador. */
function brasilia(iso: string) {
  const d = new Date(new Date(iso).getTime() - 3 * 3600_000)
  const p = (n: number) => String(n).padStart(2, '0')
  return {
    dia: `${DIAS[d.getUTCDay()]}, ${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`,
    hora: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`,
  }
}
const GSM = /^[A-Za-z0-9 \n\r@£$¥!"#%&'()*+,\-./:;<=>?¡¿§ÄÖÑÜäöñüà_]*$/
function partesSms(t: string) {
  const gsm = GSM.test(t)
  const n = t.length
  const partes = gsm ? (n <= 160 ? 1 : Math.ceil(n / 153)) : (n <= 70 ? 1 : Math.ceil(n / 67))
  return { n, partes, gsm }
}
function escapar(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
/** Formatação do WhatsApp: *negrito*, _itálico_, ~riscado~, links. */
function formatarWa(s: string) {
  return escapar(s)
    .replace(/\*([^*\n]+)\*/g, '<b>$1</b>')
    .replace(/(^|\s)_([^_\n]+)_/g, '$1<i>$2</i>')
    .replace(/~([^~\n]+)~/g, '<s>$1</s>')
    .replace(/(https?:\/\/[^\s<]+)/g, '<span style="color:#027EB5">$1</span>')
    .replace(/\n/g, '<br/>')
}

function Selo({ texto, cor, fundo }: { texto: string; cor: string; fundo: string }) {
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: fundo, color: cor, whiteSpace: 'nowrap' }}>{texto}</span>
}
const cartao: CSSProperties = { background: T.surface, borderRadius: 18, border: `1px solid ${T.borderSoft}`, boxShadow: shadow.card }

// ── página ──────────────────────────────────────────────────────────────────
export default function FunilClient({ funis, chave, dados, busca, pessoa }: {
  funis: Funil[]; chave: string; dados: Dados; busca: string; pessoa: ResultadoPessoa
}) {
  const funil = funis.find((f) => f.chave === chave) ?? funis[0]
  const [aberta, setAberta] = useState<Aberta | null>(null)
  const [so, setSo] = useState<'tudo' | 'mensagens'>('tudo')
  const abrir = (titulo: string, p: Previa) => setAberta({ titulo: p.rotulo ? `${titulo} — ${p.rotulo}` : titulo, previa: dados.previas[p.chave] ?? null, chave: p.chave })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1180 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 600, fontFamily: fonts.display, letterSpacing: -0.5 }}>Funil</div>
          <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 4, maxWidth: 560, lineHeight: 1.5 }}>
            Tudo o que cada pessoa recebe, em ordem. Toque numa mensagem para ver exatamente o que chega no celular dela.
          </div>
        </div>
        <form action="/funil" style={{ display: 'flex', gap: 8 }}>
          {chave !== funis[0].chave && <input type="hidden" name="f" value={chave} />}
          <input name="pessoa" defaultValue={busca} placeholder="E-mail ou telefone de uma cliente"
            style={{ width: 280, padding: '10px 14px', borderRadius: 12, border: `1px solid ${T.border}`, background: T.surface, fontSize: 13.5, fontFamily: fonts.ui, color: T.ink, outline: 'none' }} />
          <button style={{ padding: '10px 16px', borderRadius: 12, border: 'none', background: T.pinkDeep, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: fonts.ui }}>
            Ver o que recebeu
          </button>
        </form>
      </div>

      {dados.problemas.map((p) => (
        <div key={p} style={{ ...cartao, padding: '10px 14px', fontSize: 12.5, color: T.alert, background: T.alertSoft, border: 'none' }}>{p}</div>
      ))}

      {pessoa ? (
        <LinhaDoTempo resultado={pessoa} busca={busca} chave={chave} previas={dados.previas}
          abrir={(titulo, p, propria) => setAberta({ titulo, previa: p, propria })} />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {funis.map((f) => {
              const ativo = f.chave === funil.chave
              return (
                <a key={f.chave} href={`/funil?f=${f.chave}`} style={{
                  padding: '7px 16px', borderRadius: 99, fontSize: 13, fontWeight: 700, textDecoration: 'none',
                  background: ativo ? T.ink : T.surface, color: ativo ? '#fff' : T.inkSoft, border: ativo ? 'none' : `1px solid ${T.borderSoft}`,
                }}>{f.rotulo}</a>
              )
            })}
            <span style={{ flex: 1 }} />
            <div style={{ display: 'flex', background: T.surface, border: `1px solid ${T.borderSoft}`, borderRadius: 99, padding: 3 }}>
              {(['tudo', 'mensagens'] as const).map((k) => (
                <button key={k} onClick={() => setSo(k)} style={{
                  padding: '5px 12px', borderRadius: 99, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: fonts.ui,
                  background: so === k ? T.pinkSoft : 'transparent', color: so === k ? T.pinkDeep : T.inkSoft,
                }}>{k === 'tudo' ? 'Tudo' : 'Só mensagens'}</button>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: T.inkSoft }}>{funil.descricao} Números = últimos 7 dias.</div>

          {funil.secoes.map((sec, i) => sec.tipo === 'etapa' ? (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {i > 0 && <Seta />}
              <BlocoEtapa etapa={sec.etapa} vivo={dados.vivo} so={so} abrir={abrir} />
            </div>
          ) : (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Seta />
              <div style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 700, color: T.inkSoft }}>{sec.intro}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16, alignItems: 'start' }}>
                {[sec.esquerda, sec.direita].map((r) => (
                  <div key={r.rotulo} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ padding: '8px 14px', borderRadius: 12, fontWeight: 800, fontSize: 13.5,
                      background: r.tom === 'verde' ? T.greenSoft : T.goldSoft, color: r.tom === 'verde' ? T.green : T.goldDeep }}>{r.rotulo}</div>
                    {r.etapas.map((e, j) => (
                      <div key={e.n} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {j > 0 && <Seta />}
                        <BlocoEtapa etapa={e} vivo={dados.vivo} so={so} abrir={abrir} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {funil.atencao.length > 0 && (
            <div style={{ ...cartao, padding: 18, marginTop: 6 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Pontos de atenção</div>
              <div style={{ fontSize: 12.5, color: T.inkSoft, margin: '3px 0 12px' }}>Coisas que funcionam diferente do que parece — para decidir se vale mexer.</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 10 }}>
                {funil.atencao.map((a) => (
                  <div key={a.titulo} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 12, border: `1px dashed ${T.border}` }}>
                    <Selo texto={CANAL[a.canal].rotulo} cor={CANAL[a.canal].cor} fundo={CANAL[a.canal].fundo} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{a.titulo}</div>
                      <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 3, lineHeight: 1.45 }}>{a.detalhe}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {aberta && <Janela aberta={aberta} fechar={() => setAberta(null)} />}
    </div>
  )
}

function Seta() {
  return <div style={{ textAlign: 'center', color: T.inkMuted, fontSize: 18, lineHeight: '10px' }}>↓</div>
}

function BlocoEtapa({ etapa, vivo, so, abrir }: {
  etapa: Etapa; vivo: Record<string, Vivo>; so: 'tudo' | 'mensagens'; abrir: (t: string, p: Previa) => void
}) {
  const passos = so === 'mensagens' ? etapa.passos.filter((p) => MENSAGEM.includes(p.canal)) : etapa.passos
  if (!passos.length) return null
  return (
    <div style={{ ...cartao, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: T.pinkSoft, color: T.pinkDeep, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>{etapa.n}</div>
        <div>
          <div style={{ fontSize: 15.5, fontWeight: 700 }}>{etapa.titulo}</div>
          <div style={{ fontSize: 12, color: T.inkMuted, marginTop: 1 }}>{etapa.subtitulo}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {passos.map((p) => <LinhaPasso key={p.id} p={p} v={vivo[p.id]} abrir={abrir} />)}
      </div>
    </div>
  )
}

function LinhaPasso({ p, v, abrir }: { p: Passo; v?: Vivo; abrir: (t: string, pr: Previa) => void }) {
  const canal = CANAL[p.canal]
  const status = v?.status ?? p.status
  const apagado = status === 'off' || status === 'gap'
  const unica = p.previas?.length === 1 ? p.previas[0] : null
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={unica ? () => abrir(p.titulo, unica) : undefined}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 12,
        border: `1px ${apagado ? 'dashed' : 'solid'} ${hover && unica ? T.pinkBlush : T.borderSoft}`,
        background: apagado ? 'transparent' : hover && unica ? '#FFFBFD' : T.surface,
        cursor: unica ? 'pointer' : 'default', opacity: apagado ? 0.78 : 1, transition: 'background .12s, border-color .12s',
      }}>
      <div style={{ width: 4, borderRadius: 4, background: canal.cor, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Selo texto={canal.rotulo} cor={canal.cor} fundo={canal.fundo} />
          <span style={{ fontSize: 13.5, fontWeight: 700 }}>{p.titulo}</span>
          {status && <Selo texto={STATUS[status].rotulo} cor={STATUS[status].cor} fundo={STATUS[status].fundo} />}
          <span style={{ flex: 1 }} />
          {v?.enviados7d != null && (
            <span title={v.aprox ? 'Aproximado' : undefined} style={{ fontSize: 12, color: T.inkSoft, fontWeight: 600 }}>
              {v.aprox ? '≈ ' : ''}{v.enviados7d.toLocaleString('pt-BR')} <span style={{ color: T.inkMuted, fontWeight: 500 }}>em 7 dias</span>
            </span>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 5, fontWeight: 700 }}>{p.quando}</div>
        {p.regra && <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 3, lineHeight: 1.45 }}>{p.regra}</div>}
        {p.naoRecebe && <div style={{ fontSize: 12, color: T.inkMuted, marginTop: 3 }}>Não recebe: {p.naoRecebe}</div>}
        {v?.nota && <div style={{ fontSize: 12, color: apagado ? T.danger : T.goldDeep, marginTop: 5, lineHeight: 1.45 }}>{v.nota}</div>}
        {p.previas && p.previas.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 9 }}>
            {unica ? (
              <span style={{ fontSize: 12, fontWeight: 700, color: T.pinkDeep }}>Ver mensagem →</span>
            ) : p.previas.map((pr) => (
              <button key={pr.chave} onClick={(e) => { e.stopPropagation(); abrir(p.titulo, pr) }} style={{
                fontSize: 11.5, fontWeight: 700, padding: '5px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: fonts.ui,
                border: `1px solid ${T.pinkBlush}`, background: T.surface, color: T.pinkDeep,
              }}>{pr.rotulo ?? 'Ver'}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── linha do tempo de uma pessoa ────────────────────────────────────────────
function LinhaDoTempo({ resultado, busca, chave, previas, abrir }: {
  resultado: NonNullable<ResultadoPessoa>; busca: string; chave: string; previas: Record<string, PreviaPronta>
  abrir: (titulo: string, p: PreviaPronta | null, propria: boolean) => void
}) {
  const voltar = <a href={`/funil?f=${chave}`} style={{ fontSize: 13, fontWeight: 700, color: T.pinkDeep, textDecoration: 'none' }}>← Voltar ao mapa</a>
  if ('erro' in resultado) {
    return <div style={{ ...cartao, padding: 22 }}>{voltar}<div style={{ marginTop: 12, fontSize: 14 }}>{resultado.erro}</div></div>
  }
  const { pessoa, eventos } = resultado
  let diaAnterior = ''
  const recebidas = eventos.filter((e) => MENSAGEM.includes(e.canal) && !e.dela).length
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {voltar}
      <div style={{ ...cartao, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ width: 46, height: 46, borderRadius: 23, background: T.pinkSoft, color: T.pinkDeep, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18 }}>
          {(pessoa.nome ?? busca).trim().charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{pessoa.nome ?? 'Sem nome'}</div>
          <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 2 }}>{[...pessoa.emails, ...pessoa.telefones].join(' · ')}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {pessoa.selos.map((s) => <Selo key={s} texto={s} cor={T.ink} fundo={T.cream} />)}
          <Selo texto={`${recebidas} mensagens recebidas`} cor={T.pinkDeep} fundo={T.pinkSoft} />
        </div>
      </div>
      <div style={{ ...cartao, padding: '6px 20px 14px' }}>
        {eventos.length === 0 && <div style={{ padding: '14px 0', fontSize: 13, color: T.inkSoft }}>Nada registrado ainda.</div>}
        {eventos.map((e, i) => {
          const { dia, hora } = brasilia(e.quando)
          const cabecalho = dia !== diaAnterior ? dia : null
          diaAnterior = dia
          const previa = e.previaPropria ?? (e.previa ? previas[e.previa] ?? null : null)
          const temPrevia = !!(e.previaPropria || e.previa)
          const canal = CANAL[e.canal]
          return (
            <div key={i}>
              {cabecalho && <div style={{ fontSize: 11.5, fontWeight: 800, color: T.inkMuted, textTransform: 'uppercase', letterSpacing: 0.6, margin: '16px 0 6px' }}>{cabecalho}</div>}
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '8px 0', borderTop: cabecalho ? 'none' : `1px solid ${T.borderSoft}` }}>
                <div style={{ width: 44, fontSize: 12, color: T.inkSoft, fontWeight: 600, paddingTop: 2, fontVariantNumeric: 'tabular-nums' }}>{hora}</div>
                <div style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6, background: e.dela ? 'transparent' : canal.cor, border: `2px solid ${canal.cor}`, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13.5, fontWeight: e.dela ? 500 : 700, color: e.dela ? T.inkSoft : T.ink }}>{e.titulo}</span>
                    <Selo texto={e.dela ? 'ela' : canal.rotulo} cor={e.dela ? T.inkSoft : canal.cor} fundo={e.dela ? T.cream : canal.fundo} />
                    {e.deduzido && <span title="Este envio não deixa registro próprio; foi deduzido de outro evento." style={{ fontSize: 11, color: T.inkMuted }}>deduzido</span>}
                  </div>
                  {e.detalhe && <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 2, lineHeight: 1.45 }}>{e.detalhe}</div>}
                </div>
                {temPrevia && (
                  <button onClick={() => abrir(e.titulo, previa, !!e.previaPropria)} style={{
                    fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 9, cursor: 'pointer', fontFamily: fonts.ui,
                    border: `1px solid ${T.pinkBlush}`, background: T.surface, color: T.pinkDeep, flexShrink: 0,
                  }}>Ver</button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── a janela de pré-visualização ────────────────────────────────────────────
function Janela({ aberta, fechar }: { aberta: Aberta; fechar: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [fechar])
  const p = aberta.previa
  const largo = p?.canal === 'email'
  return (
    <div onClick={fechar} style={{ position: 'fixed', inset: 0, background: 'rgba(42,30,44,0.42)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: T.surface, borderRadius: 20, width: largo ? 760 : 460, maxWidth: '100%', maxHeight: '92vh',
        display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(42,30,44,0.28)', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: `1px solid ${T.borderSoft}` }}>
          {p && <Selo texto={CANAL[p.canal].rotulo} cor={CANAL[p.canal].cor} fundo={CANAL[p.canal].fundo} />}
          <div style={{ flex: 1, fontSize: 14.5, fontWeight: 700 }}>{aberta.titulo}</div>
          <button onClick={fechar} aria-label="Fechar" style={{ border: 'none', background: T.cream, width: 30, height: 30, borderRadius: 15, cursor: 'pointer', fontSize: 15, color: T.inkSoft }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', padding: 20 }}>
          {!p ? (
            <div style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.5 }}>
              Não consegui carregar esta mensagem agora{aberta.chave?.startsWith('wa:') ? ' (o template pode ter sido apagado na Meta, ou a Meta não respondeu)' : ''}. Recarregue a página para tentar de novo.
            </div>
          ) : (
            <>
              {p.aviso && <div style={{ fontSize: 12.5, fontWeight: 700, color: T.danger, background: T.dangerSoft, padding: '8px 12px', borderRadius: 10, marginBottom: 14 }}>{p.aviso}</div>}
              {p.canal === 'whatsapp' && p.wa && <Whats wa={p.wa} />}
              {p.canal === 'sms' && p.texto != null && <Sms texto={p.texto} />}
              {p.canal === 'email' && <Email assunto={p.assunto} html={p.html} />}
              {p.canal === 'ligacao' && p.ficha && <Ficha f={p.ficha} />}
              <div style={{ fontSize: 11.5, color: T.inkMuted, marginTop: 16, lineHeight: 1.5 }}>
                {p.fonte}{aberta.propria ? '' : ' Nome e dados são de exemplo (Maria); na hora do envio entram os dela.'}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Celular({ children, fundo, topo }: { children: ReactNode; fundo: string; topo: ReactNode }) {
  return (
    <div style={{ borderRadius: 26, border: '8px solid #1D1D1F', overflow: 'hidden', background: fundo, maxWidth: 380, margin: '0 auto' }}>
      {topo}
      <div style={{ padding: '14px 12px 18px', minHeight: 220 }}>{children}</div>
    </div>
  )
}

function Whats({ wa }: { wa: NonNullable<PreviaPronta['wa']> }) {
  const tipo = !wa.template ? 'Texto livre — só chega dentro de 24 h depois que ela mandou mensagem'
    : wa.categoria === 'MARKETING' ? 'Template de marketing (cobrado por mensagem, a Meta pode limitar a entrega)'
    : wa.categoria === 'UTILITY' ? 'Template de utilidade' : `Template ${wa.categoria ?? ''}`
  return (
    <div>
      <Celular fundo="#EFE7DD" topo={
        <div style={{ background: '#075E54', color: '#fff', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 15, background: '#BE185D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif', fontStyle: 'italic', fontWeight: 700, fontSize: 13 }}>Ju</div>
          <div><div style={{ fontSize: 14, fontWeight: 600 }}>Juliane Cost</div><div style={{ fontSize: 11, opacity: 0.8 }}>conta comercial</div></div>
        </div>
      }>
        <div style={{ maxWidth: '88%' }}>
          <div style={{ background: '#fff', borderRadius: '0 10px 10px 10px', padding: '8px 10px 6px', boxShadow: '0 1px 1px rgba(0,0,0,0.12)', fontSize: 14, lineHeight: 1.42, color: '#111B21', fontFamily: '-apple-system, system-ui, sans-serif' }}>
            {wa.cabecalho && <div style={{ fontWeight: 700, marginBottom: 4 }}>{wa.cabecalho}</div>}
            <div dangerouslySetInnerHTML={{ __html: formatarWa(wa.corpo) }} />
            {wa.rodape && <div style={{ fontSize: 12, color: '#667781', marginTop: 6 }}>{wa.rodape}</div>}
            <div style={{ fontSize: 10.5, color: '#667781', textAlign: 'right', marginTop: 2 }}>10:42</div>
          </div>
          {wa.botoes.map((b) => (
            <div key={b.texto} title={b.url} style={{ background: '#fff', borderRadius: 10, marginTop: 4, padding: '9px 10px', textAlign: 'center', color: '#027EB5', fontSize: 14, fontWeight: 500, boxShadow: '0 1px 1px rgba(0,0,0,0.12)', fontFamily: '-apple-system, system-ui, sans-serif' }}>
              {b.tipo === 'URL' ? '↗ ' : '↩ '}{b.texto}
            </div>
          ))}
        </div>
      </Celular>
      <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 12, textAlign: 'center' }}>
        {tipo}{wa.status && wa.status !== 'APPROVED' ? ` · status na Meta: ${wa.status}` : ''}
      </div>
      {wa.botoes.some((b) => b.url) && (
        <div style={{ fontSize: 11.5, color: T.inkMuted, marginTop: 6, textAlign: 'center', wordBreak: 'break-all' }}>
          {wa.botoes.filter((b) => b.url).map((b) => `${b.texto}: ${b.url}`).join(' · ')}
        </div>
      )}
    </div>
  )
}

function Sms({ texto }: { texto: string }) {
  const { n, partes, gsm } = partesSms(texto)
  return (
    <div>
      <Celular fundo="#fff" topo={
        <div style={{ textAlign: 'center', padding: '12px 0 8px', borderBottom: '1px solid #eee', fontFamily: '-apple-system, system-ui, sans-serif' }}>
          <div style={{ width: 34, height: 34, borderRadius: 17, background: '#C7C7CC', margin: '0 auto 4px' }} />
          <div style={{ fontSize: 11.5, color: '#3C3C43' }}>Mensagem de texto</div>
        </div>
      }>
        <div style={{ maxWidth: '82%', background: '#E9E9EB', borderRadius: 18, padding: '9px 13px', fontSize: 15, lineHeight: 1.35, color: '#000', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: '-apple-system, system-ui, sans-serif' }}>
          {texto}
        </div>
      </Celular>
      <div style={{ fontSize: 12, color: partes > 1 ? T.goldDeep : T.inkSoft, marginTop: 12, textAlign: 'center' }}>
        {n} caracteres · {partes === 1 ? '1 SMS' : `${partes} SMS (a operadora cobra cada parte)`}{gsm ? '' : ' · tem caractere especial, cada parte cabe menos'}
      </div>
    </div>
  )
}

function Email({ assunto, html }: { assunto?: string; html?: string }) {
  return (
    <div>
      <div style={{ border: `1px solid ${T.borderSoft}`, borderRadius: 12, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>
        <div><span style={{ color: T.inkMuted }}>De:</span> Juliane Cost</div>
        <div style={{ marginTop: 3 }}><span style={{ color: T.inkMuted }}>Assunto:</span> <b>{assunto ?? '(sem assunto)'}</b></div>
      </div>
      {/* Sem allow-scripts: nada do e-mail roda aqui. ("" em branco não renderiza em alguns navegadores.) */}
      <iframe title="Prévia do e-mail" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" srcDoc={html ?? ''} style={{ width: '100%', height: '62vh', border: `1px solid ${T.borderSoft}`, borderRadius: 12, background: '#fff' }} />
    </div>
  )
}

function Ficha({ f }: { f: NonNullable<PreviaPronta['ficha']> }) {
  const sf = '-apple-system, system-ui, sans-serif'
  return (
    <Celular fundo="#fff" topo={<div style={{ height: 6 }} />}>
      <div style={{ fontFamily: sf, color: '#1D1D1F' }}>
        <div style={{ fontSize: 12, color: '#BE185D', fontWeight: 600 }}>Chamando… 0:07</div>
        <div style={{ fontSize: 26, fontWeight: 600, marginTop: 4 }}>{f.nome}</div>
        <div style={{ display: 'inline-block', marginTop: 8, fontSize: 12, color: '#6E6E73', border: '1px solid #D2D2D7', borderRadius: 20, padding: '2px 9px' }}>{f.tentativa}</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginTop: 14 }}>{f.motivo}</div>
        <div style={{ fontSize: 13, color: '#6E6E73', marginTop: 3, lineHeight: 1.4 }}>{f.detalhe}</div>
        <div style={{ background: '#F5F5F7', borderRadius: 14, padding: 14, marginTop: 14 }}>
          <div style={{ fontSize: 24, fontWeight: 600 }}>{f.valor}</div>
          <div style={{ fontSize: 13, color: '#6E6E73' }}>{f.pagamento}</div>
          <div style={{ fontSize: 12.5, color: '#86868B' }}>{f.quando}</div>
          <div style={{ fontSize: 13.5, marginTop: 8 }}>• Consulta com a Tricologista Juliane Cost</div>
        </div>
        <div style={{ fontSize: 12, color: '#86868B', marginTop: 12 }}>Mandar o link de pagamento</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          {['WhatsApp', 'SMS'].map((b) => <div key={b} style={{ flex: 1, textAlign: 'center', border: '1px solid #D2D2D7', borderRadius: 12, padding: '9px 0', fontSize: 14, fontWeight: 600 }}>{b}</div>)}
        </div>
        <div style={{ fontSize: 12, color: '#86868B', marginTop: 16 }}>Depois de desligar, ela marca:</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
          {f.resultados.map((r) => <div key={r} style={{ textAlign: 'center', background: '#F5F5F7', borderRadius: 10, padding: '8px 0', fontSize: 13 }}>{r}</div>)}
        </div>
      </div>
    </Celular>
  )
}
