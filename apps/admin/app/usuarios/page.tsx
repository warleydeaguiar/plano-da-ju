import { createAdminClient } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'
import UsuariasClient from './UsuariasClient'

export const revalidate = 30
export const metadata = { title: 'Usuárias — Admin Plano da Ju' }

export default async function UsuariasPage() {
  const sb = createAdminClient()

  const { data } = await (sb.from('profiles') as any)
    .select('id,full_name,email,phone,hair_type,porosity,chemical_history,main_problems,hair_length_cm,quiz_answers,subscription_type,subscription_status,subscription_expires_at,subscription_activated_at,quiz_completed_at,plan_status,plan_requested_at,plan_released_at,photo_url,photo_taken_at,avatar_url,is_gift,admin_notes,refunded_at,pagarme_subscription_id,pagarme_charge_id,created_at,updated_at')
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: '#F5F5F7', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
    }}>
      <Sidebar />
      <main style={{ marginLeft: 220, flex: 1, height: '100vh', overflowY: 'auto' }}>
        <UsuariasClient initialUsers={(data ?? []) as any[]} />
      </main>
    </div>
  )
}
