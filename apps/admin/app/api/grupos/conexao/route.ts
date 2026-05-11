import { NextRequest, NextResponse } from 'next/server'
import { fetchAllInstances } from '@/lib/evolution-grupos'

export const dynamic = 'force-dynamic'

const BASE_URL = (process.env.EVOLUTION_GRUPOS_URL ?? 'https://automacao.julianecost.com').replace(/^http:\/\//, 'https://')
const API_KEY = process.env.EVOLUTION_GRUPOS_KEY ?? ''

/**
 * GET /api/grupos/conexao
 *   Lista status de TODAS as instâncias + info de saúde.
 */
export async function GET() {
  try {
    const instances = await fetchAllInstances()

    // Para cada instância, pega connectionState detalhado
    const enriched = await Promise.all(instances.map(async (inst: any) => {
      let state = 'unknown'
      try {
        const r = await fetch(
          `${BASE_URL}/instance/connectionState/${encodeURIComponent(inst.name)}`,
          { headers: { apikey: API_KEY }, signal: AbortSignal.timeout(10_000) }
        )
        if (r.ok) {
          const data = await r.json()
          state = data?.instance?.state ?? state
        }
      } catch {}
      return {
        name: inst.name,
        connectionStatus: inst.connectionStatus,
        state,
        ownerJid: inst.ownerJid ?? null,
        ownerPhone: inst.ownerJid ? String(inst.ownerJid).split('@')[0] : null,
        profileName: inst.profileName ?? null,
      }
    }))

    return NextResponse.json({ ok: true, instances: enriched })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 })
  }
}

/**
 * POST /api/grupos/conexao
 *   body: { action: 'qr' | 'restart' | 'logout', instance: string }
 *   - qr:      pega QR code para reconectar
 *   - restart: reinicia a instância (mantém sessão se possível)
 *   - logout:  faz logout (limpa sessão, exige re-scan)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, instance } = body
    if (!action || !instance) {
      return NextResponse.json({ ok: false, error: 'action e instance obrigatórios' }, { status: 400 })
    }

    const name = encodeURIComponent(instance)

    if (action === 'qr') {
      const r = await fetch(`${BASE_URL}/instance/connect/${name}`, {
        headers: { apikey: API_KEY },
        signal: AbortSignal.timeout(15_000),
      })
      const data = await r.json()
      // Evolution retorna { base64: 'data:image/png;base64,...', code: '...' }
      return NextResponse.json({
        ok: true,
        qrBase64: data?.base64 ?? null,
        pairingCode: data?.pairingCode ?? null,
      })
    }

    if (action === 'restart') {
      const r = await fetch(`${BASE_URL}/instance/restart/${name}`, {
        method: 'POST',
        headers: { apikey: API_KEY },
        signal: AbortSignal.timeout(15_000),
      })
      const data = await r.json()
      return NextResponse.json({ ok: r.ok, ...data })
    }

    if (action === 'logout') {
      const r = await fetch(`${BASE_URL}/instance/logout/${name}`, {
        method: 'DELETE',
        headers: { apikey: API_KEY },
        signal: AbortSignal.timeout(15_000),
      })
      const data = await r.json()
      return NextResponse.json({ ok: r.ok, ...data })
    }

    return NextResponse.json({ ok: false, error: 'Ação inválida' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 })
  }
}
