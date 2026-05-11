import { sendTextToGroup, sendMediaToGroup } from './evolution-grupos'
import { createAdminClient } from './supabase'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/**
 * Executa o envio de um broadcast já salvo no banco.
 * Pega grupos ativos com JID, envia mensagem para cada um, salva resultados
 * e atualiza status no broadcast.
 *
 * Ordem do envio: IMAGEM PRIMEIRO (se houver), depois TEXTO (mensagens separadas).
 */
export async function executeBroadcast(broadcastId: string) {
  const sb = createAdminClient()

  // 1. Pega o broadcast
  const { data: bRaw, error: bErr } = await sb
    .from('wg_broadcasts' as any)
    .select('*')
    .eq('id', broadcastId)
    .single()

  if (bErr || !bRaw) {
    return { ok: false, error: 'Broadcast não encontrado' }
  }
  const broadcast = bRaw as any

  // 2. Marca como "sending" pra evitar double-processing
  await sb.from('wg_broadcasts' as any)
    .update({ status: 'sending' })
    .eq('id', broadcastId)
    .eq('status', 'scheduled') // só atualiza se ainda estava scheduled (idempotente)

  // 3. Busca grupos ativos
  const { data: groups } = await sb
    .from('wg_groups' as any)
    .select('id, jid, name')
    .eq('status', 'active')
    .not('jid', 'is', null)

  const list = (groups ?? []) as any[]
  if (list.length === 0) {
    await sb.from('wg_broadcasts' as any)
      .update({ status: 'done', sent_at: new Date().toISOString() })
      .eq('id', broadcastId)
    return { ok: false, error: 'Nenhum grupo ativo' }
  }

  const message: string = broadcast.message ?? ''
  const media: string | null = broadcast.media_url ?? null
  const mediaType: string | null = broadcast.media_type ?? null
  const instanceName: string = broadcast.instance_name ?? 'grupos-promo'
  const mentionAll: boolean = !!broadcast.mention_all

  // 4. Envia para cada grupo (com timeout via evoFetch)
  let success = 0
  let fail = 0
  let timeoutFails = 0
  // Se 3 grupos seguidos derem timeout, aborta (instância provavelmente bloqueada pelo WhatsApp)
  let consecutiveTimeouts = 0

  for (const group of list) {
    // Circuit breaker: se 3 envios seguidos deram timeout, aborta o resto
    if (consecutiveTimeouts >= 3) {
      await sb.from('wg_broadcast_results' as any).insert({
        broadcast_id: broadcastId,
        group_id: group.id,
        status: 'failed',
        error: 'Pulado: muitos timeouts seguidos — provável bloqueio do WhatsApp',
      })
      fail++
      continue
    }
    try {
      if (mediaType && media) {
        // imagem primeiro, sem caption
        const mime = mediaType === 'image' ? 'image/jpeg'
                   : mediaType === 'video' ? 'video/mp4'
                   : 'application/octet-stream'
        await sendMediaToGroup(
          group.jid,
          media,
          mediaType as 'image' | 'video' | 'document',
          mime,
          '',
          instanceName,
          mentionAll,
        )
        if (message.trim()) {
          await sleep(900)
          await sendTextToGroup(group.jid, message, instanceName, mentionAll)
        }
      } else {
        await sendTextToGroup(group.jid, message, instanceName, mentionAll)
      }

      await sb.from('wg_broadcast_results' as any).insert({
        broadcast_id: broadcastId,
        group_id: group.id,
        status: 'ok',
        sent_at: new Date().toISOString(),
      })
      success++
      consecutiveTimeouts = 0
    } catch (err) {
      const errStr = String(err)
      const isTimeout = errStr.includes('timeout') || errStr.includes('Timeout')
      await sb.from('wg_broadcast_results' as any).insert({
        broadcast_id: broadcastId,
        group_id: group.id,
        status: 'failed',
        error: errStr,
      })
      fail++
      if (isTimeout) { consecutiveTimeouts++; timeoutFails++ }
      else consecutiveTimeouts = 0
    }
  }

  // 5. Marca broadcast como done
  await sb.from('wg_broadcasts' as any)
    .update({
      status: 'done',
      sent_at: new Date().toISOString(),
      success_count: success,
      fail_count: fail,
    })
    .eq('id', broadcastId)

  // Detecta padrão de bloqueio do WhatsApp
  let warning: string | undefined
  if (success === 0 && timeoutFails > 0) {
    warning = `Todos os envios deram timeout. A conta "${instanceName}" provavelmente foi bloqueada temporariamente pelo WhatsApp por envio em massa. Aguarde 24-72h ou tente outra instância.`
  }

  return { ok: success > 0, success, fail, total: list.length, warning }
}
