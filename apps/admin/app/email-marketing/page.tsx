import Sidebar from '../components/Sidebar'
import EmailMarketingClient from './EmailMarketingClient'

export const metadata = {
  title: 'Email Marketing — Plano da Ju Admin',
}

export default function EmailMarketingPage() {
  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: '#F5F5F7', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
    }}>
      <Sidebar />
      <main style={{ marginLeft: 220, flex: 1, height: '100vh', overflowY: 'auto' }}>
        <EmailMarketingClient />
      </main>
    </div>
  )
}
