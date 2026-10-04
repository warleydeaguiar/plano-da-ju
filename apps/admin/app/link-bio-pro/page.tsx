import { createAdminClient } from '@/lib/supabase'
import Sidebar from '../components/Sidebar'
import LinkBioProClient from './LinkBioProClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Link na Bio PRO — Admin Plano da Ju' }

export interface PedidoBioPro {
  id: string
  nome: string | null
  email: string | null
  telefone: string | null
  profissao: string | null
  status_entrega: 'pendente' | 'em_producao' | 'entregue'
  criado_em: string
  entregue_em: string | null
}

async function carregar(): Promise<PedidoBioPro[]> {
  const supabase = createAdminClient()
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data } = await (supabase as any)
    .from('bio_pro_orders')
    .select('id,nome,email,telefone,profissao,status_entrega,criado_em,entregue_em')
    .eq('status_pagamento', 'pago')
    .order('criado_em', { ascending: false })
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return (data ?? []) as PedidoBioPro[]
}

export default async function LinkBioProPage() {
  const pedidos = await carregar()
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#FFFAF5' }}>
      <Sidebar />
      <LinkBioProClient pedidos={pedidos} />
    </div>
  )
}
