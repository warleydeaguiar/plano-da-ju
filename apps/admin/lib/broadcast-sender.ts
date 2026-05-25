import { sendTextToGroup, sendMediaToGroup } from './evolution-grupos'
import { createAdminClient } from './supabase'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const rand = (min: number, max: number) => Math.floor(min + Math.random() * (max - min))

/**
 * ANTI-BAN: o envio é feito em DRIP (gotejamento). Cada execução manda só um
 * lote pequeno de grupos, com delay aleatório entre eles, e marca o broadcast
 * como 'sending' enquanto houver grupos restantes. O cron (run-scheduled, 1×/min)
 * chama de novo e retoma de onde parou — espalhando o envio por vários minutos
 * em vez de disparar tudo de uma vez (que é o que bane o número).
 */
const BATCH_SIZE = 4              // grupos por execução (cabe no maxDuration de 300s)
const MIN_GAP_MS = 25_000         // delay mínimo ENTRE grupos (~25s)
const MAX_GAP_MS = 50_000         // delay máximo ENTRE grupos (~50s)

/** Expande spintax {a|b|c} escolhendo uma opção aleatória por ocorrência, para
 *  que a mensagem NÃO seja byte-idêntica em todos os grupos (padrão de spam). */
function spin(text: string): string {
  return text.replace(/\{([^{}]+)\}/g, (_m, group: string) => {
    const opts = group.split('|')
    return opts[Math.floor(Math.random() * opts.length)] ?? ''
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any

async function recordResult(sb: Sb, broadcastId: string, groupId: string, status: 'ok' | 'failed', error?: string) {
  await sb.from('wg_broadcast_results').insert({
    broadcast_id: broadcastId,
    group_id: groupId,
    status,
    error: error ?? null,
    sent_at: status === 'ok' ? new Date().toISOString() : null,
  })
}

/** Recalcula contadores a partir dos resultados e atualiza o broadcast. */
async function refreshCounts(sb: Sb, broadcastId: string, finished: boolean) {
  const { data } = await sb.from('wg_broadcast_results').select('status').eq('broadcast_id', broadcastId)
  const rows = (data ?? []) as Array<{ status: string }>
  const success = rows.filter(r => r.status === 'ok').length
  const fail = rows.filter(r => r.status !== 'ok').length
  await sb.from('wg_broadcasts').update({
    success_count: success,
    fail_count: fail,
    ...(finished ? { status: 'done', sent_at: new Date().toISOString() } : {}),
  }).eq('id', broadcastId)
  return { success, fail }
}

/**
 * Envia UM lote do broadcast e retoma nos próximos ticks. Idempotente: grupos
 * que já têm resultado registrado não são reenviados.
 */
export async function executeBroadcast(broadcastId: string) {
  const sb = createAdminClient()

  // 1. Pega o broadcast
  const { data: bRaw } = await sb.from('wg_broadcasts').select('*').eq('id', broadcastId).single()
  if (!bRaw) return { ok: false, error: 'Broadcast não encontrado' }
  const broadcast = bRaw as Record<string, unknown>
  const status = broadcast.status as string
  if (status !== 'scheduled' && status !== 'sending') {
    return { ok: false, error: `Broadcast não está pendente (status: ${status})` }
  }

  // 2. Marca como 'sending' (idempotente — só sai de scheduled/sending)
  await sb.from('wg_broadcasts').update({ status: 'sending' })
    .eq('id', broadcastId).in('status', ['scheduled', 'sending'])

  // 3. Grupos ativos com JID
  const { data: groups } = await sb.from('wg_groups')
    .select('id, jid, name').eq('status', 'active').not('jid', 'is', null)
  const all = (groups ?? []) as Array<{ id: string; jid: string; name: string }>
  if (all.length === 0) {
    await sb.from('wg_broadcasts').update({ status: 'done', sent_at: new Date().toISOString() }).eq('id', broadcastId)
    return { ok: false, error: 'Nenhum grupo ativo' }
  }

  // 4. Quais já foram tentados (qualquer resultado) → não reenvia
  const { data: doneRows } = await sb.from('wg_broadcast_results').select('group_id').eq('broadcast_id', broadcastId)
  const attempted = new Set((doneRows ?? []).map((r: { group_id: string }) => r.group_id))
  const remaining = all.filter(g => !attempted.has(g.id))

  if (remaining.length === 0) {
    const c = await refreshCounts(sb, broadcastId, true)
    return { ok: true, done: true, remaining: 0, ...c }
  }

  const batch = remaining.slice(0, BATCH_SIZE)
  const message = (broadcast.message as string) ?? ''
  const media = (broadcast.media_url as string | null) ?? null
  const mediaType = (broadcast.media_type as string | null) ?? null
  const instanceName = (broadcast.instance_name as string) ?? 'grupos-promo'
  const mentionAll = !!broadcast.mention_all

  // 5. Envia o lote com delay humano entre cada grupo
  let success = 0
  let fail = 0
  let consecutiveTimeouts = 0

  for (let i = 0; i < batch.length; i++) {
    const group = batch[i]
    // Delay aleatório ANTES de cada envio (menos o 1º do lote — já vem espaçado
    // pelos ticks do cron). Quebra o padrão regular de robô.
    if (i > 0) await sleep(rand(MIN_GAP_MS, MAX_GAP_MS))

    // Circuit breaker: 3 timeouts seguidos = provável bloqueio, aborta o lote
    if (consecutiveTimeouts >= 3) {
      await recordResult(sb, broadcastId, group.id, 'failed', 'Pulado: timeouts seguidos — provável bloqueio do WhatsApp')
      fail++
      continue
    }

    try {
      const text = spin(message)
      if (mediaType && media) {
        const mime = mediaType === 'image' ? 'image/jpeg'
                   : mediaType === 'video' ? 'video/mp4'
                   : 'application/octet-stream'
        await sendMediaToGroup(group.jid, media, mediaType as 'image' | 'video' | 'document', mime, '', instanceName, mentionAll)
        if (text.trim()) {
          await sleep(rand(1500, 4000))
          await sendTextToGroup(group.jid, text, instanceName, mentionAll)
        }
      } else {
        await sendTextToGroup(group.jid, text, instanceName, mentionAll)
      }
      await recordResult(sb, broadcastId, group.id, 'ok')
      success++
      consecutiveTimeouts = 0
    } catch (err) {
      const errStr = String(err)
      const isTimeout = /timeout/i.test(errStr)
      await recordResult(sb, broadcastId, group.id, 'failed', errStr)
      fail++
      if (isTimeout) consecutiveTimeouts++
      else consecutiveTimeouts = 0
    }
  }

  // 6. Ainda restam grupos? mantém 'sending' (próximo tick continua). Senão, finaliza.
  const stillRemaining = remaining.length - batch.length
  const finished = stillRemaining <= 0
  const counts = await refreshCounts(sb, broadcastId, finished)

  return {
    ok: success > 0,
    done: finished,
    partial: !finished,
    sentThisBatch: success,
    failThisBatch: fail,
    remaining: Math.max(0, stillRemaining),
    total: all.length,
    ...counts,
  }
}
