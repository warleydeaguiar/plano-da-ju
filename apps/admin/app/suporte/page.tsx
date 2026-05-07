import { createAdminClient } from '@/lib/supabase'
import {
  getSuporteInstanceInfo,
  getRecentChatsBreakdown,
  SUPORTE_INSTANCE,
} from '@/lib/evolution-suporte'
import Sidebar from '../components/Sidebar'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Suporte Plano Capilar — Admin' }

// ─── Derivar URL do Evolution Manager ────────────────────────────────────────
const EVOLUTION_BASE = process.env.EVOLUTION_SUPORTE_URL ?? process.env.EVOLUTION_GRUPOS_URL ?? 'http://automacao.julianecost.com'
const EVOLUTION_MANAGER_URL = EVOLUTION_BASE.replace(/\/+$/, '').replace(':8080', '') + '/manager'

// ─── Cores ───────────────────────────────────────────────────────────────────
const accent = '#C4607A'
const green  = '#34C759'
const orange = '#FF9500'
const red    = '#FF3B30'
const gray   = '#8A8A8E'
const blue   = '#007AFF'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, color, icon,
}: {
  label: string; value: string | number; sub?: string; color?: string; icon?: string
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid rgba(0,0,0,0.06)' }}>
      {icon && <div style={{ fontSize: 20, marginBottom: 8 }}>{icon}</div>}
      <div style={{ fontSize: 12, color: gray, fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color ?? '#2D1B2E', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: gray, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function formatPhone(jid: string) {
  const num = jid.replace('@s.whatsapp.net', '').replace('@c.us', '')
  if (num.startsWith('55') && num.length >= 12) {
    const ddd  = num.slice(2, 4)
    const rest = num.slice(4)
    const part1 = rest.slice(0, rest.length > 8 ? rest.length - 4 : 4)
    const part2 = rest.slice(-4)
    return `+55 (${ddd}) ${part1}-${part2}`
  }
  return `+${num}`
}

function timeAgo(isoStr: string) {
  const diff = Date.now() - new Date(isoStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'agora'
  if (m < 60) return `${m}min atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  const d = Math.floor(h / 24)
  return `${d}d atrás`
}

// ─── Data fetching ────────────────────────────────────────────────────────────
async function getLeadsData() {
  const supabase = createAdminClient()
  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const day7ago  = new Date(now.getTime() - 7  * 86400000).toISOString()
  const day30ago = new Date(now.getTime() - 30 * 86400000).toISOString()
  const day14ago = new Date(now.getTime() - 14 * 86400000).toISOString()

  const [totalRes, todayRes, week7Res, month30Res, recentRes, chartRes] = await Promise.all([
    (supabase.from('profiles') as any).select('*', { count: 'exact', head: true }),
    (supabase.from('profiles') as any).select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
    (supabase.from('profiles') as any).select('*', { count: 'exact', head: true }).gte('created_at', day7ago),
    (supabase.from('profiles') as any).select('*', { count: 'exact', head: true }).gte('created_at', day30ago),
    (supabase.from('profiles') as any)
      .select('id, full_name, email, hair_type, subscription_status, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
    (supabase.from('profiles') as any)
      .select('created_at')
      .gte('created_at', day14ago)
      .order('created_at', { ascending: true }),
  ])

  // Build 14-day chart
  const dayBuckets: Record<string, number> = {}
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000)
    const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    dayBuckets[key] = 0
  }
  ;(chartRes.data ?? []).forEach((r: any) => {
    const key = new Date(r.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    if (key in dayBuckets) dayBuckets[key]++
  })

  return {
    total:      totalRes.count  ?? 0,
    hoje:       todayRes.count  ?? 0,
    ultimos7d:  week7Res.count  ?? 0,
    ultimos30d: month30Res.count ?? 0,
    recentes:   (recentRes.data ?? []) as any[],
    chartData:  Object.entries(dayBuckets),
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function SuportePage() {
  const [leads, instInfo, chats] = await Promise.allSettled([
    getLeadsData(),
    getSuporteInstanceInfo(),
    getRecentChatsBreakdown(),
  ])

  const leadsData = leads.status === 'fulfilled' ? leads.value : null
  const inst      = instInfo.status === 'fulfilled' ? instInfo.value : null
  const chatsData = chats.status === 'fulfilled' ? chats.value : null

  const connected   = inst?.connectionStatus === 'open'
  const connColor   = connected ? green : inst?.connectionStatus === 'connecting' ? orange : red
  const connLabel   = connected ? 'Conectado' : inst?.connectionStatus === 'connecting' ? 'Conectando…' : 'Desconectado'

  const maxBar = Math.max(1, ...(leadsData?.chartData.map(([, v]) => v) ?? [1]))

  const HAIR_LABEL: Record<string, string> = {
    liso: 'Liso', ondulado: 'Ondulado', cacheado: 'Cacheado', crespo: 'Crespo',
  }
  const SUB_COLOR: Record<string, string> = {
    active: green, pending: orange, expired: gray, cancelled: red,
  }

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: '#F5F5F7', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
    }}>
      <Sidebar />
      <main style={{ marginLeft: 220, flex: 1, height: '100vh', overflowY: 'auto', padding: '32px 40px' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#2D1B2E' }}>Suporte Plano Capilar</div>
            <div style={{ fontSize: 13, color: gray, marginTop: 4 }}>
              WhatsApp de atendimento — instância <code style={{ background: '#F5F5F7', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>{SUPORTE_INSTANCE}</code>
            </div>
          </div>
          <a
            href={EVOLUTION_MANAGER_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: '#2D1B2E', color: '#fff',
              padding: '9px 18px', borderRadius: 10,
              fontSize: 13, fontWeight: 600, textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            Abrir Evolution Manager ↗
          </a>
        </div>

        {/* ── Status do WhatsApp ── */}
        <div style={{
          background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)',
          padding: '18px 24px', marginBottom: 24,
          display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
        }}>
          {/* Avatar */}
          {inst?.profilePicUrl ? (
            <img
              src={inst.profilePicUrl}
              alt="foto"
              style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            />
          ) : (
            <div style={{
              width: 52, height: 52, borderRadius: '50%', background: accent + '20',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0,
            }}>📱</div>
          )}

          {/* Info */}
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#2D1B2E', marginBottom: 2 }}>
              {inst?.profileName ?? 'WhatsApp Suporte'}
            </div>
            {inst?.ownerJid && (
              <div style={{ fontSize: 12, color: gray }}>
                {formatPhone(inst.ownerJid)}
              </div>
            )}
          </div>

          {/* Status badge */}
          <span style={{
            fontSize: 13, fontWeight: 700, padding: '6px 16px', borderRadius: 20,
            background: connColor + '18', color: connColor,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{
              display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
              background: connColor,
              boxShadow: connected ? `0 0 0 2px ${connColor}40` : 'none',
            }} />
            {connLabel}
          </span>

          {/* Totais do Evolution */}
          {inst && (
            <div style={{ display: 'flex', gap: 24, flexShrink: 0 }}>
              {[
                { label: 'Mensagens', value: inst.messageCount.toLocaleString('pt-BR'), icon: '💬' },
                { label: 'Contatos',  value: inst.contactCount.toLocaleString('pt-BR'),  icon: '👤' },
                { label: 'Chats',     value: inst.chatCount.toLocaleString('pt-BR'),     icon: '🗂' },
              ].map(({ label, value, icon }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: gray, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#2D1B2E' }}>{icon} {value}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── KPIs ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          <StatCard icon="🎯" label="Total de leads" value={(leadsData?.total ?? 0).toLocaleString('pt-BR')} sub="perfis cadastrados" />
          <StatCard icon="🆕" label="Novos hoje"     value={leadsData?.hoje ?? 0}     color={accent}  sub="leads do dia" />
          <StatCard icon="📅" label="Últimos 7 dias" value={leadsData?.ultimos7d ?? 0} color={blue}    sub={`${leadsData?.ultimos30d ?? 0} no mês`} />
          <StatCard icon="💬" label="Conversas hoje" value={chatsData?.hoje ?? 0}      color={green}   sub={`${chatsData?.ultimos7d ?? 0} essa semana`} />
        </div>

        {/* ── Gráfico + Breakdown conversas ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 28 }}>

          {/* Bar chart leads */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 24px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#2D1B2E', marginBottom: 20 }}>
              Novos leads — últimos 14 dias
            </div>
            {leadsData ? (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 90 }}>
                {leadsData.chartData.map(([day, count], i) => {
                  const isToday = i === leadsData.chartData.length - 1
                  const h = count > 0 ? Math.max(6, (count / maxBar) * 75) : 3
                  return (
                    <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      {count > 0 && (
                        <div style={{ fontSize: 9, fontWeight: 700, color: isToday ? accent : '#2D1B2E' }}>{count}</div>
                      )}
                      <div style={{
                        width: '100%', height: h, borderRadius: '3px 3px 0 0',
                        background: count === 0 ? '#F2F2F7' : isToday ? 'rgba(196,96,122,0.45)' : accent,
                        opacity: count === 0 ? 0.4 : 0.88,
                      }} />
                      {i % 2 === 0 && (
                        <div style={{ fontSize: 8.5, color: isToday ? accent : gray, fontWeight: isToday ? 700 : 400, whiteSpace: 'nowrap' }}>
                          {day}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ color: gray, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Sem dados</div>
            )}
          </div>

          {/* Breakdown conversas */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 24px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#2D1B2E', marginBottom: 16 }}>Conversas WhatsApp</div>
            {chatsData ? (
              <>
                {[
                  { label: 'Hoje',       value: chatsData.hoje,       color: accent },
                  { label: 'Últimos 7d', value: chatsData.ultimos7d,  color: blue },
                  { label: 'Últimos 30d',value: chatsData.ultimos30d, color: green },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '9px 0', borderBottom: '1px solid #F5F5F7',
                  }}>
                    <div style={{ fontSize: 13, color: gray }}>{label}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
                  </div>
                ))}
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ background: '#F9F9FC', borderRadius: 10, padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#2D1B2E' }}>{chatsData.diretas}</div>
                    <div style={{ fontSize: 11, color: gray, marginTop: 2 }}>Diretas</div>
                  </div>
                  <div style={{ background: '#F9F9FC', borderRadius: 10, padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#2D1B2E' }}>{chatsData.grupos}</div>
                    <div style={{ fontSize: 11, color: gray, marginTop: 2 }}>Grupos</div>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ color: gray, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Sem dados</div>
            )}
          </div>
        </div>

        {/* ── Conversas recentes + Leads recentes (lado a lado) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* Conversas recentes */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0F0F5', fontSize: 14, fontWeight: 700, color: '#2D1B2E' }}>
              💬 Conversas recentes
            </div>
            <div style={{ padding: '4px 0' }}>
              {chatsData && chatsData.recentes.length > 0 ? chatsData.recentes.map((c, i) => (
                <div key={i} style={{
                  padding: '11px 20px', borderBottom: '1px solid #F9F9FC',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', background: accent + '20',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, color: accent, flexShrink: 0,
                    }}>
                      {(c.nome ?? '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#2D1B2E' }}>
                        {c.nome ?? formatPhone(c.jid)}
                      </div>
                      <div style={{ fontSize: 11, color: gray }}>
                        {formatPhone(c.jid)}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: gray, flexShrink: 0 }}>
                    {c.atualizadaEm ? timeAgo(c.atualizadaEm) : '—'}
                  </div>
                </div>
              )) : (
                <div style={{ padding: '24px', textAlign: 'center', color: gray, fontSize: 13 }}>
                  Sem conversas recentes
                </div>
              )}
            </div>
          </div>

          {/* Leads recentes */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0F0F5', fontSize: 14, fontWeight: 700, color: '#2D1B2E' }}>
              🎯 Leads recentes
            </div>
            <div style={{ padding: '4px 0' }}>
              {leadsData && leadsData.recentes.length > 0 ? leadsData.recentes.map((u: any) => (
                <div key={u.id} style={{
                  padding: '11px 20px', borderBottom: '1px solid #F9F9FC',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#2D1B2E' }}>
                      {u.full_name ?? u.email.split('@')[0]}
                    </div>
                    <div style={{ fontSize: 11, color: gray }}>
                      {u.hair_type ? HAIR_LABEL[u.hair_type] ?? u.hair_type : 'Sem perfil'} · {u.email}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20,
                      background: (SUB_COLOR[u.subscription_status] ?? gray) + '18',
                      color: SUB_COLOR[u.subscription_status] ?? gray,
                    }}>
                      {u.subscription_status === 'active' ? 'Assinante' :
                       u.subscription_status === 'pending' ? 'Pendente' :
                       u.subscription_status === 'expired' ? 'Expirado' : 'Cancelado'}
                    </span>
                    <div style={{ fontSize: 11, color: gray }}>
                      {new Date(u.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </div>
                  </div>
                </div>
              )) : (
                <div style={{ padding: '24px', textAlign: 'center', color: gray, fontSize: 13 }}>
                  Sem leads cadastrados
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
