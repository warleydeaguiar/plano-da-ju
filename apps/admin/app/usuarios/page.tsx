import { createAdminClient } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'
import UsuariasClient from './UsuariasClient'

export const revalidate = 30
export const metadata = { title: 'Usuárias — Admin Plano da Ju' }

const COLS = 'id,full_name,email,phone,hair_type,porosity,chemical_history,main_problems,hair_length_cm,quiz_answers,subscription_type,subscription_status,subscription_expires_at,subscription_activated_at,quiz_completed_at,plan_status,plan_requested_at,plan_released_at,photo_url,photo_taken_at,avatar_url,is_gift,admin_notes,refunded_at,pagarme_subscription_id,pagarme_charge_id,created_at,updated_at'

export default async function UsuariasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; gift?: string; sub?: string }>
}) {
  const sb = createAdminClient()
  const { q, gift, sub } = await searchParams
  // Sanitiza o termo: PostgREST usa vírgula como separador no .or() e * como
  // curinga no ilike — removemos esses caracteres pra não quebrar a query.
  const term = (q ?? '').trim().slice(0, 60).replace(/[,*%()]/g, '')
  const giftMode = gift === '1'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (sb.from('profiles') as any).select(COLS)

  // Filtros server-side (pegam TODA a base, não só as mais recentes) —
  // essencial pra achar UGCs/presentes antigas que não estão no topo da lista.
  if (giftMode) query = query.eq('is_gift', true)
  if (sub) query = query.eq('subscription_type', sub)

  if (term.length >= 2) {
    // Busca em TODA a base por nome, email ou telefone (dígitos p/ telefone).
    const digits = term.replace(/\D/g, '')
    const ors = [`full_name.ilike.*${term}*`, `email.ilike.*${term}*`]
    if (digits.length >= 3) ors.push(`phone.ilike.*${digits}*`)
    query = query.or(ors.join(','))
  }

  // Limite alto quando há filtro ativo (pra ver todos os que casam); senão 1000 recentes.
  const { data } = await query.order('created_at', { ascending: false }).limit(1000)

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: '#FFFAF5', fontFamily: 'Plus Jakarta Sans, -apple-system, system-ui, sans-serif',
    }}>
      <Sidebar />
      <main style={{ marginLeft: 234, flex: 1, height: '100vh', overflowY: 'auto' }}>
        <UsuariasClient initialUsers={(data ?? []) as any[]} initialQuery={term} giftMode={giftMode} />
      </main>
    </div>
  )
}
