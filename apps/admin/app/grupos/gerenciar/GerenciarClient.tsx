'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'

type Group = {
  id: string
  name: string
  jid: string | null
  invite_link: string | null
  invite_code: string | null
  member_count: number
  capacity: number
  status: 'active' | 'full' | 'archived'
  is_receiving: boolean
  last_synced_at: string | null
  created_at: string
  link_ok: boolean | null
  link_checked_at: string | null
  entradas_desde_contagem: number | null
  contagem_em: string | null
}

type DiscoveredGroup = {
  id: string       // JID
  subject: string
  size: number
  instanceName: string
  already_saved: boolean
}

type Instancia = { name: string; connectionStatus: string }

const accent  = '#BE185D'
const green   = '#22A06B'
const orange  = '#D97706'
const red     = '#DC2626'
const gray    = '#7C6B7E'
const ink     = '#2A1E2C'

const WA = 'https://chat.whatsapp.com/'
const cap = (g: Group) => g.capacity || 1024
// Ocupação estimada: última contagem + quem entrou pelo /g/entrar desde então.
const estimado = (g: Group) => (g.member_count ?? 0) + (g.entradas_desde_contagem ?? 0)
const temVaga = (g: Group) => estimado(g) < cap(g)
const linkValido = (g: Group) => g.link_ok === true && (g.invite_link ?? '').startsWith(WA)
const dataCurta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'
const num = (n: number) => n.toLocaleString('pt-BR')

/**
 * Qual grupo recebe o próximo lead. Mesma ordem da função wg_grupo_escolher
 * do banco (migração 020), para a tela mostrar o que o /g/entrar vai fazer.
 */
function proximoGrupo(groups: Group[]): { grupo: Group; motivo: string; nivel: number } | null {
  const aptos = groups.filter(g => g.status === 'active' && linkValido(g))
  if (!aptos.length) return null
  const nivel = (g: Group) => (g.is_receiving && temVaga(g)) ? 0 : temVaga(g) ? 1 : 2
  const [grupo] = [...aptos].sort((a, b) => nivel(a) - nivel(b) || estimado(a) - estimado(b))
  const n = nivel(grupo)
  const motivo = n === 0
    ? 'Marcado como recebendo e com vaga.'
    : n === 1
      ? 'Está pausado, mas os marcados como recebendo lotaram — é o grupo com mais vaga.'
      : 'Todos estão cheios pela estimativa: os leads vão para o menos ocupado. Cadastre um grupo novo.'
  return { grupo, motivo, nivel: n }
}

function badge(g: Group) {
  if (g.status === 'archived')            return { label: 'Arquivado', color: gray }
  if (g.status === 'full' || !temVaga(g)) return { label: 'Cheio', color: red }
  if (g.is_receiving)                     return { label: 'Recebendo', color: green }
  return { label: 'Pausado', color: orange }
}

function linkBadge(g: Group) {
  if (!g.invite_link)      return { label: 'Sem link — não recebe', color: orange }
  if (g.link_ok === true)  return { label: `Link ok · ${dataCurta(g.link_checked_at)}`, color: green }
  if (g.link_ok === false) return { label: 'Link quebrado — não recebe', color: red }
  return { label: 'Link não confirmado — não recebe', color: orange }
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 9, fontSize: 13, border: '1px solid #E0E0E8',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}
const botaoMini = (cor: string): React.CSSProperties => ({
  fontSize: 12, color: cor, background: cor + '14', border: `1px solid ${cor}30`,
  cursor: 'pointer', padding: '5px 11px', borderRadius: 8, fontWeight: 600, fontFamily: 'inherit',
})

