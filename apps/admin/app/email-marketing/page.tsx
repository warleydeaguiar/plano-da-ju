import Sidebar from '../components/Sidebar'
import EmailMarketingClient from './EmailMarketingClient'

export const metadata = {
  title: 'Email Marketing — Plano da Ju Admin',
}

export default function EmailMarketingPage() {
  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: '#FFFAF5', fontFamily: 'Plus Jakarta Sans, -apple-system, system-ui, sans-serif',
    }}>
      <Sidebar />
      <main style={{ marginLeft: 234, flex: 1, height: '100vh', overflowY: 'auto' }}>
        <EmailMarketingClient />
      </main>
    </div>
  )
}
