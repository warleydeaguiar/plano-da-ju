import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getActiveInstance } from '@/lib/evolution-grupos'

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

  // ANTI-BAN: "enviar agora" NÃO dispara tudo inline. O broadcast já foi criado
  // com status 'sending' e o cron (run-scheduled, 1×/min) faz o envio em DRIP —
  // lotes pequenos com delays aleatórios entre grupos, espalhando por minutos.
  // Isso evita o padrão de disparo em massa que faz o WhatsApp banir o número.
  return NextResponse.json({
    ok: true,
    queued: true,
    id: (broadcast as any).id,
    total_groups: groups?.length ?? 0,
  })
}