export default function GerenciarClient({ initialGroups }: { initialGroups: Group[] }) {
  const [groups, setGroups]             = useState<Group[]>(initialGroups)
  const [showForm, setShowForm]         = useState(false)
  const [inviteLink, setInviteLink]     = useState('')
  const [groupName, setGroupName]       = useState('')
  const [novoMembros, setNovoMembros]   = useState('')
  const [novoLimite, setNovoLimite]     = useState('1024')
  const [adding, setAdding]             = useState(false)
  const [syncing, setSyncing]           = useState(false)
  const [syncResult, setSyncResult]     = useState<string | null>(null)
  const [bulkResult, setBulkResult]     = useState<string | null>(null)
  const [bulking, setBulking]           = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [, startTransition]             = useTransition()

  // Situação do Evolution: sem número conectado, nada se atualiza sozinho.
  const [instancias, setInstancias] = useState<Instancia[] | null>(null)
  useEffect(() => {
    let vivo = true
    fetch('/api/grupos/instances')
      .then(r => (r.ok ? r.json() : []))
      .then(d => { if (vivo) setInstancias(Array.isArray(d) ? d : []) })
      .catch(() => { if (vivo) setInstancias([]) })
    return () => { vivo = false }
  }, [])
  const evoCarregando = instancias === null
  const conectadas = (instancias ?? []).filter(i => i.connectionStatus === 'open')
  const evoOnline = conectadas.length > 0

  // Edição inline (um grupo por vez)
  const [edit, setEdit]               = useState<{ id: string; tipo: 'link' | 'contagem' } | null>(null)
  const [editLink, setEditLink]       = useState('')
  const [editMembros, setEditMembros] = useState('')
  const [editLimite, setEditLimite]   = useState('')
  const [salvando, setSalvando]       = useState(false)

  // Contagem em lote: o operador confere no WhatsApp e lança todos de uma vez.
  const [lote, setLote]                   = useState(false)
  const [loteValores, setLoteValores]     = useState<Record<string, string>>({})
  const [salvandoLote, setSalvandoLote]   = useState(false)
  const [loteResultado, setLoteResultado] = useState<string | null>(null)

  // Discover
  const [discovering, setDiscovering]           = useState(false)
  const [discoveredGroups, setDiscoveredGroups] = useState<DiscoveredGroup[] | null>(null)
  const [selectedJids, setSelectedJids]         = useState<Set<string>>(new Set())
  const [importing, setImporting]               = useState(false)
  const [importResult, setImportResult]         = useState<string | null>(null)

  const proximo = useMemo(() => proximoGrupo(groups), [groups])
  const visible = showArchived ? groups : groups.filter(g => g.status !== 'archived')

  async function patch(g: Group, body: Record<string, unknown>) {
    const res = await fetch(`/api/grupos/${g.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Erro ao salvar')
    setGroups(prev => prev.map(x => x.id === g.id ? { ...x, ...data } : x))
  }

  function abrirEdicao(g: Group, tipo: 'link' | 'contagem') {
    setEdit({ id: g.id, tipo })
    setEditLink(g.invite_link ?? '')
    setEditMembros(String(estimado(g)))
    setEditLimite(String(cap(g)))
  }

  async function salvarLink(g: Group) {
    if (!editLink.trim()) return
    setSalvando(true)
    try { await patch(g, { invite_link: editLink.trim() }); setEdit(null) }
    catch (err: any) { alert(err.message) }
    finally { setSalvando(false) }
  }

  async function salvarContagem(g: Group) {
    const body: Record<string, unknown> = {}
    if (editMembros.trim() !== '') body.member_count = Number(editMembros)
    if (editLimite.trim() !== '' && Number(editLimite) !== cap(g)) body.capacity = Number(editLimite)
    if (!Object.keys(body).length) { setEdit(null); return }
    setSalvando(true)
    try { await patch(g, body); setEdit(null) }
    catch (err: any) { alert(err.message) }
    finally { setSalvando(false) }
  }

  async function alternarLink(g: Group) {
    const quebrar = g.link_ok === true
    if (quebrar && !confirm(`Marcar o link de "${g.name}" como quebrado? O grupo para de receber leads até você trocar ou confirmar o link.`)) return
    try { await patch(g, { link_ok: !quebrar }) }
    catch (err: any) { alert(err.message) }
  }

  async function salvarLote() {
    const itens = Object.entries(loteValores)
      .filter(([, v]) => v.trim() !== '')
      .map(([id, v]) => ({ id, member_count: Number(v) }))
    if (!itens.length) return
    if (itens.some(i => !Number.isFinite(i.member_count) || i.member_count < 0)) {
      alert('Há um número inválido.')
      return
    }
    setSalvandoLote(true)
    setLoteResultado(null)
    try {
      const res = await fetch('/api/grupos/contagens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itens }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar')
      const porId = new Map((data.grupos as Group[]).map(g => [g.id, g]))
      setGroups(prev => prev.map(g => porId.has(g.id) ? { ...g, ...porId.get(g.id)! } : g))
      setLoteValores({})
      setLoteResultado(`✓ ${data.atualizados} ${data.atualizados === 1 ? 'grupo atualizado' : 'grupos atualizados'}`
        + (data.falhas ? ` (${data.falhas} com erro)` : ''))
    } catch (err: any) {
      setLoteResultado('✗ ' + err.message)
    } finally {
      setSalvandoLote(false)
    }
  }

  // ── Adicionar manualmente ──
  async function addGroup() {
    if (!inviteLink.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/grupos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invite_link: inviteLink.trim(),
          name: groupName.trim() || undefined,
          member_count: novoMembros.trim() === '' ? undefined : Number(novoMembros),
          capacity: Number(novoLimite) || 1024,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setGroups(prev => [data, ...prev])
      setInviteLink(''); setGroupName(''); setNovoMembros(''); setNovoLimite('1024')
      setShowForm(false)
    } catch (err: any) {
      alert('Erro ao adicionar: ' + err.message)
    } finally {
      setAdding(false)
    }
  }

  // ID do grupo sendo toggled (evita double-click race condition)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // ── Toggle recebendo ──
  async function toggleReceiving(g: Group) {
    if (togglingId === g.id) return
    const next = !g.is_receiving
    setTogglingId(g.id)
    startTransition(() => {
      setGroups(prev => prev.map(x => x.id === g.id ? { ...x, is_receiving: next } : x))
    })
    try {
      const res = await fetch(`/api/grupos/${g.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_receiving: next }),
      })
      if (!res.ok) {
        startTransition(() => {
          setGroups(prev => prev.map(x => x.id === g.id ? { ...x, is_receiving: !next } : x))
        })
        alert('Erro ao atualizar grupo')
      }
    } finally {
      setTogglingId(null)
    }
  }

  // ── Arquivar ──
  async function archiveGroup(g: Group) {
    if (!confirm(`Arquivar "${g.name}"? Ele não aparecerá mais na distribuição.`)) return
    startTransition(() => {
      setGroups(prev => prev.map(x => x.id === g.id ? { ...x, status: 'archived', is_receiving: false } : x))
    })
    const res = await fetch(`/api/grupos/${g.id}`, { method: 'DELETE' })
    if (!res.ok) {
      startTransition(() => {
        setGroups(prev => prev.map(x => x.id === g.id ? { ...x, status: g.status, is_receiving: g.is_receiving } : x))
      })
      alert('Erro ao arquivar grupo. Tente novamente.')
    }
  }

  // ── Sincronizar contagens (precisa do Evolution) ──
  async function syncAll() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/grupos/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.detail)
      setSyncResult(`✓ ${data.synced} de ${data.total} grupos sincronizados`)
      const g2 = await fetch('/api/grupos')
      const updated = await g2.json()
      if (Array.isArray(updated)) setGroups(updated)
    } catch (err: any) {
      setSyncResult('✗ ' + err.message)
    } finally {
      setSyncing(false)
    }
  }

  // ── Ativar / desativar todos ──
  async function bulkActivate(activate: boolean) {
    setBulking(true)
    setBulkResult(null)
    try {
      const res = await fetch('/api/grupos/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: activate ? 'activate_all' : 'deactivate_all' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setGroups(prev => prev.map(g => g.status === 'active' ? { ...g, is_receiving: activate } : g))
      setBulkResult(`✓ ${data.updated} grupos ${activate ? 'ativados' : 'pausados'}`)
    } catch (err: any) {
      setBulkResult('✗ ' + err.message)
    } finally {
      setBulking(false)
    }
  }

  // ── Descobrir grupos do Evolution ──
  async function discoverGroups() {
    setDiscovering(true)
    setDiscoveredGroups(null)
    setSelectedJids(new Set())
    setImportResult(null)
    try {
      const res = await fetch('/api/grupos/discover')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao descobrir grupos')
      setDiscoveredGroups(data)
      setSelectedJids(new Set(data.filter((g: DiscoveredGroup) => !g.already_saved).map((g: DiscoveredGroup) => g.id)))
    } catch (err: any) {
      alert('Erro: ' + err.message)
    } finally {
      setDiscovering(false)
    }
  }

  function toggleSelected(jid: string) {
    setSelectedJids(prev => {
      const next = new Set(prev)
      if (next.has(jid)) next.delete(jid)
      else next.add(jid)
      return next
    })
  }

  // ── Importar selecionados ──
  async function importSelected() {
    if (!selectedJids.size || !discoveredGroups) return
    setImporting(true)
    setImportResult(null)
    const toImport = discoveredGroups.filter(g => selectedJids.has(g.id) && !g.already_saved)
    let imported = 0
    let errors = 0
    for (const g of toImport) {
      try {
        const res = await fetch('/api/grupos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jid: g.id, name: g.subject, is_receiving: false }),
        })
        if (res.ok) {
          const data = await res.json()
          setGroups(prev => [data, ...prev])
          setDiscoveredGroups(prev => prev ? prev.map(x => x.id === g.id ? { ...x, already_saved: true } : x) : prev)
          imported++
        } else {
          errors++
        }
      } catch { errors++ }
    }
    setImportResult(`✓ ${imported} grupos importados${errors > 0 ? ` (${errors} erros)` : ''}`)
    setSelectedJids(new Set())
    setImporting(false)
  }

  const precisaEvolution = !evoCarregando && !evoOnline
  const dicaEvolution = 'Precisa de um número conectado no Evolution'

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1040 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: ink }}>Gerenciar Grupos</div>
          <div style={{ fontSize: 13, color: gray, marginTop: 4 }}>
            Cadastre grupos e controle para onde vão os novos leads
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={discoverGroups}
            disabled={discovering || precisaEvolution}
            title={precisaEvolution ? dicaEvolution : undefined}
            style={{
              background: '#F0F0F5', color: ink, border: 'none', cursor: discovering || precisaEvolution ? 'default' : 'pointer',
              padding: '9px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600, opacity: discovering || precisaEvolution ? 0.5 : 1,
            }}
          >
            {discovering ? '🔍 Buscando…' : '🔍 Descobrir grupos'}
          </button>
          <button
            onClick={syncAll}
            disabled={syncing || precisaEvolution}
            title={precisaEvolution ? dicaEvolution : undefined}
            style={{
              background: '#FFFAF5', color: ink, border: 'none', cursor: syncing || precisaEvolution ? 'default' : 'pointer',
              padding: '9px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600, opacity: syncing || precisaEvolution ? 0.5 : 1,
            }}
          >
            {syncing ? '⏳ Sincronizando…' : '🔄 Sincronizar'}
          </button>
          <button
            onClick={() => bulkActivate(true)}
            disabled={bulking}
            style={{
              background: green + '18', color: green, border: `1px solid ${green}40`,
              cursor: bulking ? 'default' : 'pointer',
              padding: '9px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600, opacity: bulking ? 0.6 : 1,
            }}
          >
            {bulking ? '⏳ Ativando…' : '✅ Ativar todos'}
          </button>
          <button
            onClick={() => { setLote(v => !v); setLoteResultado(null) }}
            style={{
              background: lote ? ink : '#fff', color: lote ? '#fff' : ink, border: `1px solid ${ink}30`,
              cursor: 'pointer', padding: '9px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600,
            }}
          >
            📝 Atualizar contagens
          </button>
          <button
            onClick={() => setShowForm(true)}
            style={{ background: accent, color: '#fff', border: 'none', cursor: 'pointer', padding: '9px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600 }}
          >
            + Adicionar grupo
          </button>
        </div>
      </div>

      {/* Situação do Evolution */}
      {!evoCarregando && (evoOnline ? (
        <div style={{ fontSize: 12, color: green, fontWeight: 600, marginBottom: 16 }}>
          ● Evolution conectado ({conectadas.map(i => i.name).join(', ')}) — contagens e links podem ser sincronizados.
        </div>
      ) : (
        <div style={{
          background: orange + '12', border: `1px solid ${orange}40`, borderRadius: 12,
          padding: '14px 18px', marginBottom: 20, fontSize: 13, color: ink, lineHeight: 1.55,
        }}>
          <div style={{ fontWeight: 700, color: orange, marginBottom: 4 }}>Evolution sem número conectado — modo manual</div>
          A distribuição continua funcionando: cada entrada pelo link é contada aqui, e a ocupação de cada grupo é a
          última contagem + essas entradas. O que não se atualiza sozinho é o número real de membros e os links.
          Confira no WhatsApp de vez em quando e lance tudo de uma vez em <b>📝 Atualizar contagens</b>.
        </div>
      ))}

      {/* Próximo lead */}
      <div style={{
        background: '#fff', borderRadius: 14, padding: '16px 20px', marginBottom: 20,
        border: `1px solid ${proximo ? (proximo.nivel === 2 ? red : green) : red}40`,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: gray, letterSpacing: 0.4, marginBottom: 6 }}>PRÓXIMO LEAD VAI PARA</div>
        {proximo ? (
          <>
            <div style={{ fontSize: 17, fontWeight: 700, color: ink }}>
              {proximo.grupo.name}
              <span style={{ fontSize: 13, fontWeight: 600, color: gray, marginLeft: 10 }}>
                ≈ {num(estimado(proximo.grupo))} de {num(cap(proximo.grupo))}
              </span>
            </div>
            <div style={{ fontSize: 13, color: proximo.nivel === 2 ? red : gray, marginTop: 3 }}>{proximo.motivo}</div>
          </>
        ) : (
          <div style={{ fontSize: 14, color: red, fontWeight: 600 }}>
            Nenhum grupo ativo com link confirmado. Quem clica em entrar no grupo cai na página de &quot;grupos cheios&quot;.
          </div>
        )}
      </div>

      {lote && (
        <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${ink}20`, padding: '20px 24px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: ink }}>Atualizar contagens</div>
              <div style={{ fontSize: 12, color: gray, marginTop: 4, maxWidth: 640, lineHeight: 1.55 }}>
                No WhatsApp, abra o grupo e toque no nome dele: aparece &quot;Grupo · 1.012 membros&quot;.
                Preencha só os que você conferiu — os em branco ficam como estão. Ao salvar, as entradas
                pelo link voltam a contar do zero a partir do número digitado.
              </div>
            </div>
            <button
              onClick={() => setLote(false)}
              style={{ background: '#FFFAF5', border: 'none', cursor: 'pointer', padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: ink, fontFamily: 'inherit' }}
            >
              Fechar
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) auto auto auto', gap: '8px 20px', alignItems: 'center', minWidth: 560 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: gray }}>GRUPO</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: gray }}>ÚLTIMA CONTAGEM</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: gray }}>ESTIMATIVA HOJE</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: gray }}>MEMBROS AGORA</div>
              {groups
                .filter(g => g.status !== 'archived')
                .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }))
                .map(g => (
                  <div key={g.id} style={{ display: 'contents' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: ink }}>{g.name}</div>
                    <div style={{ fontSize: 12, color: gray }}>{num(g.member_count ?? 0)} em {dataCurta(g.contagem_em ?? g.last_synced_at)}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: temVaga(g) ? ink : red }}>≈ {num(estimado(g))}</div>
                    <input
                      type="number" min={0} inputMode="numeric" placeholder="—"
                      value={loteValores[g.id] ?? ''}
                      onChange={e => setLoteValores(v => ({ ...v, [g.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') salvarLote() }}
                      style={{ ...inputStyle, width: 120 }}
                    />
                  </div>
                ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 14, marginTop: 18 }}>
            {loteResultado && (
              <span style={{ fontSize: 13, fontWeight: 600, color: loteResultado.startsWith('✓') ? green : red }}>{loteResultado}</span>
            )}
            <button
              onClick={salvarLote}
              disabled={salvandoLote || !Object.values(loteValores).some(v => v.trim() !== '')}
              style={{
                background: accent, color: '#fff', border: 'none', padding: '9px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                cursor: salvandoLote ? 'default' : 'pointer', fontFamily: 'inherit',
                opacity: salvandoLote || !Object.values(loteValores).some(v => v.trim() !== '') ? 0.5 : 1,
              }}
            >
              {salvandoLote ? 'Salvando…' : `Salvar ${Object.values(loteValores).filter(v => v.trim() !== '').length || ''} contagens`}
            </button>
          </div>
        </div>
      )}

      {syncResult && (
        <div style={{
          padding: '10px 16px', borderRadius: 10, marginBottom: 12,
          background: syncResult.startsWith('✓') ? green + '15' : red + '15',
          color: syncResult.startsWith('✓') ? green : red, fontSize: 13, fontWeight: 600,
        }}>{syncResult}</div>
      )}
      {bulkResult && (
        <div style={{
          padding: '10px 16px', borderRadius: 10, marginBottom: 20,
          background: bulkResult.startsWith('✓') ? green + '15' : red + '15',
          color: bulkResult.startsWith('✓') ? green : red, fontSize: 13, fontWeight: 600,
        }}>{bulkResult}</div>
      )}

      {/* ── Painel Descobrir grupos ── */}
      {discoveredGroups !== null && (
        <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${accent}30`, padding: '20px 24px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: ink }}>
                🔍 Grupos encontrados no Evolution ({discoveredGroups.length})
              </div>
              <div style={{ fontSize: 12, color: gray, marginTop: 2 }}>Selecione os grupos de promoção para importar</div>
            </div>
            <button
              onClick={() => setDiscoveredGroups(null)}
              style={{ background: '#FFFAF5', border: 'none', cursor: 'pointer', padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: ink }}
            >
              Fechar
            </button>
          </div>

          {importResult && (
            <div style={{ padding: '10px 14px', borderRadius: 9, marginBottom: 14, background: green + '15', color: green, fontSize: 13, fontWeight: 600 }}>
              {importResult}
            </div>
          )}

          {discoveredGroups.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: gray, fontSize: 13 }}>
              Nenhum grupo encontrado. Verifique se algum número está conectado (status &quot;open&quot;).
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto', marginBottom: 16 }}>
                {discoveredGroups.map(g => (
                  <label key={g.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                    borderRadius: 10, cursor: g.already_saved ? 'default' : 'pointer',
                    background: g.already_saved ? '#FFFAF5' : selectedJids.has(g.id) ? accent + '10' : '#FFF7EE',
                    border: `1px solid ${g.already_saved ? '#EDE0D2' : selectedJids.has(g.id) ? accent + '40' : '#EDE0D2'}`,
                    opacity: g.already_saved ? 0.6 : 1,
                  }}>
                    <input
                      type="checkbox"
                      checked={g.already_saved || selectedJids.has(g.id)}
                      disabled={g.already_saved}
                      onChange={() => toggleSelected(g.id)}
                      style={{ width: 16, height: 16, flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: ink, marginBottom: 1 }}>{g.subject}</div>
                      <div style={{ fontSize: 11, color: gray, fontFamily: 'monospace' }}>{g.id}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: ink }}>{num(g.size)} membros</div>
                      <div style={{ fontSize: 10, color: gray }}>via {g.instanceName}</div>
                    </div>
                    {g.already_saved && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: green, background: green + '15', padding: '2px 8px', borderRadius: 12 }}>
                        Cadastrado
                      </span>
                    )}
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 13, color: gray }}>{selectedJids.size} selecionados para importar</div>
                <button
                  onClick={importSelected}
                  disabled={importing || selectedJids.size === 0}
                  style={{
                    background: selectedJids.size === 0 ? '#EDE0D2' : accent, color: selectedJids.size === 0 ? gray : '#fff',
                    border: 'none', cursor: importing || selectedJids.size === 0 ? 'default' : 'pointer',
                    padding: '9px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                  }}
                >
                  {importing ? 'Importando…' : `Importar ${selectedJids.size} grupos`}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Link público */}
      <div style={{
        background: accent + '12', border: `1px solid ${accent}30`,
        borderRadius: 12, padding: '14px 20px', marginBottom: 24,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ fontSize: 20 }}>🔗</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: ink, marginBottom: 2 }}>Link público de distribuição</div>
          <code style={{ fontSize: 13, color: accent }}>planodaju.julianecost.com/g/entrar</code>
        </div>
        <button
          onClick={() => navigator.clipboard.writeText('https://planodaju.julianecost.com/g/entrar')}
          style={{ background: accent, color: '#fff', border: 'none', cursor: 'pointer', padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}
        >
          Copiar
        </button>
      </div>

      {/* Form adicionar manual */}
      {showForm && (
        <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${accent}40`, padding: '20px 24px', marginBottom: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: ink, marginBottom: 4 }}>Novo grupo</div>
          <div style={{ fontSize: 12, color: gray, marginBottom: 16 }}>
            {evoOnline
              ? 'Com o Evolution conectado, nome e membros são preenchidos sozinhos se você deixar em branco.'
              : 'Com o Evolution desconectado, preencha o nome e quantos membros o grupo tem hoje.'}
            {' '}Ao salvar, o link já vale para a distribuição.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: gray, display: 'block', marginBottom: 6 }}>LINK DE CONVITE *</label>
              <input type="text" placeholder="https://chat.whatsapp.com/XXXXXXXX" value={inviteLink}
                onChange={e => setInviteLink(e.target.value)} style={{ ...inputStyle, width: '100%', fontSize: 14, padding: '10px 14px' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: gray, display: 'block', marginBottom: 6 }}>NOME</label>
              <input type="text" placeholder="Ex: PROMOÇÕES YBERA #CD" value={groupName}
                onChange={e => setGroupName(e.target.value)} style={{ ...inputStyle, width: '100%', fontSize: 14, padding: '10px 14px' }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: gray, display: 'block', marginBottom: 6 }}>MEMBROS HOJE</label>
                <input type="number" min={0} placeholder="0" value={novoMembros}
                  onChange={e => setNovoMembros(e.target.value)} style={{ ...inputStyle, width: '100%', fontSize: 14, padding: '10px 14px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: gray, display: 'block', marginBottom: 6 }}>LIMITE</label>
                <input type="number" min={1} max={1024} value={novoLimite}
                  onChange={e => setNovoLimite(e.target.value)} style={{ ...inputStyle, width: '100%', fontSize: 14, padding: '10px 14px' }} />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button
              onClick={() => { setShowForm(false); setInviteLink(''); setGroupName(''); setNovoMembros(''); setNovoLimite('1024') }}
              style={{ background: '#FFFAF5', color: ink, border: 'none', cursor: 'pointer', padding: '9px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600 }}
            >
              Cancelar
            </button>
            <button
              onClick={addGroup}
              disabled={adding || !inviteLink.trim()}
              style={{
                background: accent, color: '#fff', border: 'none', cursor: adding ? 'default' : 'pointer',
                padding: '9px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                opacity: adding || !inviteLink.trim() ? 0.6 : 1,
              }}
            >
              {adding ? 'Adicionando…' : 'Adicionar'}
            </button>
          </div>
        </div>
      )}

      {/* Filtro arquivados */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <label style={{ fontSize: 13, color: gray, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
          Mostrar arquivados
        </label>
      </div>

      {/* Lista */}
      {visible.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, padding: '40px 24px', textAlign: 'center', color: gray, fontSize: 14 }}>
          Nenhum grupo cadastrado. Clique em &quot;Adicionar grupo&quot; e cole o link de convite.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visible.map(g => {
            const b = badge(g)
            const lb = linkBadge(g)
            const est = estimado(g)
            const fill = Math.round((est / cap(g)) * 100)
            const entradas = g.entradas_desde_contagem ?? 0
            const editando = edit?.id === g.id ? edit.tipo : null
            const ehProximo = proximo?.grupo.id === g.id
            return (
              <div key={g.id} style={{
                background: '#fff', borderRadius: 14, padding: '16px 20px',
                border: ehProximo ? `1.5px solid ${green}70` : '1px solid rgba(0,0,0,0.06)',
                opacity: g.status === 'archived' ? 0.5 : 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: ink }}>{g.name}</div>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: b.color + '18', color: b.color }}>{b.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: lb.color + '14', color: lb.color }}>{lb.label}</span>
                      {ehProximo && (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: green, color: '#fff' }}>próximo lead</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, height: 6, background: '#F0F0F5', borderRadius: 3, maxWidth: 220 }}>
                        <div style={{
                          height: '100%', borderRadius: 3, width: `${Math.min(fill, 100)}%`,
                          background: fill >= 100 ? red : fill >= 85 ? orange : green,
                        }} />
                      </div>
                      <span style={{ fontSize: 12, color: ink, fontWeight: 600 }}>≈ {num(est)} / {num(cap(g))}</span>
                    </div>
                    <div style={{ fontSize: 11, color: gray, marginTop: 5 }}>
                      {num(g.member_count ?? 0)} na contagem de {dataCurta(g.contagem_em ?? g.last_synced_at)}
                      {entradas > 0 && <> + {num(entradas)} entradas pelo link</>}
                    </div>
                  </div>

                  {g.status !== 'archived' && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: ink, fontWeight: 500, flexShrink: 0 }}>
                      <div
                        onClick={() => toggleReceiving(g)}
                        style={{
                          width: 44, height: 24, borderRadius: 12, cursor: 'pointer', transition: 'background .2s',
                          background: g.is_receiving ? green : '#D0D0D8', position: 'relative',
                        }}
                      >
                        <div style={{
                          position: 'absolute', top: 3, left: g.is_receiving ? 22 : 3,
                          width: 18, height: 18, borderRadius: '50%', background: '#fff',
                          transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                        }} />
                      </div>
                      {g.is_receiving ? 'Recebendo' : 'Pausado'}
                    </label>
                  )}
                </div>

                {g.status !== 'archived' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    <button onClick={() => abrirEdicao(g, 'contagem')} style={botaoMini(ink)}>Atualizar membros</button>
                    <button onClick={() => abrirEdicao(g, 'link')} style={botaoMini(accent)}>{g.invite_link ? 'Trocar link' : '+ Adicionar link'}</button>
                    {g.invite_link && (
                      <button onClick={() => alternarLink(g)} style={botaoMini(g.link_ok === true ? red : green)}>
                        {g.link_ok === true ? 'Marcar link quebrado' : 'Confirmar link'}
                      </button>
                    )}
                    {g.invite_link && (
                      <a href={g.invite_link} target="_blank" rel="noopener noreferrer" style={{ ...botaoMini(gray), textDecoration: 'none' }}>
                        Abrir link ↗
                      </a>
                    )}
                    <button
                      onClick={() => archiveGroup(g)}
                      style={{ fontSize: 12, color: red, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, marginLeft: 'auto', fontFamily: 'inherit' }}
                    >
                      Arquivar
                    </button>
                  </div>
                )}

                {editando === 'link' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                    <input
                      type="text" placeholder="https://chat.whatsapp.com/..." value={editLink} autoFocus
                      onChange={e => setEditLink(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') salvarLink(g); if (e.key === 'Escape') setEdit(null) }}
                      style={{ ...inputStyle, flex: 1, maxWidth: 420 }}
                    />
                    <button onClick={() => salvarLink(g)} disabled={salvando} style={botaoMini(green)}>{salvando ? 'Salvando…' : 'Salvar'}</button>
                    <button onClick={() => setEdit(null)} style={botaoMini(gray)}>Cancelar</button>
                  </div>
                )}

                {editando === 'contagem' && (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: gray, marginBottom: 4 }}>MEMBROS AGORA (veja no WhatsApp)</div>
                      <input type="number" min={0} value={editMembros} autoFocus
                        onChange={e => setEditMembros(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') salvarContagem(g); if (e.key === 'Escape') setEdit(null) }}
                        style={{ ...inputStyle, width: 150 }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: gray, marginBottom: 4 }}>LIMITE</div>
                      <input type="number" min={1} max={1024} value={editLimite}
                        onChange={e => setEditLimite(e.target.value)} style={{ ...inputStyle, width: 100 }} />
                    </div>
                    <button onClick={() => salvarContagem(g)} disabled={salvando} style={botaoMini(green)}>{salvando ? 'Salvando…' : 'Salvar'}</button>
                    <button onClick={() => setEdit(null)} style={botaoMini(gray)}>Cancelar</button>
                    <div style={{ fontSize: 11, color: gray, flexBasis: '100%' }}>
                      Ao salvar, as entradas pelo link voltam a contar do zero a partir deste número.
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
