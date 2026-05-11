/**
 * Evolution API helper — Grupos de Promoção
 * Suporta múltiplas instâncias (vários números, todos nos mesmos grupos)
 */

// Força HTTPS — o servidor faz 301 de http→https e POST vira GET no redirect, perdendo o body
const BASE_URL = (process.env.EVOLUTION_GRUPOS_URL ?? 'https://automacao.julianecost.com').replace(/^http:\/\//, 'https://')
// API_KEY lido em runtime (não no topo do módulo) para evitar crash silencioso
// Instância padrão (fallback se não for passada explicitamente)
export const DEFAULT_INSTANCE = process.env.EVOLUTION_GRUPOS_INSTANCE ?? 'grupos-promo'

function getApiKey(): string {
  const key = process.env.EVOLUTION_GRUPOS_KEY
  if (!key) throw new Error('EVOLUTION_GRUPOS_KEY não configurada nas variáveis de ambiente')
  return key
}

export type EvoInstance = {
  name: string
  connectionStatus: 'open' | 'connecting' | 'close' | string
  ownerJid: string | null
  profileName: string | null
  profilePicUrl: string | null
}

async function evoFetch(path: string, options?: RequestInit & { timeoutMs?: number }, _instance?: string) {
  const url = `${BASE_URL.replace(/\/+$/, '')}${path}`
  const timeoutMs = options?.timeoutMs ?? 20_000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        apikey: getApiKey(),
        'Content-Type': 'application/json',
        ...(options?.headers ?? {}),
      },
      signal: controller.signal,
      next: { revalidate: 0 },
    })
    if (!res.ok) throw new Error(`Evolution API ${res.status}: ${await res.text()}`)
    return res.json()
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`Evolution timeout (${timeoutMs}ms) em ${path}`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/** Normaliza a resposta do fetchAllGroups para sempre retornar um array */
function parseGroupList(data: unknown): any[] {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object' && Array.isArray((data as any).groups)) return (data as any).groups
  return []
}

// ─── Instâncias ──────────────────────────────────────────────────────────────

/** Lista todas as instâncias do servidor Evolution */
export async function fetchAllInstances(): Promise<EvoInstance[]> {
  try {
    const data = await evoFetch('/instance/fetchInstances')
    return (Array.isArray(data) ? data : []).map((i: any) => ({
      name:             i.name ?? i.instance?.instanceName ?? '',
      connectionStatus: i.connectionStatus ?? i.instance?.state ?? 'close',
      ownerJid:         i.ownerJid ?? null,
      profileName:      i.profileName ?? null,
      profilePicUrl:    i.profilePicUrl ?? null,
    }))
  } catch { return [] }
}

/** Retorna a primeira instância com status 'open', ou a default */
export async function getActiveInstance(): Promise<string> {
  const instances = await fetchAllInstances()
  const open = instances.find(i => i.connectionStatus === 'open')
  return open?.name ?? DEFAULT_INSTANCE
}

export async function getInstanceStatus(instanceName = DEFAULT_INSTANCE) {
  return evoFetch(`/instance/connectionState/${encodeURIComponent(instanceName)}`)
}

// ─── Grupos ───────────────────────────────────────────────────────────────────

/** Busca todos os grupos de uma instância específica */
export async function getAllGroupsFromInstance(instanceName: string) {
  return evoFetch(`/group/fetchAllGroups/${encodeURIComponent(instanceName)}?getParticipants=false`)
}

/**
 * Busca grupos de TODAS as instâncias abertas e deduplica por JID.
 * Retorna lista com o instanceName de onde foi encontrado.
 */
export async function discoverGroupsFromAllInstances(): Promise<{
  id: string
  subject: string
  size: number
  pictureUrl?: string
  instanceName: string
}[]> {
  const instances = await fetchAllInstances()
  const open = instances.filter(i => i.connectionStatus === 'open')
  if (!open.length) return []

  const seenJids = new Set<string>()
  const results: { id: string; subject: string; size: number; pictureUrl?: string; instanceName: string }[] = []

  await Promise.allSettled(
    open.map(async (inst) => {
      try {
        const groups = parseGroupList(await getAllGroupsFromInstance(inst.name))
        for (const g of groups) {
          const jid = g.id ?? g.jid
          if (!jid || seenJids.has(jid)) continue
          seenJids.add(jid)
          results.push({
            id:           jid,
            subject:      g.subject ?? g.name ?? jid,
            size:         g.size ?? g.participants?.length ?? 0,
            pictureUrl:   g.pictureUrl ?? undefined,
            instanceName: inst.name,
          })
        }
      } catch { /* ignora instância offline */ }
    })
  )

  return results.sort((a, b) => b.size - a.size)
}

