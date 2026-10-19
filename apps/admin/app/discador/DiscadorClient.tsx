'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useState } from 'react'

const ink = '#2A1E2C'
const gray = '#7C6B7E'
const accent = '#BE185D'
const green = '#16A34A'

const MOTIVO: Record<string, string> = {
  pix_nao_pago: 'Gerou o PIX e não pagou',
  cartao_recusado: 'Cartão recusado',
  checkout_abandonado: 'Abriu o pagamento e saiu',
  quiz_sem_checkout: 'Fez o quiz e não abriu o pagamento',
}
const ERRO_TIPO: Record<string, string> = {
  travou: 'App fechou com erro', chamada_sumiu: 'Ligação não chegou ao app', perdeu_padrao: 'Deixou de ser o telefone padrão', sms_falhou: 'SMS não saiu', outro: 'Outro',
}
const DESFECHO: Record<string, string> = {
  atendeu: 'Atendeu', nao_atendeu: 'Não atendeu', ocupado: 'Ocupado', recusou: 'Recusou',
  caixa_postal: 'Caixa postal', erro: 'Erro', pulou: 'Pulou', expirou: 'Expirou',
}
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const dataHora = (iso?: string | null) => iso
  ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
  : '—'

function Card({ titulo, children, extra }: { titulo: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <section style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', marginBottom: 20 }}>
      <div style={{ padding: '16px 22px', borderBottom: '1px solid #F3EBE1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: ink }}>{titulo}</div>
        {extra}
      </div>
      <div style={{ padding: '16px 22px' }}>{children}</div>
    </section>
  )
}

function Chave({ ligado, onChange, rotulo }: { ligado: boolean; onChange: (v: boolean) => void; rotulo: string }) {
  return (
    <button onClick={() => onChange(!ligado)} style={{
      display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit',
    }}>
      <span style={{ width: 42, height: 24, borderRadius: 99, background: ligado ? green : '#D6CED8', position: 'relative', transition: 'background .2s' }}>
        <span style={{ position: 'absolute', top: 3, left: ligado ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
      </span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: ink }}>{rotulo}: <span style={{ color: ligado ? green : gray }}>{ligado ? 'ligado' : 'desligado'}</span></span>
    </button>
  )
}

function Num({ rotulo, valor, onChange, sufixo }: { rotulo: string; valor: number; onChange: (n: number) => void; sufixo?: string }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: gray }}>
      {rotulo}
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input type="number" value={valor} onChange={(e) => onChange(Number(e.target.value))}
          style={{ width: 80, padding: '7px 9px', borderRadius: 8, border: '1px solid #E6DEE8', fontSize: 13.5, fontFamily: 'inherit' }} />
        {sufixo && <span style={{ fontSize: 12 }}>{sufixo}</span>}
      </span>
    </label>
  )
}

const btn = (cor = accent): React.CSSProperties => ({
  padding: '8px 14px', borderRadius: 8, border: 'none', background: cor, color: '#fff',
  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
})

