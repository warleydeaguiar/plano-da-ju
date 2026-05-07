/**
 * Evolution API helper — Grupos de Promoção
 * Suporta múltiplas instâncias (vários números, todos nos mesmos grupos)
 */

const BASE_URL = process.env.EVOLUTION_GRUPOS_URL ?? 'https://automacao.julianecost.com'
const API_KEY  = process.env.EVOLUTION_GRUPOS_KEY!
// Instância padrão (fallback se não for passada explicitamente)
export const DEFAULT_INSTANCE = process.env.EVOLUTION_GRUPOS_INSTANCE ?? 'grupos-promo'

export type EvoInstance = {
  name: string
  connectionStatus: 'open' | 'connecting' | 'close' | string
  ownerJid: string | null
  profileName: string | null
  profilePicUrl: string | null
}

async function evoFetch(path: string, options?: RequestInit, instance?: string) {
  const url = `${BASE_URL.replace(/\/+$/, '')}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      apikey: API_KEY,
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`Evolution API ${res.status}: ${await res.text()}`)
  return res.json()
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
        const groups = await getAllGroupsFromInstance(inst.name)
        for (const g of Array.isArray(groups) ? groups : []) {
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

export async function sendTextToGroup(groupJid: string, text: string, instanceName = DEFAULT_INSTANCE) {
  return evoFetch(`/message/sendText/${encodeURIComponent(instanceName)}`, {
    method: 'POST',
    body: JSON.stringify({ number: groupJid, text, delay: 1200 }),
  })
}

export async function sendMediaToGroup(
  groupJid: string,
  media: string,          // URL pública ou base64
  mediatype: 'image' | 'video' | 'document',
  mimetype: string,
  caption: string,
  instanceName = DEFAULT_INSTANCE
) {
  return evoFetch(`/message/sendMedia/${encodeURIComponent(instanceName)}`, {
    method: 'POST',
    body: JSON.stringify({ number: groupJid, mediatype, mimetype, media, caption }),
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

/** Busca contagem de membros de vários grupos em paralelo */
export async function syncGroupMemberCounts(jids: string[], instanceName = DEFAULT_INSTANCE): Promise<Record<string, number>> {
  const results: Record<string, number> = {}
  await Promise.allSettled(
    jids.map(async (jid) => {
      try {
        const data = await getGroupMetadata(jid, instanceName)
        results[jid] = Array.isArray(data?.participants)
          ? data.participants.length
          : (data?.size ?? 0)
      } catch { /* ignora grupos que falharam */ }
    })
  )
  return results
}
