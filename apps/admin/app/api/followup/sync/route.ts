import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { fetchAllInstances, fetchInstanceContacts, fetchFirstContactDates } from '@/lib/evolution-grupos'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/followup/sync
 *   Sincroniza contatos do Evolution para wg_quiz_leads (slug='whatsapp-direct').
 *
 *   Estratégia:
 *   1. Pega TODOS os contatos da instância (DMs apenas, @s.whatsapp.net)
 *   2. Varre as mensagens paginadas e descobre o messageTimestamp MAIS ANTIGO
 *      de cada contato — esse é o "primeiro contato real" (vs createdAt do contact,
 *      que é quando o Evolution sincronizou).
 *   3. Para cada contato: usa firstMessageDate se disponível, senão fallback p/ contact.createdAt
 *   4. Bulk insert (com unique index em (slug, phone), conflitos são ignorados)
 *   5. Para leads JÁ existentes: atualiza created_at se a nova data for MAIS ANTIGA
 *      e name se estiver vazio.
 */
export async function POST(req: NextRequest) {
  try {
    const sb = createAdminClient()
    const body = await req.json().catch(() => ({}))
    const explicitInstances: string[] | undefined = body?.instances

    const allInstances = await fetchAllInstances()
    const targetNames = explicitInstances?.length
      ? allInstances.filter(i => explicitInstances.includes(i.name)).map(i => i.name)
      : allInstances.filter(i => i.connectionStatus === 'open').map(i => i.name)

    if (targetNames.length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'Nenhuma instância conectada para sincronizar.',
      }, { status: 400 })
    }

    // 1. Pega leads existentes em memória (uma query só)
    const { data: existingLeads } = await sb
      .from('wg_quiz_leads' as any)
      .select('id, phone, name, created_at')
      .eq('quiz_slug', 'whatsapp-direct')
    const existingMap = new Map<string, { id: string; name: string | null; created_at: string }>()
    for (const lead of (existingLeads ?? []) as any[]) {
      if (lead.phone) existingMap.set(lead.phone, lead)
    }

    let totalFetched = 0
    let totalInserted = 0
    let totalUpdated = 0
    let totalSkipped = 0
    let totalMessages = 0
    const perInstance: Record<string, any> = {}

    const toInsert: any[] = []
    const toUpdate: Array<{ id: string; created_at?: string; name?: string }> = []

    for (const instName of targetNames) {
      const stats = { fetched: 0, inserted: 0, updated: 0, skipped: 0, messages_scanned: 0 }

      let contacts: Awaited<ReturnType<typeof fetchInstanceContacts>> = []
      let firstDates: Record<string, number> = {}

      // Busca contatos e datas reais em paralelo (otimização)
      try {
        const [contactsRes, datesRes] = await Promise.all([
          fetchInstanceContacts(instName),
          fetchFirstContactDates(instName, { pageSize: 50, maxPages: 100 }),
        ])
        contacts = contactsRes
        firstDates = datesRes
      } catch (err) {
        perInstance[instName] = { ...stats, error: String(err) }
        continue
      }

      stats.fetched = contacts.length
      stats.messages_scanned = Object.keys(firstDates).length
      totalFetched += contacts.length
      totalMessages += stats.messages_scanned

      const seenInThisRun = new Set<string>()

      for (const c of contacts) {
        const cleanPhone = c.phone.replace(/\D/g, '')
        if (cleanPhone.length < 10) { stats.skipped++; totalSkipped++; continue }
        if (seenInThisRun.has(cleanPhone)) { stats.skipped++; totalSkipped++; continue }
        seenInThisRun.add(cleanPhone)

        // Usa o messageTimestamp do primeiro contato real se disponível
        const firstTs = firstDates[c.remoteJid]
        const firstContactISO = firstTs
          ? new Date(firstTs * 1000).toISOString()
          : c.createdAt

        const existing = existingMap.get(cleanPhone)
        if (existing) {
          const existingTime = new Date(existing.created_at).getTime()
          const newTime = new Date(firstContactISO).getTime()
          const updates: any = {}
          if (newTime < existingTime) updates.created_at = firstContactISO
          if (!existing.name && c.pushName) updates.name = c.pushName
          if (Object.keys(updates).length > 0) {
            toUpdate.push({ id: existing.id, ...updates })
            stats.updated++; totalUpdated++
          } else {
            stats.skipped++; totalSkipped++
          }
        } else {
          toInsert.push({
            quiz_slug:    'whatsapp-direct',
            phone:        cleanPhone,
            name:         c.pushName ?? null,
            utm_source:   'evolution',
            utm_campaign: instName,
            created_at:   firstContactISO,
          })
          existingMap.set(cleanPhone, { id: 'pending', name: c.pushName, created_at: firstContactISO })
          stats.inserted++; totalInserted++
        }
      }
      perInstance[instName] = stats
    }

    // Bulk insert
    if (toInsert.length > 0) {
      const chunkSize = 500
      for (let i = 0; i < toInsert.length; i += chunkSize) {
        const chunk = toInsert.slice(i, i + chunkSize)
        const { error } = await sb.from('wg_quiz_leads' as any).insert(chunk)
        if (error) {
          // fallback: tenta um por um
          for (const row of chunk) {
            await sb.from('wg_quiz_leads' as any).insert(row).then(r => { if (r.error) totalSkipped++ })
          }
        }
      }
    }

    // Bulk update
    if (toUpdate.length > 0) {
      await Promise.all(
        toUpdate.map(u => {
          const { id, ...changes } = u
          return sb.from('wg_quiz_leads' as any).update(changes).eq('id', id)
        })
      )
    }

    return NextResponse.json({
      ok: true,
      totalFetched,
      totalInserted,
      totalUpdated,
      totalSkipped,
      totalMessages,
      perInstance,
      instances: targetNames,
    })
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err?.message ?? String(err),
    }, { status: 500 })
  }
}
