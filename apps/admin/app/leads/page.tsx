import { createAdminClient } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'
import LeadsClient from './LeadsClient'

export const revalidate = 30
export const metadata = { title: 'Leads — Admin Plano da Ju' }

export default async function LeadsPage() {
  const sb = createAdminClient()

  // Leads do quiz (wg_quiz_leads)
  const { data: quizLeads } = await (sb as any)
    .from('wg_quiz_leads')
    .select('id,name,email,phone,quiz_slug,utm_source,utm_campaign,created_at')
    .in('quiz_slug', ['plano-capilar', 'fashion-gold'])
    .order('created_at', { ascending: false })
    .limit(500)

  // Profiles que iniciaram checkout mas não compraram (pending)
  const { data: checkoutAbandoned } = await (sb as any)
    .from('profiles')
    .select('id,full_name,email,subscription_status,quiz_answers,created_at,updated_at')
    .eq('subscription_status', 'pending')
    .order('created_at', { ascending: false })

  // Clientes ativos para cross-reference
  const { data: activeProfiles } = await (sb as any)
    .from('profiles')
    .select('email,subscription_status')
    .eq('subscription_status', 'active')

  const activeEmails = new Set((activeProfiles ?? []).map((p: any) => p.email?.toLowerCase()))

  // Enriche quiz leads com status de cliente
  const leads = (quizLeads ?? []).map((l: any) => ({
    ...l,
    isCliente: l.email ? activeEmails.has(l.email?.toLowerCase()) : false,
  }))

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: '#F5F5F7', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
    }}>
      <Sidebar />
      <main style={{ marginLeft: 220, flex: 1, height: '100vh', overflowY: 'auto' }}>
        <LeadsClient
          leads={leads}
          checkoutAbandoned={(checkoutAbandoned ?? []) as any[]}
        />
      </main>
    </div>
  )
}
