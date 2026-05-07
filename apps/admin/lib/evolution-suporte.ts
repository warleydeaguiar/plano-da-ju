/**
 * Evolution API helper — Suporte Plano Capilar
 * Instância: "plano capilar" (número de Juliane)
 */

const BASE_URL  = process.env.EVOLUTION_SUPORTE_URL ?? process.env.EVOLUTION_GRUPOS_URL!
const API_KEY   = process.env.EVOLUTION_SUPORTE_KEY  ?? process.env.EVOLUTION_GRUPOS_KEY!
const INSTANCE  = process.env.EVOLUTION_SUPORTE_INSTANCE ?? 'plano capilar'

export { INSTANCE as SUPORTE_INSTANCE }

async function evoFetch(path: string, options?: RequestInit) {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'apikey': API_KEY,
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`Evolution ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function getSuporteInstanceStatus() {
  const encoded = encodeURIComponent(INSTANCE)
  return evoFetch(`/instance/connectionState/${encoded}`)
}

/** Resumo completo da instância (inclui _count de Message, Contact, Chat) */
export async function getSuporteInstanceInfo(): Promise<{
  connectionStatus: string
  ownerJid: string | null
  profileName: string | null
  profilePicUrl: string | null
  messageCount: number
  contactCount: number
  chatCount: number
}> {
  const instances: any[] = await evoFetch('/instance/fetchInstances')
  const inst = instances.find((i: any) =>
    i.name?.toLowerCase() === INSTANCE.toLowerCase()
  )
  if (!inst) throw new Error(`Instância "${INSTANCE}" não encontrada`)
  return {
    connectionStatus: inst.connectionStatus ?? 'unknown',
    ownerJid:         inst.ownerJid ?? null,
    profileName:      inst.profileName ?? null,
    profilePicUrl:    inst.profilePicUrl ?? null,
    messageCount:     inst._count?.Message ?? 0,
    contactCount:     inst._count?.Contact ?? 0,
    chatCount:        inst._count?.Chat    ?? 0,
  }
}

/** Busca chats recentes com breakdown por período */
export async function getRecentChatsBreakdown(): Promise<{
  total: number
  hoje: number
  ultimos7d: number
  ultimos30d: number
  diretas: number
  grupos: number
  recentes: Array<{ jid: string; nome: string | null; atualizadaEm: string }>
}> {
  const encoded = encodeURIComponent(INSTANCE)
  const chats: any[] = await evoFetch(`/chat/findChats/${encoded}`, {
    method: 'POST',
    body: JSON.stringify({}),
  })

  const now      = Date.now()
  const msDay    = 86_400_000
  const todayMs  = new Date().setHours(0, 0, 0, 0)
  const week7ms  = now - 7  * msDay
  const month30ms = now - 30 * msDay

  let hoje = 0, ultimos7d = 0, ultimos30d = 0, diretas = 0, grupos = 0

  for (const c of chats) {
    const updated = c.updatedAt ? new Date(c.updatedAt).getTime() : 0
    if (updated >= todayMs)   hoje++
    if (updated >= week7ms)   ultimos7d++
    if (updated >= month30ms) ultimos30d++
    if (c.remoteJid?.includes('@g.us')) grupos++
    else diretas++
  }

  const recentes = chats
    .filter(c => !c.remoteJid?.includes('@g.us'))
    .sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime())
    .slice(0, 8)
    .map(c => ({
      jid:         c.remoteJid ?? '',
      nome:        c.pushName ?? null,
      atualizadaEm: c.updatedAt ?? '',
    }))

  return { total: chats.length, hoje, ultimos7d, ultimos30d, diretas, grupos, recentes }
}
