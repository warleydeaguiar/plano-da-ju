import { sendTextToGroup, sendMediaToGroup, findGroupsWhereInstanceIsNotMember } from './evolution-grupos'
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

  // 4. PRE-CHECK: verifica se a instância é membro dos grupos.
  // Se NÃO for, Evolution trava por minutos sem retornar erro — então abortamos antes.
  let nonMemberSet = new Set<string>()
  try {
    const missing = await findGroupsWhereInstanceIsNotMember(instanceName, list.map(g => g.jid))
    nonMemberSet = new Set(missing)
  } catch {
    // se a verificação falhar, prossegue (não bloqueia)
  }
  if (nonMemberSet.size === list.length) {
    // Instância não está em NENHUM grupo — aborta com mensagem clara
    await sb.from('wg_broadcasts' as any)
      .update({
        status: 'failed',
        sent_at: new Date().toISOString(),
        fail_count: list.length,
      })
      .eq('id', broadcastId)
    // Registra um erro genérico em broadcast_results pra cada grupo
    await sb.from('wg_broadcast_results' as any).insert(
      list.map(g => ({
        broadcast_id: broadcastId,
        group_id: g.id,
        status: 'failed',
        error: `Instância "${instanceName}" não é membro deste grupo — reconecte a instância correta no Evolution Manager.`,
      }))
    )
    return {
      ok: false,
      error: `Instância "${instanceName}" não está em nenhum dos ${list.length} grupos. Conecte a instância correta (que tem permissão nos grupos) no Evolution Manager.`,
    }
  }

  // 5. Envia para cada grupo
  let success = 0
  let fail = 0
  let skipped = 0

  for (const group of list) {
    // Pula grupos onde a instância não é membro
    if (nonMemberSet.has(group.jid)) {
      await sb.from('wg_broadcast_results' as any).insert({
        broadcast_id: broadcastId,
        group_id: group.id,
        status: 'failed',
        error: `Instância "${instanceName}" não é membro deste grupo`,
      })
      fail++; skipped++
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
    } catch (err) {
      await sb.from('wg_broadcast_results' as any).insert({
        broadcast_id: broadcastId,
        group_id: group.id,
        status: 'failed',
        error: String(err),
      })
      fail++
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

  return { ok: true, success, fail, total: list.length }
}