export default function DiscadorClient() {
  const [d, setD] = useState<any>(null)
  const [p, setP] = useState<any>(null)
  const [msg, setMsg] = useState('')
  const [sim, setSim] = useState<any>(null)
  const [codigo, setCodigo] = useState('')
  const [novaAt, setNovaAt] = useState({ nome: '', foto_url: '' })

  const carregar = useCallback(async () => {
    const r = await fetch('/api/discador-painel', { cache: 'no-store' })
    const j = await r.json()
    setD(j); setP(j.parametros)
  }, [])
  useEffect(() => { carregar() }, [carregar])

  async function patch(body: any) {
    setMsg('')
    const r = await fetch('/api/discador-painel', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const j = await r.json()
    setMsg(r.ok ? '✓ Salvo' : `Erro: ${j.error}`)
    carregar()
  }
  async function post(body: any) {
    const r = await fetch('/api/discador-painel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const j = await r.json()
    if (!r.ok) { setMsg(`Erro: ${j.error}`); return null }
    return j
  }

  if (!d || !p) return <div style={{ color: gray }}>Carregando…</div>
  const set = (k: string, v: any) => setP((x: any) => ({ ...x, [k]: v }))

  return (
    <>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: ink }}>Discador</div>
        <div style={{ fontSize: 13, color: gray, marginTop: 4, maxWidth: 760 }}>
          O celular da empresa liga sozinho para quem tentou comprar e não pagou. O painel manda; o app só pergunta
          &ldquo;quem é o próximo?&rdquo;. Tudo nasce desligado.
        </div>
      </div>

      <Card titulo="Liga / desliga" extra={msg && <span style={{ fontSize: 12.5, color: msg.startsWith('✓') ? green : '#DC2626' }}>{msg}</span>}>
        <div style={{ display: 'flex', gap: 30, flexWrap: 'wrap' }}>
          <Chave rotulo="Robô que monta a fila" ligado={d.motorLigado} onChange={(v) => patch({ motor_ligado: v })} />
          <Chave rotulo="App liga para a fila" ligado={d.ligado} onChange={(v) => patch({ ligado: v })} />
        </div>
        <div style={{ fontSize: 12, color: gray, marginTop: 10, lineHeight: 1.5 }}>
          O robô só considera quem tentou comprar <strong>depois</strong> de ser ligado
          {p.ligado_desde ? <> (ligado em {dataHora(p.ligado_desde)})</> : null} — nunca a base antiga.
          Quem paga sai da fila sozinho, mesmo com o robô desligado.
        </div>
      </Card>

      <Card titulo="Hoje">
        <div style={{ display: 'flex', gap: 32, fontSize: 13.5, color: ink }}>
          <div><strong style={{ fontSize: 22 }}>{d.fila.length}</strong><br /><span style={{ color: gray }}>na fila</span></div>
          <div><strong style={{ fontSize: 22 }}>{d.hoje.ligacoes}</strong><br /><span style={{ color: gray }}>ligações</span></div>
          <div><strong style={{ fontSize: 22 }}>{d.hoje.atendidas}</strong><br /><span style={{ color: gray }}>atenderam</span></div>
          <div><strong style={{ fontSize: 22 }}>{d.hoje.vaiPagar}</strong><br /><span style={{ color: gray }}>vão pagar</span></div>
          <div><strong style={{ fontSize: 22 }}>{d.hoje.minutos}</strong><br /><span style={{ color: gray }}>min falando</span></div>
        </div>
      </Card>

      <Card titulo="Regras e números" extra={
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btn('#6B5B6E')} onClick={async () => { setSim(null); setSim(await post({ acao: 'simular' })) }}>Simular</button>
          <button style={btn()} onClick={() => patch({ parametros: p })}>Salvar</button>
        </div>
      }>
        {sim && (
          <div style={{ background: '#F5F0F7', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: ink, lineHeight: 1.6 }}>
            <strong>Simulação (não criou nada):</strong> {sim.novas?.pix_nao_pago ?? 0} PIX não pagos ·{' '}
            {sim.novas?.cartao_recusado ?? 0} cartões · {sim.novas?.checkout_abandonado ?? 0} abriram o pagamento e saíram ·{' '}
            {sim.novas?.quiz_sem_checkout ?? 0} do quiz · {sim.semTelefone ?? 0} sem telefone.
            {!d.motorLigado && <> Com o robô desligado, a simulação olha os últimos {p.janela_dias} dias.</>}
          </div>
        )}
        <div style={{ fontSize: 12.5, fontWeight: 700, color: ink, margin: '0 0 8px' }}>Quando cada um entra na fila</div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 16 }}>
          <Num rotulo="PIX não pago, depois de" valor={p.espera_pix_min} sufixo="min" onChange={(n) => set('espera_pix_min', n)} />
          <Num rotulo="Cartão recusado, depois de" valor={p.espera_cartao_min} sufixo="min" onChange={(n) => set('espera_cartao_min', n)} />
          <Num rotulo="Abriu o pagamento e saiu" valor={p.espera_checkout_min} sufixo="min" onChange={(n) => set('espera_checkout_min', n)} />
          <Num rotulo="Fez o quiz e não abriu" valor={p.espera_quiz_min} sufixo="min" onChange={(n) => set('espera_quiz_min', n)} />
          <Num rotulo="Máx. novos do quiz por dia" valor={p.limite_quiz_dia} onChange={(n) => set('limite_quiz_dia', n)} />
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: ink, margin: '0 0 8px' }}>Tentativas</div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 16 }}>
          <Num rotulo="Tentativas por pessoa" valor={p.tentativas_max} onChange={(n) => set('tentativas_max', n)} />
          <Num rotulo="Intervalo entre tentativas" valor={p.intervalo_horas} sufixo="h" onChange={(n) => set('intervalo_horas', n)} />
          <Num rotulo="'Ligar depois' volta em" valor={p.ligar_depois_horas} sufixo="h" onChange={(n) => set('ligar_depois_horas', n)} />
          <Num rotulo="Tempo chamando" valor={p.toque_segundos} sufixo="s" onChange={(n) => set('toque_segundos', n)} />
          <Num rotulo="Pausa entre ligações" valor={p.pausa_segundos} sufixo="s" onChange={(n) => set('pausa_segundos', n)} />
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: ink, margin: '0 0 8px' }}>Horário (Brasília)</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          {DIAS.map((dn, i) => {
            const on = p.horario.dias.includes(i)
            return (
              <button key={dn} onClick={() => set('horario', { ...p.horario, dias: on ? p.horario.dias.filter((x: number) => x !== i) : [...p.horario.dias, i].sort() })}
                style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${on ? accent : '#E6DEE8'}`, background: on ? accent : '#fff', color: on ? '#fff' : gray, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {dn}
              </button>
            )
          })}
          <input type="time" value={p.horario.inicio} onChange={(e) => set('horario', { ...p.horario, inicio: e.target.value })} style={{ marginLeft: 10, padding: 6, borderRadius: 8, border: '1px solid #E6DEE8' }} />
          <span style={{ color: gray }}>às</span>
          <input type="time" value={p.horario.fim} onChange={(e) => set('horario', { ...p.horario, fim: e.target.value })} style={{ padding: 6, borderRadius: 8, border: '1px solid #E6DEE8' }} />
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: ink, margin: '0 0 8px' }}>Mensagens</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: ink, marginBottom: 8 }}>
          <input type="checkbox" checked={!!p.sms_sem_atender} onChange={(e) => set('sms_sem_atender', e.target.checked)} />
          Mandar SMS pelo chip do celular quando a pessoa não atende (no máximo 1 por dia por telefone)
        </label>
        <textarea value={p.sms_texto} onChange={(e) => set('sms_texto', e.target.value)} rows={2}
          style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #E6DEE8', fontSize: 13, fontFamily: 'inherit', marginBottom: 4 }} />
        {(() => {
          // Com um nome e uma atendente de tamanho comum; sai sem acento (160 caracteres = 1 SMS).
          const n = String(p.sms_texto ?? '').replaceAll('{nome}', 'Fernanda').replaceAll('{atendente}', 'Juliana')
            .replaceAll('{link}', 'planodaju.julianecost.com/oferta').length
          return (
            <div style={{ fontSize: 12, color: n > 160 ? '#B45309' : gray, marginBottom: 10 }}>
              SMS é aviso: não precisa de link (se quiser, {'{link}'} põe o da oferta). ≈ {n} caracteres · {n > 160 ? `${Math.ceil(n / 153)} SMS por envio — encurte para caber em 1` : '1 SMS'}
            </div>
          )
        })()}
        <div style={{ fontSize: 12, color: gray, marginBottom: 6 }}>Mensagem do botão &ldquo;mandar o link&rdquo; (WhatsApp/SMS do celular):</div>
        <textarea value={p.mensagem_link} onChange={(e) => set('mensagem_link', e.target.value)} rows={2}
          style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #E6DEE8', fontSize: 13, fontFamily: 'inherit' }} />
        <div style={{ fontSize: 11.5, color: gray, marginTop: 6 }}>Use {'{nome}'}, {'{atendente}'} e {'{link}'}.</div>
      </Card>

      <Card titulo="Atendente e celular">
        {d.atendentes.length === 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <input placeholder="Nome da atendente" value={novaAt.nome} onChange={(e) => setNovaAt({ ...novaAt, nome: e.target.value })}
              style={{ padding: 8, borderRadius: 8, border: '1px solid #E6DEE8', fontSize: 13 }} />
            <input placeholder="Link da foto (opcional)" value={novaAt.foto_url} onChange={(e) => setNovaAt({ ...novaAt, foto_url: e.target.value })}
              style={{ padding: 8, borderRadius: 8, border: '1px solid #E6DEE8', fontSize: 13, minWidth: 260 }} />
            <button style={btn()} onClick={async () => { if (await post({ acao: 'atendente', ...novaAt })) { setNovaAt({ nome: '', foto_url: '' }); carregar() } }}>Cadastrar</button>
          </div>
        )}
        {d.atendentes.map((a: any) => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            {a.foto_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={a.foto_url} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
              : <span style={{ width: 40, height: 40, borderRadius: '50%', background: '#F5E6EC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: accent }}>{a.nome[0]}</span>}
            <strong style={{ color: ink, fontSize: 14 }}>{a.nome}</strong>
            <button style={btn()} onClick={async () => { const j = await post({ acao: 'parear', atendente_id: a.id }); if (j) { setCodigo(j.codigo); carregar() } }}>
              Parear um celular
            </button>
          </div>
        ))}
        {codigo && (
          <div style={{ background: '#ECFDF5', border: '1px solid #86EFAC', borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
            Digite no app: <strong style={{ fontSize: 22, letterSpacing: 3, fontFamily: 'ui-monospace, monospace' }}>{codigo}</strong>
            <span style={{ fontSize: 12, color: gray, marginLeft: 10 }}>vale 10 minutos, uma vez só</span>
          </div>
        )}
        {d.aparelhos.filter((x: any) => x.pareado_em && !x.revogado_em).map((x: any) => {
          const online = x.ultimo_contato_em && Date.now() - new Date(x.ultimo_contato_em).getTime() < 2 * 60_000
          return (
            <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: ink, padding: '8px 0', borderTop: '1px solid #F3EBE1' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: online ? green : '#D6CED8' }} />
              <span>{x.nome} · {x.modelo ?? '—'} · app {x.app_versao ?? '—'} · {x.pausado ? 'pausado' : (x.estado ?? 'parado')} · visto {dataHora(x.ultimo_contato_em)}</span>
              {x.padrao === false && <span style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', background: '#FEE2E2', borderRadius: 20, padding: '2px 8px' }}>NÃO é o app de telefone padrão</span>}
              {x.padrao === true && <span style={{ fontSize: 12, fontWeight: 700, color: green, background: '#E1F5EB', borderRadius: 20, padding: '2px 8px' }}>app de telefone padrão</span>}
              {x.padrao == null && <span style={{ fontSize: 12, color: gray }}>atualize o app para ver se é o telefone padrão</span>}
              <button style={btn('#6B5B6E')} onClick={async () => { await post({ acao: 'pausar', id: x.id, pausado: !x.pausado }); carregar() }}>{x.pausado ? 'Retomar' : 'Pausar'}</button>
              <button style={btn('#DC2626')} onClick={async () => { if (confirm('Desligar este celular? Ele precisa parear de novo.')) { await post({ acao: 'revogar', id: x.id }); carregar() } }}>Desligar</button>
            </div>
          )
        })}
      </Card>

      {(d.erros ?? []).length > 0 && (
        <Card titulo="Problemas que o celular relatou">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              {d.erros.map((e: any) => (
                <tr key={e.id} style={{ borderTop: '1px solid #F3EBE1', verticalAlign: 'top' }}>
                  <td style={{ padding: 6, whiteSpace: 'nowrap' }}>{dataHora(e.criado_em)}</td>
                  <td style={{ padding: 6, whiteSpace: 'nowrap' }}><strong>{ERRO_TIPO[e.tipo] ?? e.tipo}</strong><div style={{ fontSize: 11, color: gray }}>app {e.app_versao ?? '—'}</div></td>
                  <td style={{ padding: 6 }}>{e.mensagem}
                    {e.tipo === 'sms_falhou' && e.detalhe?.codigo_operadora > 0 && <div style={{ fontSize: 11, color: gray }}>código da operadora {e.detalhe.codigo_operadora} · {e.detalhe.tem_link ? 'com link' : 'sem link'}{e.detalhe.teste ? ' · teste' : ''}</div>}
                    {e.detalhe?.rastro && <details style={{ marginTop: 4 }}><summary style={{ fontSize: 11, color: gray, cursor: 'pointer' }}>detalhe técnico</summary><pre style={{ fontSize: 10.5, whiteSpace: 'pre-wrap', color: gray }}>{String(e.detalhe.rastro).slice(0, 3000)}</pre></details>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card titulo={`Fila (${d.fila.length})`}>
        <div style={{ fontSize: 12, color: gray, marginBottom: 10 }}>
          Só entra quem fez o quiz da consulta ou tentou pagar e não pagou. Ficam de fora, conferido por e-mail E telefone: quem já pagou, quem tem ou teve cortesia, quem pediu para não receber mensagens e a equipe.
        </div>
        {d.fila.length === 0 ? <div style={{ color: gray, fontSize: 13 }}>Fila vazia.</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ color: gray, textAlign: 'left', fontSize: 11, textTransform: 'uppercase' }}>
              <th style={{ padding: 6 }}>Cliente</th><th style={{ padding: 6 }}>Motivo</th><th style={{ padding: 6 }}>Tentativas</th><th style={{ padding: 6 }}>Próxima</th>
            </tr></thead>
            <tbody>
              {d.fila.map((t: any) => (
                <tr key={t.id} style={{ borderTop: '1px solid #F3EBE1' }}>
                  <td style={{ padding: 6 }}><strong>{t.nome ?? t.email}</strong><div style={{ fontSize: 11, color: gray }}>{t.email}</div></td>
                  <td style={{ padding: 6 }}>{MOTIVO[t.motivo] ?? t.motivo}</td>
                  <td style={{ padding: 6 }}>{t.tentativas} de {p.tentativas_max}</td>
                  <td style={{ padding: 6 }}>{dataHora(t.proxima_em)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card titulo="Últimas ligações">
        {d.chamadas.length === 0 ? <div style={{ color: gray, fontSize: 13 }}>Nenhuma ligação ainda.</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              {d.chamadas.map((c: any) => (
                <tr key={c.id} style={{ borderTop: '1px solid #F3EBE1' }}>
                  <td style={{ padding: 6 }}>{dataHora(c.criada_em)}</td>
                  <td style={{ padding: 6 }}><strong>{c.discador_tarefas?.nome ?? '—'}</strong></td>
                  <td style={{ padding: 6 }}>tentativa {c.tentativa}</td>
                  <td style={{ padding: 6 }}>{DESFECHO[c.desfecho] ?? '—'}{c.duracao_s ? ` · ${Math.round(c.duracao_s / 60)} min` : ''}</td>
                  <td style={{ padding: 6, color: gray }}>{c.chip ?? ''}</td>
                  <td style={{ padding: 6 }}>{c.resultado ?? ''}{c.nota ? ` — ${c.nota}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  )
}
