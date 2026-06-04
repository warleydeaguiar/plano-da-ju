import Sidebar from '../components/Sidebar'
import PromotionsManager from './PromotionsManager'
import { T, fonts, gradient, shadow } from '../theme'

export const dynamic = 'force-dynamic'

export default function PromocoesAdminPage() {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: T.bg, fontFamily: fonts.ui, color: T.ink }}>
      <Sidebar />
      <main className="dash-main" style={{ marginLeft: 234, flex: 1, height: '100vh', overflowY: 'auto', padding: 32, display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div style={{ background: gradient.hero, borderRadius: 22, padding: '26px 28px', boxShadow: shadow.hero, color: '#fff' }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, fontFamily: fonts.display }}>Promoções no App</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, opacity: 0.9 }}>
            Ofertas temporárias que aparecem na aba <b>Promoções</b> do app das clientes, com período de validade.
          </p>
        </div>
        <PromotionsManager />
      </main>
    </div>
  )
}
