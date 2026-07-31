import { createAdminClient } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'
import FeedbackList from './FeedbackList'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Feedback — Admin Plano da Ju' }

const gray = '#7C6B7E'

export default async function FeedbackPage() {
  const sb = createAdminClient()
  const { data } = await (sb.from('admin_feedback') as any)
    .select('id,type,message,page_url,screenshot_url,status,resolution_note,submitted_by,created_at,resolved_at')
    .order('created_at', { ascending: false })
    .limit(500)

  const list = (data ?? []) as any[]
  const open = list.filter(f => f.status === 'open').length
  const bugs = list.filter(f => f.status === 'open' && f.type === 'bug').length

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#FFFAF5', fontFamily: 'Plus Jakarta Sans, -apple-system, system-ui, sans-serif' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '28px 32px', overflow: 'auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#2A1E2C', margin: '0 0 4px' }}>Feedback</h1>
        <p style={{ fontSize: 13.5, color: gray, margin: '0 0 22px' }}>
          Sugestões e bugs enviados pelo botão de feedback. {open} em aberto{bugs > 0 ? ` · ${bugs} bug(s)` : ''}.
        </p>
        <FeedbackList initial={list} />
      </main>
    </div>
  )
}
