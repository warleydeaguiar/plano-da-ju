import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { sendTextToGroup, sendMediaToGroup, getActiveInstance } from '@/lib/evolution-grupos'

export const dynamic = 'force-dynamic'

/** GET /api/grupos/broadcast — histórico de broadcasts */
export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('wg_broadcasts' as any)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/**
 * POST /api/grupos/broadcast
 * Envia ou agenda mensagem para todos os grupos ativos.
 *
 * Body:
 *   message       string   — texto da mensagem
 *   title?        string   — título interno
 *   media_base64? string   — base64 do arquivo
 *   media_url?    string   — URL pública da mídia
 *   media_type?   string   — 'image' | 'video' | 'document'
 *   mimetype?     string   — ex: 'image/jpeg'
 *   instance_name? string  — qual instância usar (default: primeira open)
 *   scheduled_at? string   — ISO datetime; se futuro, agenda sem enviar
 */
export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()
  const {
    message,
    title,
    media_base64,
    media_url,
    media_type,
    mimetype,
    instance_name,
    scheduled_at,
    mention_all,
  } = body

  if (!message?.trim()) {
    return NextResponse.json({ error: 'message é obrigatório' }, { status: 400 })
  }

  // Resolve instância
  const resolvedInstance = instance_name?.trim() || await getActiveInstance()

  // Verifica se é agendamento futuro
  const isScheduled = scheduled_at && new Date(scheduled_at) > new Date()

  // Busca grupos ativos com JID
  const { data: groups } = await supabase
    .from('wg_groups' as any)
    .select('id, jid, name')
    .eq('status', 'active')
    .not('jid', 'is', null)

  const mediaField = media_base64 ?? media_url ?? null

  // Cria registro no banco
  const { data: broadcast, error: bErr } = await supabase
    .from('wg_broadcasts' as any)
    .insert({
      title:         title?.trim() || null,
      message:       message.trim(),
      media_url:     mediaField,
      media_type:    media_type || null,
      instance_name: resolvedInstance,
      status:        isScheduled ? 'scheduled' : 'sending',
      scheduled_at:  isScheduled ? scheduled_at : null,
      total_groups:  groups?.length ?? 0,
      mention_all:   !!mention_all,
    })
    .select()
    .single()

  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 })

  // Se é agendado, para aqui
  if (isScheduled) {
    return NextResponse.json({ ok: true, scheduled: true, id: (broadcast as any).id, scheduled_at })
  }

  // Senão, envia agora
  return sendNow(supabase, broadcast as any, groups ?? [], resolvedInstance, mediaField, media_type, mimetype, message.trim(), !!mention_all)
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function sendNow(
  supabase: ReturnType<typeof import('@/lib/supabase').createAdminClient>,
  broadcast: any,
  groups: any[],
  instanceName: string,
  media: string | null,
  mediaType: string | null,
  mimetype: string | null,
  message: string,
  mentionAll: boolean,
) {
  if (!groups.length) {
    await supabase.from('wg_broadcasts' as any).update({ status: 'done', sent_at: new Date().toISOString() }).eq('id', broadcast.id)
    return NextResponse.json({ ok: false, error: 'Nenhum grupo ativo com JID cadastrado' })
  }

  let success = 0
  let fail = 0

  for (const group of groups) {
    try {
      // Ordem fixa: IMAGEM PRIMEIRO, depois TEXTO (mensagens separadas)
      if (mediaType && media) {
        // 1) Envia mídia sem caption (a imagem vai sozinha)
        await sendMediaToGroup(
          group.jid,
          media,
          mediaType as 'image' | 'video' | 'document',
          mimetype ?? (mediaType === 'image' ? 'image/jpeg' : mediaType === 'video' ? 'video/mp4' : 'application/octet-stream'),
          '', // sem caption — texto vai como mensagem separada
          instanceName,
          mentionAll,
        )
        // 2) Se houver texto, envia em mensagem separada com pequeno delay
        if (message && message.trim()) {
          await sleep(900)
          await sendTextToGroup(group.jid, message, instanceName, mentionAll)
        }
      } else {
        await sendTextToGroup(group.jid, message, instanceName, mentionAll)
      }

      await supabase.from('wg_broadcast_results' as any).insert({
        broadcast_id: broadcast.id,
        group_id: group.id,
        status: 'ok',
        sent_at: new Date().toISOString(),
      })
      success++
    } catch (err) {
      await supabase.from('wg_broadcast_results' as any).insert({
        broadcast_id: broadcast.id,
        group_id: group.id,
        status: 'failed',
        error: String(err),
      })
      fail++
    }
  }

  await supabase
    .from('wg_broadcasts' as any)
    .update({ status: 'done', sent_at: new Date().toISOString(), success_count: success, fail_count: fail })
    .eq('id', broadcast.id)

  return NextResponse.json({ ok: true, success, fail, total: groups.length })
}
