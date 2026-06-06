import Sidebar from '../../components/Sidebar'
import { T, fonts } from '../../theme'
import GaleriaClient from './GaleriaClient'

export const dynamic = 'force-dynamic'

export default function GaleriaPage() {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: T.bg, fontFamily: fonts.ui, color: T.ink }}>
      <Sidebar />
      <main className="dash-main" style={{ marginLeft: 234, flex: 1, height: '100vh', overflowY: 'auto', padding: 32 }}>
        <GaleriaClient />
      </main>
    </div>
  )
}
