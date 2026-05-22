import { createAdminClient } from '@/lib/supabase'
import Sidebar from '../components/Sidebar'
import FuncionariosClient from './FuncionariosClient'
import type { StaffMember } from './FuncionariosClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Equipe — Admin Plano da Ju' }

export default async function FuncionariosPage() {
  const supabase = createAdminClient()
  const { data } = await (supabase.from('staff_members') as any)
    .select('*')
    .order('created_at', { ascending: true })

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: '#FFFAF5', fontFamily: 'Plus Jakarta Sans, -apple-system, system-ui, sans-serif',
    }}>
      <Sidebar />
      <main style={{ marginLeft: 234, flex: 1, height: '100vh', overflowY: 'auto' }}>
        <FuncionariosClient initial={(data ?? []) as StaffMember[]} />
      </main>
    </div>
  )
}
