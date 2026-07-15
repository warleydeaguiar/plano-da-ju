import { createAdminClient } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'
import UsuariasClient from './UsuariasClient'

export const revalidate = 30
export const metadata = { title: 'Usuárias — Admin Plano da Ju' }

const COLS = 'id,full_name,email,phone,hair_type,porosity,chemical_history,main_problems,hair_length_cm,quiz_answers,subscription_type,subscription_status,subscription_expires_at,subscription_activated_at,quiz_completed_at,plan_status,plan_requested_at,plan_released_at,photo_url,photo_taken_at,avatar_url,is_gift,admin_notes,refunded_at,pagarme_subscription_id,pagarme_charge_id,created_at,updated_at'

const PAGE_SIZE = 100
const STATUSES = ['active', 'pending', 'cancelled', 'refunded', 'expired'] as const

export default async function UsuariasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; gift?: string; sub?: string; status?: string; page?: string }>
}) {
  const sb = createAdminClient()
  const { q, gift, sub, status: statusParam, page: pageParam } = await searchParams
  // Sanitiza o termo (vírgula/asterisco quebram o .or()/ilike do PostgREST).
  const term = (q ?? '').trim().slice(0, 60).replace(/[,*%()]/g, '')
  const giftMode = gift === '1'
  const status = statusParam && (STATUSES as readonly string[]).includes(statusParam) ? statusParam : 'all'
  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1)

  // Aplica os filtros de escopo (gift/assinatura/busca) — NÃO inclui o status,
  // pra podermos contar cada status dentro do mesmo escopo.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyScope = (query: any) => {
    // "UGC / grátis" = parceria (UGC da Bianca) OU presente marcado à mão (is_gift).
    if (giftMode) query = query.or('is_gift.eq.true,subscription_type.eq.parceria')
    if (sub) query = query.eq('subscription_type', sub)
    if (term.length >= 2) {
      const digits = term.replace(/\D/g, '')
      const ors = [`full_name.ilike.*${term}*`, `email.ilike.*${term}*`]
      if (digits.length >= 3) ors.push(`phone.ilike.*${digits}*`)
      query = query.or(ors.join(','))
    }
    return query
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const countBase = () => applyScope((sb.from('profiles') as any).select('id', { count: 'exact', head: true }))

  // Contagens (server-side, sobre a base inteira) — total do escopo + por status.
  const [cAll, cActive, cPending, cCancelled, cRefunded, cExpired] = await Promise.all([
    countBase(),
    countBase().eq('subscription_status', 'active'),
    countBase().eq('subscription_status', 'pending'),
    countBase().eq('subscription_status', 'cancelled'),
    countBase().eq('subscription_status', 'refunded'),
    countBase().eq('subscription_status', 'expired'),
  ])
  const statusCounts = {
    all:       cAll.count ?? 0,
    active:    cActive.count ?? 0,
    pending:   cPending.count ?? 0,
    cancelled: cCancelled.count ?? 0,
    refunded:  cRefunded.count ?? 0,
    expired:   cExpired.count ?? 0,
  }
  const total = status === 'all' ? statusCounts.all : (statusCounts[status as keyof typeof statusCounts] ?? 0)
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)

  // Linhas da página atual (100 por vez) via range.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dataQuery = applyScope((sb.from('profiles') as any).select(COLS))
  if (status !== 'all') dataQuery = dataQuery.eq('subscription_status', status)
  const from = (safePage - 1) * PAGE_SIZE
  const { data } = await dataQuery
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: '#FFFAF5', fontFamily: 'Plus Jakarta Sans, -apple-system, system-ui, sans-serif',
    }}>
      <Sidebar />
      <main style={{ marginLeft: 234, flex: 1, height: '100vh', overflowY: 'auto' }}>
        <UsuariasClient
          initialUsers={(data ?? []) as any[]}
          initialQuery={term}
          giftMode={giftMode}
          sub={sub ?? ''}
          status={status}
          statusCounts={statusCounts}
          total={total}
          page={safePage}
          pageSize={PAGE_SIZE}
          pageCount={pageCount}
        />
      </main>
    </div>
  )
}
