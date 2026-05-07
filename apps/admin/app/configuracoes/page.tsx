import Sidebar from '../components/Sidebar'
import AdminUsersSection from './AdminUsersSection'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Configurações — Admin Plano da Ju' }

const accent = '#C4607A'
const green  = '#34C759'
const orange = '#FF9500'
const gray   = '#8A8A8E'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', marginBottom: 20 }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #F0F0F5', fontSize: 14, fontWeight: 700, color: '#2D1B2E' }}>
        {title}
      </div>
      <div style={{ padding: '20px 24px' }}>
        {children}
      </div>
    </div>
  )
}

function Row({ label, value, status, statusColor, mono }: {
  label: string; value: string; status?: string; statusColor?: string; mono?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F5F5F7', gap: 16 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#2D1B2E' }}>{label}</div>
        <div style={{ fontSize: 12, color: gray, marginTop: 2, fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-all' }}>{value}</div>
      </div>
      {status && (
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, flexShrink: 0,
          background: (statusColor ?? green) + '18', color: statusColor ?? green,
        }}>{status}</span>
      )}
    </div>
  )
}

export default function ConfiguracoesPage() {
  const evolUrl  = process.env.EVOLUTION_GRUPOS_URL  || '—'
  const evolInst = process.env.EVOLUTION_GRUPOS_INSTANCE || '—'
  const supaUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL || '—'
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL || '—'
  const webUrl   = process.env.NEXT_PUBLIC_WEB_URL || '—'

  const evolKeySet  = !!process.env.EVOLUTION_GRUPOS_KEY
  const pagarmeSet  = !!process.env.PAGARME_SECRET_KEY
  const anthropicSet = !!process.env.ANTHROPIC_API_KEY

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: '#F5F5F7', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
    }}>
      <Sidebar />
      <main style={{ marginLeft: 220, flex: 1, height: '100vh', overflowY: 'auto', padding: '32px 40px', maxWidth: 860 }}>

        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#2D1B2E' }}>Configurações</div>
          <div style={{ fontSize: 13, color: gray, marginTop: 4 }}>Status das integrações e variáveis de ambiente</div>
        </div>

        <Section title="🔗 URLs do sistema">
          <Row label="App público (quiz)" value={appUrl} />
          <Row label="Web (quiz)" value={webUrl} />
          <Row label="Link de entrada grupos" value={`${appUrl}/g/entrar`} />
          <Row label="Supabase URL" value={supaUrl} mono />
        </Section>

        <Section title="💬 Evolution API — Grupos de Promoções">
          <Row label="URL da instância" value={evolUrl} status="Configurado" statusColor={evolUrl !== '—' ? green : orange} />
          <Row label="Instância" value={evolInst} />
          <Row label="API Key" value={evolKeySet ? '●●●●●●●●●●●●●●●●' : 'Não configurada'} status={evolKeySet ? 'OK' : 'Ausente'} statusColor={evolKeySet ? green : orange} mono />
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#F9F9FC', borderRadius: 8, fontSize: 12, color: gray }}>
            Configure em <code style={{ background: '#F0F0F5', padding: '1px 4px', borderRadius: 4 }}>.env.local</code>:
            {' '}<code style={{ background: '#F0F0F5', padding: '1px 4px', borderRadius: 4 }}>EVOLUTION_GRUPOS_URL</code>,
            {' '}<code style={{ background: '#F0F0F5', padding: '1px 4px', borderRadius: 4 }}>EVOLUTION_GRUPOS_KEY</code>,
            {' '}<code style={{ background: '#F0F0F5', padding: '1px 4px', borderRadius: 4 }}>EVOLUTION_GRUPOS_INSTANCE</code>
          </div>
        </Section>

        <Section title="💳 PagarMe">
          <Row
            label="Secret Key"
            value={pagarmeSet ? '●●●●●●●●●●●●●●●●' : 'Não configurada'}
            status={pagarmeSet ? 'OK' : 'Ausente'}
            statusColor={pagarmeSet ? green : orange}
            mono
          />
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#F9F9FC', borderRadius: 8, fontSize: 12, color: gray }}>
            Configure em <code style={{ background: '#F0F0F5', padding: '1px 4px', borderRadius: 4 }}>PAGARME_SECRET_KEY</code> para processar pagamentos.
          </div>
        </Section>

        <Section title="🤖 Claude AI (Anthropic)">
          <Row
            label="Anthropic API Key"
            value={anthropicSet ? '●●●●●●●●●●●●●●●●' : 'Não configurada'}
            status={anthropicSet ? 'OK' : 'Ausente'}
            statusColor={anthropicSet ? green : orange}
            mono
          />
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#F9F9FC', borderRadius: 8, fontSize: 12, color: gray }}>
            Configure em <code style={{ background: '#F0F0F5', padding: '1px 4px', borderRadius: 4 }}>ANTHROPIC_API_KEY</code> para geração de planos e análise de fotos.
          </div>
        </Section>

        <Section title="📋 Webhooks">
          <Row
            label="PagarMe Webhook"
            value={`${appUrl}/api/webhook/pagarme`}
            status="Configurar no painel PagarMe"
            statusColor={orange}
          />
          <div style={{ marginTop: 12, padding: '12px 14px', background: '#F9F9FC', borderRadius: 8, fontSize: 12, color: gray }}>
            <strong style={{ color: '#2D1B2E' }}>Eventos a configurar:</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: 16 }}>
              <li><code>charge.paid</code> — ativa assinatura após pagamento</li>
              <li><code>charge.refunded</code> — cancela assinatura</li>
              <li><code>subscription.canceled</code> — marca como cancelada</li>
            </ul>
          </div>
        </Section>

        <Section title="👤 Administradores do sistema">
          <AdminUsersSection />
        </Section>

        <Section title="⚙️ Variáveis de ambiente — checklist">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { name: 'NEXT_PUBLIC_SUPABASE_URL',       set: !!supaUrl && supaUrl !== '—' },
              { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',  set: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
              { name: 'SUPABASE_SERVICE_ROLE_KEY',      set: !!process.env.SUPABASE_SERVICE_ROLE_KEY },
              { name: 'EVOLUTION_GRUPOS_URL',           set: !!process.env.EVOLUTION_GRUPOS_URL },
              { name: 'EVOLUTION_GRUPOS_KEY',           set: evolKeySet },
              { name: 'EVOLUTION_GRUPOS_INSTANCE',      set: !!process.env.EVOLUTION_GRUPOS_INSTANCE },
              { name: 'PAGARME_SECRET_KEY',             set: pagarmeSet },
              { name: 'ANTHROPIC_API_KEY',              set: anthropicSet },
              { name: 'NEXT_PUBLIC_APP_URL',            set: !!process.env.NEXT_PUBLIC_APP_URL },
              { name: 'NEXT_PUBLIC_WEB_URL',            set: !!process.env.NEXT_PUBLIC_WEB_URL },
            ].map(({ name, set }) => (
              <div key={name} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', background: '#F9F9FC', borderRadius: 8,
              }}>
                <span style={{ fontSize: 12, color: set ? green : orange, flexShrink: 0 }}>{set ? '✓' : '○'}</span>
                <code style={{ fontSize: 11, color: '#2D1B2E', wordBreak: 'break-all' }}>{name}</code>
              </div>
            ))}
          </div>
        </Section>

      </main>
    </div>
  )
}
