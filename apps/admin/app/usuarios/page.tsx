import { createAdminClient } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'
import UsuariasClient from './UsuariasClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Usuárias — Admin Plano da Ju' }

export default async function UsuariasPage() {
  const sb = createAdminClient()

  const { data } = await (sb.from('profiles') as any)
    .select('id,full_name,email,hair_type,subscription_type,subscription_status,subscription_expires_at,quiz_completed_at,plan_status,created_at')
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
