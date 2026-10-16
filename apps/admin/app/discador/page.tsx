import Sidebar from '../components/Sidebar'
import DiscadorClient from './DiscadorClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Discador — Admin Plano da Ju' }

export default function DiscadorPage() {
  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: '#FFFAF5', fontFamily: 'Plus Jakarta Sans, -apple-system, system-ui, sans-serif',
    }}>
      <Sidebar />
      <main style={{ marginLeft: 234, flex: 1, height: '100vh', overflowY: 'auto', padding: '32px 40px' }}>
        <DiscadorClient />
      </main>
    </div>
  )
}
