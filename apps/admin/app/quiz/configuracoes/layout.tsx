import Sidebar from '../../components/Sidebar'

export default function QuizConfigLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: '#F5F5F7', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif', color: '#2D1B2E',
    }}>
      <Sidebar />
      <main style={{ marginLeft: 220, flex: 1, height: '100vh', overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