export async function getGroupByInviteCode(inviteCode: string, instanceName = DEFAULT_INSTANCE) {
  return evoFetch(`/group/inviteInfo/${encodeURIComponent(instanceName)}?inviteCode=${inviteCode}`)
}

export async function getGroupMetadata(groupJid: string, instanceName = DEFAULT_INSTANCE) {
  return evoFetch(`/group/findGroupInfos/${encodeURIComponent(instanceName)}?groupJid=${encodeURIComponent(groupJid)}`)
}

// ─── Envio de mensagens ───────────────────────────────────────────────────────

/**
 * Envia mensagem de texto direto para um número (DM, não grupo).
 * Aceita phone com ou sem DDI — adiciona 55 (Brasil) se necessário.
 */
export async function sendTextToNumber(phone: string, text: string, instanceName = DEFAULT_INSTANCE) {
  let d = phone.replace(/\D/g, '')
  if (d.length === 10 || d.length === 11) d = '55' + d
  return evoFetch(`/message/sendText/${encodeURIComponent(instanceName)}`, {
    method: 'POST',
    body: JSON.stringify({ number: d, text, delay: 1200 }),
  })
}

/**
 * Verifica se uma instância tem permissão para enviar mensagens nos grupos
 * informados (ou seja, se o número da instância é participante deles).
 * Retorna a lista de JIDs em que a instância NÃO é membro.
 *
 * Por que: se o número não está no grupo, sendText/sendMedia trava
 * indefinidamente em vez de retornar erro — então precisamos detectar antes.
 */
export async function findGroupsWhereInstanceIsNotMember(
  instanceName: string,
  groupJids: string[]
): Promise<string[]> {
  if (groupJids.length === 0) return []

  // Pega o ownerJid da instância
  const instances = await fetchAllInstances()
  const inst = instances.find(i => i.name === instanceName)
  const ownerJid = (inst as any)?.ownerJid ?? ''
  const ownerNumber = ownerJid.split('@')[0]
  if (!ownerNumber) {
    // Não conseguimos verificar — devolve vazio (não bloqueia)
    return []
  }

  // Busca todos os grupos da instância com participantes
  let allGroups: any[] = []
  try {
    const data = await evoFetch(
      `/group/fetchAllGroups/${encodeURIComponent(instanceName)}?getParticipants=true`,
      { timeoutMs: 60_000 }
    )
    allGroups = parseGroupList(data)
  } catch {
    return [] // se falhou, não bloqueia
  }

  const missingGroups: string[] = []
  for (const jid of groupJids) {
    const g = allGroups.find((x: any) => x.id === jid)
    if (!g) {
      missingGroups.push(jid) // instância nem enxerga o grupo
      continue
    }
    const isMember = (g.participants ?? []).some((p: any) => {
      const pid = (p?.id ?? '').split('@')[0]
      return pid === ownerNumber
    })
    if (!isMember) missingGroups.push(jid)
  }
  return missingGroups
}

/**
 * Busca todos os contatos de uma instância Evolution.
 * Retorna apenas contatos DM reais (@s.whatsapp.net), ignorando @lid e grupos.
 */
