import { createAdminClient } from '@/lib/supabase'
import Sidebar from '../../components/Sidebar'
import WhatsappClient from './WhatsappClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Cliques no WhatsApp — Admin Plano da Ju' }

export interface Clique {
  path: string
  produto: string | null
  rotulo: string | null
  dispositivo: string | null
  criado_em: string
}

export default async function WhatsappPage() {
  const supabase = createAdminClient()
  const desde = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString()

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data } = await (supabase as any)
    .from('site_cliques_whatsapp')
    .select('path,produto,rotulo,dispositivo,criado_em')
    .gte('criado_em', desde)
    .order('criado_em', { ascending: false })
    .limit(5000)
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#FFFAF5' }}>
      <Sidebar />
      <WhatsappClient cliques={(data ?? []) as Clique[]} />
    </div>
  )
}
