import { createAdminClient } from '@/lib/supabase'
import Sidebar from '../components/Sidebar'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Relatórios — Admin Plano da Ju' }

const accent = '#BE185D'
const gray = '#7C6B7E'

// Dia (BR, UTC-3) de um timestamp ISO.
function brDay(iso: string): string {
  return new Date(new Date(iso).getTime() - 3 * 3600_000).toISOString().slice(0, 10)
}
const todayBR = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10)

export default async function RelatoriosPage() {
  const sb = createAdminClient()
  const DAYS = 30
  const since = new Date(Date.now() - DAYS * 86400_000).toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb.from('profiles') as any)
    .select('created_at')
    .eq('subscription_type', 'parceria')
    .gte('created_at', since)
    .limit(20000)

  const byDay: Record<string, number> = {}
  for (const r of ((data ?? []) as { created_at: string }[])) {
    const d = brDay(r.created_at)
    byDay[d] = (byDay[d] ?? 0) + 1
  }

  // Série contínua dos últimos DAYS dias (preenche dias sem parceria).
  const series: Array<{ date: string; label: string; n: number }> = []
  const cur = new Date(new Date(Date.now() - (DAYS - 1) * 86400_000 - 3 * 3600_000).toISOString().slice(0, 10) + 'T12:00:00')
  const end = new Date(todayBR() + 'T12:00:00')
  while (cur <= end) {
    const date = cur.toISOString().slice(0, 10)
    const [, m, dd] = date.split('-')
    series.push({ date, label: `${dd}/${m}`, n: byDay[date] ?? 0 })
    cur.setDate(cur.getDate() + 1)
  }

  const total = series.reduce((s, d) => s + d.n, 0)
  const max = Math.max(1, ...series.map(d => d.n))
  const avg = total / series.length

  const cards: Array<[string, string | number]> = [
    ['Parcerias (30 dias)', total],
    ['Média por dia', avg.toFixed(1)],
    ['Maior dia', max],
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#FFFAF5', fontFamily: 'Plus Jakarta Sans, -apple-system, system-ui, sans-serif' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '28px 32px', overflow: 'auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#2A1E2C', margin: '0 0 4px' }}>Relatórios</h1>
        <p style={{ fontSize: 13.5, color: gray, margin: '0 0 24px' }}>Parcerias ativadas por dia (últimos {DAYS} dias)</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
          {cards.map(([l, v]) => (
            <div key={l} style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', border: '1px solid rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 11, color: gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>{l}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#2A1E2C', lineHeight: 1 }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{ background: '#fff', borderRadius: 14, padding: '22px 24px', border: '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#2A1E2C', marginBottom: 22 }}>Parcerias por dia</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 210, paddingBottom: 26 }}>
            {series.map(d => (
              <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: d.n ? accent : '#D9CEDA', height: 14 }}>{d.n || ''}</div>
                <div
                  title={`${d.label}: ${d.n} parceria(s)`}
                  style={{
                    width: '100%', maxWidth: 24,
                    height: `${Math.max(3, (d.n / max) * 150)}px`,
                    background: d.n ? `linear-gradient(180deg, ${accent}, #EC4899)` : '#F0EAF2',
                    borderRadius: '5px 5px 2px 2px',
                  }}
                />
                <div style={{ fontSize: 9, color: gray, transform: 'rotate(-45deg)', transformOrigin: 'center', whiteSpace: 'nowrap', marginTop: 6 }}>{d.label}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
