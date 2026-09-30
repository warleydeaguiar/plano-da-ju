import { createAdminClient } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'
import NotificacoesClient from './NotificacoesClient'

export const revalidate = 0
export const metadata = { title: 'Notificações Discord — Admin Plano da Ju' }

const gray = '#7C6B7E'
const dark = '#2A1E2C'

export type NotifDiscord = {
  chave: string
  nome: string
  descricao: string | null
  quando: string
  webhook_url: string | null
  ativo: boolean
  last_sent_at: string | null
}

export default async function NotificacoesPage() {
  const sb = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb.from('wg_notif_discord' as any) as any)
    .select('*')
    .order('chave')

  const items: NotifDiscord[] = (data ?? []) as NotifDiscord[]

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: '#FFFAF5', fontFamily: 'Plus Jakarta Sans, -apple-system, system-ui, sans-serif',
    }}>
      <Sidebar />
      <main style={{ marginLeft: 234, flex: 1, height: '100vh', overflowY: 'auto', padding: '32px 40px' }}>

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: dark, margin: 0 }}>
            🔔 Notificações Discord
          </h1>
          <p style={{ fontSize: 13, color: gray, margin: '4px 0 0' }}>
            Tudo que o sistema manda pro Discord: o quê, quando, e pra qual canal. Liga/desliga e troca o webhook sem mexer em código.
          </p>
        </div>

        <NotificacoesClient initialData={items} />

      </main>
    </div>
  )
}
