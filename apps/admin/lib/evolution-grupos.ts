/**
 * Evolution API helper — Grupos de Promoção
 * URL: http://automacao.julianecost.com
 */

const BASE_URL = process.env.EVOLUTION_GRUPOS_URL!
const API_KEY  = process.env.EVOLUTION_GRUPOS_KEY!
const INSTANCE = process.env.EVOLUTION_GRUPOS_INSTANCE ?? 'grupos-promo'

async function evoFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'apikey': API_KEY,
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  })
  if (!res.ok) throw new Error(`Evolution API ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function getInstanceStatus() {
  return evoFetch(`/instance/connectionState/${INSTANCE}`)
}

export async function getGroupByInviteCode(inviteCode: string) {
  return evoFetch(`/group/inviteInfo/${INSTANCE}?inviteCode=${inviteCode}`)
}

export async function getAllGroups() {
  return evoFetch(`/group/fetchAllGroups/${INSTANCE}?getParticipants=false`)
}

export async function getGroupMetadata(groupJid: string) {
  return evoFetch(`/group/findGroupInfos/${INSTANCE}?groupJid=${encodeURIComponent(groupJid)}`)
}

export async function sendTextToGroup(groupJid: string, text: string) {
  return evoFetch(`/message/sendText/${INSTANCE}`, {
    method: 'POST',
    body: JSON.stringify({ number: groupJid, text, delay: 1200 }),
  })
}

export async function sendImageToGroup(groupJid: string, mediaUrl: string, caption?: string) {
  return evoFetch(`/message/sendMedia/${INSTANCE}`, {
    method: 'POST',
    body: JSON.stringify({
      number: groupJid,
      mediatype: 'image',
      mimetype: 'image/jpeg',
      media: mediaUrl,
      caption: caption ?? '',
    }),
  })
}

export async function sendVideoToGroup(groupJid: string, mediaUrl: string, caption?: string) {
  return evoFetch(`/message/sendMedia/${INSTANCE}`, {
    method: 'POST',
    body: JSON.stringify({
      number: groupJid,
      mediatype: 'video',
      mimetype: 'video/mp4',
      media: mediaUrl,
      caption: caption ?? '',
    }),
  })
}

/** Busca contagem de membros de vários grupos em paralelo */
export async function syncGroupMemberCounts(jids: string[]): Promise<Record<string, number>> {
  const results: Record<string, number> = {}
  await Promise.allSettled(
    jids.map(async (jid) => {
      try {
        const data = await getGroupMetadata(jid)
        results[jid] = Array.isArray(data?.participants)
          ? data.participants.length
          : (data?.size ?? 0)
      } catch { /* ignora grupos que falharam */ }
    })
  )
  return results
}
