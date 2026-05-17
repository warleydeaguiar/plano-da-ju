import { createAdminClient } from '@/lib/supabase'
import Sidebar from '../components/Sidebar'
import ProdutosClient from './ProdutosClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Produtos — Admin Plano da Ju' }

interface ProductRow {
  id: string
  name: string
  brand: string | null
  category: string | null
  price_brl: number | null
  affiliate_url: string | null
  image_url: string | null
  hair_types: string[] | null
  is_ybera: boolean
  active: boolean
}

async function getProducts(): Promise<ProductRow[]> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('products')
    .select('*')
    .order('is_ybera', { ascending: false })
    .order('name', { ascending: true })
  return (data ?? []) as ProductRow[]
}

export default async function ProdutosPage() {
  const products = await getProducts()

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: '#F5F5F7', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
    }}>
      <Sidebar />
      <main style={{ marginLeft: 220, flex: 1, height: '100vh', overflowY: 'auto', padding: '32px 40px' }}>
        <ProdutosClient initialProducts={products} />
      </main>
    </div>
  )
}
