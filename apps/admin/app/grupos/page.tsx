import { createAdminClient } from '@/lib/supabase'
import { fetchAllInstances } from '@/lib/evolution-grupos'
import Link from 'next/link'
import GruposChartsSection from './GruposChartsSection'

export const dynamic = 'force-dynamic'

const EVOLUTION_MANAGER_URL = process.env.EVOLUTION_GRUPOS_URL
  ? process.env.EVOLUTION_GRUPOS_URL.replace(/\/+$/, '').replace(':8080', '') + '/manager'
  : 'https://automacao.julianecost.com/manager'

async function getGruposStats() {
  const supabase = createAdminClient()
  const [groupsRes, clicksRes, broadcastsRes] = await Promise.all([
    supabase.from('wg_groups' as any).select('*').neq('status', 'archived'),
    supabase
      .from('wg_redirect_clicks' as any)
      .select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 86400000).toISOString()),
    supabase
      .from('wg_broadcasts' as any)
      .select('id, title, message, sent_at, success_count, fail_count, total_groups, status, scheduled_at, instance_name')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const groups = (groupsRes.data ?? []) as any[]
  const totalMembers = groups.reduce((s: number, g: any) => s + (g.member_count ?? 0), 0)
  const activeGroups = groups.filter((g: any) => g.status === 'active' && g.is_receiving)
  const fullGroups   = groups.filter((g: any) => g.status === 'full')

  return {
    groups,
    totalMembers,
    activeCount:  activeGroups.length,
    fullCount:    fullGroups.length,
    totalGroups:  groups.length,
    clicksToday:  clicksRes.count ?? 0,
    recentBroadcasts: (broadcastsRes.data ?? []) as any[],
  }
}

const accent = '#C4607A'
const green  = '#34C759'
const orange = '#FF9500'
const red    = '#FF3B30'
const gray   = '#8A8A8E'

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: 13, color: gray, fontWeight: 500, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color ?? '#2D1B2E', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: gray, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function pct(count: number, capacity: number) {
  return Math.round((count / Math.max(capacity, 1)) * 100)
}

function statusBadge(g: any) {
  if (g.status === 'full')     return { label: 'Cheio', color: red }
  if (g.status === 'archived') return { label: 'Arquivado', color: gray }
  if (g.is_receiving)          return { label: 'Recebendo', color: green }
  return { label: 'Pausado', color: orange }
}

function instanceStatusColor(status: string) {
  if (status === 'open')       return green
  if (status === 'connecting') return orange
  return red
}
function instanceStatusLabel(status: string) {
  if (status === 'open')       return 'Conectado'
  if (status === 'connecting') return 'Conectando…'
  return 'Desconectado'
}

