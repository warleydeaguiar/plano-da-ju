import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase'
import Sidebar from '../../components/Sidebar'
import PedidoClient from './PedidoClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Pedido — Link na Bio PRO' }

export default async function PedidoBioProPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data } = await (supabase as any)
    .from('bio_pro_orders')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (!data) notFound()

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#FFFAF5' }}>
      <Sidebar />
      <PedidoClient pedido={data} />
    </div>
  )
}