export async function fetchInstanceContacts(instanceName: string): Promise<Array<{
  remoteJid: string
  phone: string
  pushName: string | null
  profilePicUrl: string | null
  createdAt: string
  updatedAt: string
}>> {
  const data = await evoFetch(`/chat/findContacts/${encodeURIComponent(instanceName)}`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  const list = Array.isArray(data) ? data : []
  return list
    .filter((c: any) => typeof c?.remoteJid === 'string' && c.remoteJid.endsWith('@s.whatsapp.net'))
    .map((c: any) => ({
      remoteJid:     c.remoteJid,
      phone:         c.remoteJid.split('@')[0],
      pushName:      c.pushName ?? null,
      profilePicUrl: c.profilePicUrl ?? null,
      createdAt:     c.createdAt ?? new Date().toISOString(),
      updatedAt:     c.updatedAt ?? c.createdAt ?? new Date().toISOString(),
    }))
}

/**
 * Varre as mensagens (paginadas) de uma instância e retorna mapa
 * remoteJid → primeiro messageTimestamp (mais antigo).
 * Apenas DMs (@s.whatsapp.net), ignora grupos e @lid.
 *
 * Útil para descobrir a DATA REAL do primeiro contato de cada lead
 * (em vez de usar contact.createdAt, que é quando o Evolution sincronizou).
 */
export async function fetchFirstContactDates(
  instanceName: string,
  options: { pageSize?: number; maxPages?: number } = {}
): Promise<Record<string, number>> {
  const pageSize = options.pageSize ?? 50
  const maxPages = options.maxPages ?? 100
  const firstByJid: Record<string, number> = {}

  // Pega o total primeiro
  const first = await evoFetch(`/chat/findMessages/${encodeURIComponent(instanceName)}`, {
    method: 'POST',
    body: JSON.stringify({ limit: pageSize, page: 1 }),
  })
  const total = first?.messages?.total ?? 0
  const totalPages = Math.min(maxPages, Math.ceil(total / pageSize))
  if (totalPages === 0) return firstByJid

  const handlePage = (records: any[]) => {
    for (const m of records ?? []) {
      const jid = m?.key?.remoteJid
      const ts = m?.messageTimestamp
      if (!jid || !ts) continue
      if (!jid.endsWith('@s.whatsapp.net')) continue
      if (!firstByJid[jid] || ts < firstByJid[jid]) {
        firstByJid[jid] = ts
      }
    }
  }
  handlePage(first?.messages?.records ?? [])

  for (let page = 2; page <= totalPages; page++) {
    try {
      const data = await evoFetch(`/chat/findMessages/${encodeURIComponent(instanceName)}`, {
        method: 'POST',
        body: JSON.stringify({ limit: pageSize, page }),
      })
      handlePage(data?.messages?.records ?? [])
    } catch {
      // se uma página falha, continua
    }
  }

  return firstByJid
}

export async function sendTextToGroup(
  groupJid: string,
  text: string,
  instanceName = DEFAULT_INSTANCE,
  mentionAll = false
) {
  return evoFetch(`/message/sendText/${encodeURIComponent(instanceName)}`, {
    method: 'POST',
    body: JSON.stringify({
      number: groupJid,
      text,
      delay: 1200,
      ...(mentionAll ? { mentionsEveryOne: true } : {}),
    }),
  })
}

export async function sendMediaToGroup(
  groupJid: string,
  media: string,          // URL pública ou base64
  mediatype: 'image' | 'video' | 'document',
  mimetype: string,
  caption: string,
  instanceName = DEFAULT_INSTANCE,
  mentionAll = false
) {
  return evoFetch(`/message/sendMedia/${encodeURIComponent(instanceName)}`, {
    method: 'POST',
    body: JSON.stringify({
      number: groupJid,
      mediatype,
      mimetype,
      media,
      caption,
      ...(mentionAll ? { mentionsEveryOne: true } : {}),
    }),
  })
}

/** Atalho para imagem (URL) */
export async function sendImageToGroup(groupJid: string, mediaUrl: string, caption = '', instanceName = DEFAULT_INSTANCE) {
  return sendMediaToGroup(groupJid, mediaUrl, 'image', 'image/jpeg', caption, instanceName)
}

/** Atalho para vídeo (URL) */
export async function sendVideoToGroup(groupJid: string, mediaUrl: string, caption = '', instanceName = DEFAULT_INSTANCE) {
  return sendMediaToGroup(groupJid, mediaUrl, 'video', 'video/mp4', caption, instanceName)
}

/**
 * Busca contagem de membros de todos os grupos em UMA requisição via fetchAllGroups.
 * Muito mais eficiente que chamar findGroupInfos individualmente (evita timeout).
 * Retorna mapa jid → member_count apenas para os JIDs solicitados.
 */
export async function syncGroupMemberCounts(jids: string[], instanceName = DEFAULT_INSTANCE): Promise<Record<string, number>> {
  const results: Record<string, number> = {}
  try {
    const groups = parseGroupList(await getAllGroupsFromInstance(instanceName))
    for (const g of groups) {
      const jid = g.id ?? g.jid
      if (jid && jids.includes(jid)) {
        results[jid] = g.size ?? (Array.isArray(g.participants) ? g.participants.length : 0)
      }
    }
  } catch { /* instância offline */ }
  return results
}
