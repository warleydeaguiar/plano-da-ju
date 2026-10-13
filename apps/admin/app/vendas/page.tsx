import { createAdminClient } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'
import VendasClient, { type Venda } from './VendasClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Vendas — Admin Plano da Ju' }

/* eslint-disable @typescript-eslint/no-explicit-any */

// Só o que é TENTATIVA DE PAGAMENTO de verdade: abrir o formulário
// (checkout_initiated) ou travar num campo (checkout_error) não é venda.
const EVENTOS = ['pix_generated', 'card_submitted', 'payment_failed', 'payment_confirmed']
const PIX_VALIDADE_MS = 60 * 60 * 1000 // o PIX expira em 1h (checkout/pix)

const PERIODOS: Record<string, number | null> = { '7': 7, '30': 30, '90': 90, 'todos': null }

async function todosEventos(sb: ReturnType<typeof createAdminClient>, desde: string | null) {
  const linhas: any[] = []
  for (let de = 0; ; de += 1000) {
    let q = (sb.from('checkout_events') as any)
      .select('email, event_type, payment_type, amount_cents, order_id, metadata, created_at')
      .in('event_type', EVENTOS)
      .not('email', 'is', null)
      .order('created_at', { ascending: true })
      .range(de, de + 999)
    if (desde) q = q.gte('created_at', desde)
    const { data } = await q
    linhas.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return linhas
}

async function porEmail(sb: ReturnType<typeof createAdminClient>, tabela: string, campos: string, emails: string[]) {
  const mapa = new Map<string, any>()
  for (let i = 0; i < emails.length; i += 200) {
    const { data } = await (sb.from(tabela) as any).select(campos).in('email', emails.slice(i, i + 200))
    for (const r of data ?? []) {
      const k = String(r.email ?? '').toLowerCase().trim()
      if (k && !mapa.has(k)) mapa.set(k, r)
    }
  }
  return mapa
}

export default async function VendasPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const { dias: diasParam } = await searchParams
  const periodo = diasParam && diasParam in PERIODOS ? diasParam : '30'
  const dias = PERIODOS[periodo]
  const desde = dias ? new Date(Date.now() - dias * 86400000).toISOString() : null

  const sb = createAdminClient()
  const eventos = await todosEventos(sb, desde)

  // Agrupa por cliente (e-mail): a pessoa que gerou 3 PIX e pagou o último é UMA venda.
  const grupos = new Map<string, any[]>()
  for (const e of eventos) {
    const k = String(e.email).toLowerCase().trim()
    if (!k) continue
    if (!grupos.has(k)) grupos.set(k, [])
    grupos.get(k)!.push(e)
  }
  const emails = [...grupos.keys()]
  // E-mails sempre minúsculos em profiles/wg_quiz_leads (o checkout normaliza).
  const [perfis, leads] = await Promise.all([
    porEmail(sb, 'profiles', 'email, full_name, phone, subscription_type, subscription_status', emails),
    porEmail(sb, 'wg_quiz_leads', 'email, name, phone, utm_source, utm_campaign', emails),
  ])

  const agora = Date.now()
  const vendas: Venda[] = []
  for (const [email, evs] of grupos) {
    const perfil = perfis.get(email)
    // Cortesia (parceria) não é venda — fica fora da lista e dos números.
    if (perfil?.subscription_type === 'parceria') continue

    const pago = evs.find(e => e.event_type === 'payment_confirmed')
    const tentativas = evs.filter(e => e.event_type === 'pix_generated' || e.event_type === 'card_submitted')
    const ultima = [...evs].reverse().find(e => e.event_type !== 'payment_confirmed') ?? evs[evs.length - 1]
    const base = pago ?? ultima
    const hotmart = base?.metadata?.source === 'hotmart'
    const metodo = String(base?.payment_type ?? '').includes('card') ? 'cartao' : 'pix'

    let status: Venda['status']
    if (pago && perfil?.subscription_status === 'cancelled') status = 'cancelada'
    else if (pago) status = 'paga'
    else if (ultima?.event_type === 'pix_generated') {
      status = agora - new Date(ultima.created_at).getTime() < PIX_VALIDADE_MS ? 'pix_aguardando' : 'pix_expirado'
    } else if (ultima?.event_type === 'payment_failed') status = 'cartao_recusado'
    else status = 'cartao_nao_concluido'

    const lead = leads.get(email)
    vendas.push({
      email,
      nome: perfil?.full_name || lead?.name || email.split('@')[0],
      telefone: String(perfil?.phone || lead?.phone || '').replace(/\D/g, ''),
      status,
      metodo,
      origem: hotmart ? 'hotmart' : 'proprio',
      parcelas: Number(pago?.metadata?.installments) || null,
      valorCents: Number(base?.amount_cents) || null,
      data: (pago ?? ultima)?.created_at ?? evs[evs.length - 1].created_at,
      primeiraTentativa: evs[0].created_at,
      tentativas: Math.max(tentativas.length, pago ? 1 : 0),
      pedido: (pago ?? ultima)?.order_id ?? null,
      utm: lead?.utm_campaign || lead?.utm_source || null,
    })
  }
  vendas.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: '#FFFAF5', fontFamily: 'Plus Jakarta Sans, -apple-system, system-ui, sans-serif',
    }}>
      <Sidebar />
      <main style={{ marginLeft: 234, flex: 1, height: '100vh', overflowY: 'auto', padding: '32px 40px' }}>
        <VendasClient vendas={vendas} periodo={periodo} />
      </main>
    </div>
  )
}
