import { createAdminClient } from '@/lib/supabase'
import Sidebar from '../../components/Sidebar'
import FaqClient from './FaqClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'FAQ do site — Admin Plano da Ju' }

export default async function FaqPage() {
  const supabase = createAdminClient()
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data } = await (supabase as any)
    .from('site_faq')
    .select('id,content_id,pergunta,resposta,revisao_status,revisao_motivo,ordem,site_content(title,path)')
    .order('revisao_status')
    .order('content_id')
    .order('ordem')
    .limit(1200)
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#FFFAF5' }}>
      <Sidebar />
      <FaqClient itens={data ?? []} />
    </div>
  )
}
