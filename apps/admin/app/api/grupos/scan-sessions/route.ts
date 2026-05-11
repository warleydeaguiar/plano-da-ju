import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const BASE_URL = (process.env.EVOLUTION_GRUPOS_URL ?? 'https://automacao.julianecost.com').replace(/^http:\/\//, 'https://')
const API_KEY = process.env.EVOLUTION_GRUPOS_KEY ?? ''

/**
 * POST /api/grupos/scan-sessions
 *   body: { instance: string }
 *   Tenta enviar 1 mensagem invisível pra cada grupo ativo e classifica o resultado:
 *   - ok: Evolution enviou (sessão de criptografia funciona)
 *   - no_sessions: erro SessionError (linked-device sem chaves do grupo)
 *   - timeout: Evolution não respondeu (geralmente também é session error)
 *   - other_error: outro erro
 *
 *   IMPORTANTE: usa timeout curto (8s) pra não travar. Mesmo assim, com 32 grupos pode levar ~4min.
 */
export async function POST(req: NextRequest) {
  const { instance } = await req.json()
  if (!instance) {
    return NextResponse.json({ ok: false, error: 'instance obrigatória' }, { status: 400 })
  }

  const sb = createAdminClient()
  const { data: groups } = await sb
    .from('wg_groups' as any)
    .select('id, jid, name, member_count')
    .eq('status', 'active')
    .not('jid', 'is', null)
    .order('member_count', { ascending: true }) // tenta menores primeiro (resposta mais rápida)

  const list = (groups ?? []) as any[]
  const results: any[] = []
  const testText = `_test ${Date.now()}_`

  for (const g of list) {
    const start = Date.now()
    let kind: 'ok' | 'no_sessions' | 'timeout' | 'other_error' = 'other_error'
    let detail = ''

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 8000)
      try {
        const res = await fetch(
          `${BASE_URL}/message/sendText/${encodeURIComponent(instance)}`,
          {
            method: 'POST',
            headers: { apikey: API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ number: g.jid, text: testText }),
            signal: controller.signal,
          }
        )
        clearTimeout(timer)
        const body = await res.text()
        if (res.ok) {
          kind = 'ok'
        } else if (body.includes('No sessions') || body.includes('SessionError')) {
          kind = 'no_sessions'
          detail = 'Linked-device sem chaves de sessão'
        } else {
          detail = `HTTP ${res.status}: ${body.slice(0, 120)}`
        }
      } catch (err: any) {
        clearTimeout(timer)
        if (err?.name === 'AbortError') kind = 'timeout'
        else detail = err?.message ?? String(err)
      }
    } catch {}

    results.push({
      jid: g.jid,
      name: g.name,
      members: g.member_count,
      kind,
      detail,
      elapsed_ms: Date.now() - start,
    })
  }

  const summary = {
    total: results.length,
    ok: results.filter(r => r.kind === 'ok').length,
    no_sessions: results.filter(r => r.kind === 'no_sessions').length,
    timeout: results.filter(r => r.kind === 'timeout').length,
    other_error: results.filter(r => r.kind === 'other_error').length,
  }

  return NextResponse.json({ ok: true, instance, summary, results })
}