export default async function GruposPage() {
  const [stats, instances] = await Promise.all([
    getGruposStats(),
    fetchAllInstances().catch(() => []),
  ])
  const { groups, totalMembers, activeCount, fullCount, totalGroups, clicksToday, recentBroadcasts } = stats

  // Filtra apenas instâncias de grupos (exclui "plano capilar")
  const grupoInstances = instances.filter(i =>
    i.name.toLowerCase().includes('grupo') ||
    i.name.toLowerCase().includes('promo') ||
    i.name.toLowerCase().includes('ybera')
  )

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#2D1B2E' }}>Grupos de Promoções</div>
          <div style={{ fontSize: 14, color: gray, marginTop: 4 }}>
            Distribuição proporcional via link único —{' '}
            <code style={{ background: '#F5F5F7', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>
              plano.julianecost.com/g/entrar
            </code>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link href="/grupos/broadcast" style={{
            background: '#F5F5F7', color: '#2D1B2E', padding: '9px 18px',
            borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none',
          }}>
            📢 Enviar mensagem
          </Link>
          <Link href="/grupos/gerenciar" style={{
            background: accent, color: '#fff', padding: '9px 18px',
            borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none',
          }}>
            ⚙️ Gerenciar
          </Link>
        </div>
      </div>

      {/* Números conectados (todas as instâncias) */}
      <div style={{
        background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)',
        padding: '18px 24px', marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#2D1B2E' }}>📱 Números WhatsApp</div>
          <a
            href={EVOLUTION_MANAGER_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: '#2D1B2E', color: '#fff', padding: '7px 14px', borderRadius: 9,
              fontSize: 12, fontWeight: 600, textDecoration: 'none',
            }}
          >
            Abrir Evolution Manager ↗
          </a>
        </div>

        {instances.length === 0 ? (
          <div style={{ fontSize: 13, color: gray }}>Não foi possível conectar ao Evolution API.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {instances.map((inst) => {
              const color = instanceStatusColor(inst.connectionStatus)
              const label = instanceStatusLabel(inst.connectionStatus)
              return (
                <div key={inst.name} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 12,
                  background: inst.connectionStatus === 'open' ? green + '08' : '#F9F9FC',
                  border: `1px solid ${color}22`,
                }}>
                  {/* Avatar */}
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                    background: inst.profilePicUrl ? 'transparent' : color + '20',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden',
                    border: `2px solid ${color}40`,
                  }}>
                    {inst.profilePicUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={inst.profilePicUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: 18 }}>📱</span>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#2D1B2E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {inst.profileName ?? inst.name}
                    </div>
                    <div style={{ fontSize: 11, color: gray, marginTop: 1 }}>
                      {inst.ownerJid
                        ? inst.ownerJid.replace('@s.whatsapp.net', '').replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4')
                        : inst.name}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, flexShrink: 0,
                    background: color + '18', color,
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <span style={{
                      display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: color,
                      boxShadow: inst.connectionStatus === 'open' ? `0 0 0 2px ${color}40` : 'none',
                    }} />
                    {label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="Total de membros" value={totalMembers.toLocaleString('pt-BR')} sub={`em ${totalGroups} grupos`} />
        <StatCard label="Recebendo agora" value={activeCount} sub="grupos ativos" color={green} />
        <StatCard label="Grupos cheios" value={fullCount} sub="capacity 1.024" color={fullCount > 0 ? red : '#2D1B2E'} />
        <StatCard label="Cliques hoje" value={clicksToday} sub="redirecionamentos" color={accent} />
      </div>

      {/* Charts */}
      <GruposChartsSection />

      {/* Lista de grupos */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', marginBottom: 28 }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #F0F0F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#2D1B2E' }}>Grupos cadastrados</div>
          <Link href="/grupos/gerenciar" style={{ fontSize: 13, color: accent, fontWeight: 600, textDecoration: 'none' }}>
            Gerenciar →
          </Link>
        </div>

        {groups.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: gray, fontSize: 14 }}>
            Nenhum grupo cadastrado.{' '}
            <Link href="/grupos/gerenciar" style={{ color: accent }}>Adicione ou descubra grupos →</Link>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F0F0F5' }}>
                {['Grupo', 'Membros', 'Ocupação', 'Status', 'Último sync'].map((h) => (
                  <th key={h} style={{ padding: '10px 24px', textAlign: 'left', fontSize: 12, color: gray, fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g: any) => {
                const badge = statusBadge(g)
                const fill  = pct(g.member_count, g.capacity ?? 1024)
                return (
                  <tr key={g.id} style={{ borderBottom: '1px solid #F9F9FC' }}>
                    <td style={{ padding: '14px 24px' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#2D1B2E' }}>{g.name}</div>
                      {g.jid && <div style={{ fontSize: 11, color: gray, marginTop: 2 }}>{g.jid}</div>}
                    </td>
                    <td style={{ padding: '14px 24px', fontSize: 14, fontWeight: 600, color: '#2D1B2E' }}>
                      {g.member_count} <span style={{ color: gray, fontWeight: 400 }}>/ {g.capacity ?? 1024}</span>
                    </td>
                    <td style={{ padding: '14px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: '#F0F0F5', borderRadius: 3, minWidth: 80 }}>
                          <div style={{
                            height: '100%', borderRadius: 3, width: `${Math.min(fill, 100)}%`,
                            background: fill >= 95 ? red : fill >= 80 ? orange : green,
                          }} />
                        </div>
                        <span style={{ fontSize: 12, color: gray, minWidth: 32 }}>{fill}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 24px' }}>
                      <span style={{
                        fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                        background: badge.color + '18', color: badge.color,
                      }}>{badge.label}</span>
                    </td>
                    <td style={{ padding: '14px 24px', fontSize: 12, color: gray }}>
                      {g.last_synced_at
                        ? new Date(g.last_synced_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Broadcasts recentes */}
      {recentBroadcasts.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid #F0F0F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#2D1B2E' }}>Mensagens recentes</div>
            <Link href="/grupos/broadcast" style={{ fontSize: 13, color: accent, fontWeight: 600, textDecoration: 'none' }}>
              Enviar nova →
            </Link>
          </div>
          <div style={{ padding: '8px 0' }}>
            {recentBroadcasts.map((b: any) => (
              <div key={b.id} style={{ padding: '12px 24px', borderBottom: '1px solid #F9F9FC', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#2D1B2E', marginBottom: 2 }}>
                    {b.title || b.message.slice(0, 60) + (b.message.length > 60 ? '…' : '')}
                  </div>
                  <div style={{ fontSize: 12, color: gray }}>
                    {b.status === 'scheduled' && b.scheduled_at
                      ? `Agendado para ${new Date(b.scheduled_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                      : b.sent_at
                        ? new Date(b.sent_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    {b.status !== 'scheduled' && ` · ${b.success_count}/${b.total_groups} grupos`}
                    {b.instance_name && ` · via ${b.instance_name}`}
                  </div>
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                  background: b.status === 'done' ? green + '18' : b.status === 'scheduled' ? accent + '18' : orange + '18',
                  color: b.status === 'done' ? green : b.status === 'scheduled' ? accent : orange,
                }}>
                  {b.status === 'done' ? 'Enviado' : b.status === 'scheduled' ? '🕐 Agendado' : b.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
