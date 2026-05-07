import { createAdminClient } from '@/lib/supabase'
import { getInstanceStatus } from '@/lib/evolution-grupos'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const EVOLUTION_MANAGER_URL = process.env.EVOLUTION_GRUPOS_URL
  ? process.env.EVOLUTION_GRUPOS_URL.replace(/\/+$/, '').replace(':8080', '') + '/manager'
  : 'http://automacao.julianecost.com/manager'

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
      .select('id, title, message, sent_at, success_count, fail_count, total_groups, status')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const groups = (groupsRes.data ?? []) as any[]
  const totalMembers = groups.reduce((s: number, g: any) => s + (g.member_count ?? 0), 0)
  const activeGroups = groups.filter((g: any) => g.status === 'active' && g.is_receiving)
  const fullGroups   = groups.filter((g: any) => g.status === 'full')
  const clicksToday  = clicksRes.count ?? 0

  return {
    groups,
    totalMembers,
    activeCount:  activeGroups.length,
    fullCount:    fullGroups.length,
    totalGroups:  groups.length,
    clicksToday,
    recentBroadcasts: (broadcastsRes.data ?? []) as any[],
  }
}

async function getEvolutionStatus(): Promise<{ connected: boolean; state: string }> {
  try {
    const res = await getInstanceStatus()
    const state: string = res?.instance?.state ?? res?.state ?? 'unknown'
    return { connected: state === 'open', state }
  } catch {
    return { connected: false, state: 'error' }
  }
}

const accent = '#C4607A'
const green  = '#34C759'
const orange = '#FF9500'
const red    = '#FF3B30'

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      padding: '20px 24px',
      border: '1px solid rgba(0,0,0,0.06)',
    }}>
      <div style={{ fontSize: 13, color: '#8A8A8E', fontWeight: 500, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color ?? '#2D1B2E', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#8A8A8E', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function pct(count: number, capacity: number) {
  return Math.round((count / capacity) * 100)
}

function statusBadge(g: any) {
  if (g.status === 'full')     return { label: 'Cheio', color: red }
  if (g.status === 'archived') return { label: 'Arquivado', color: '#8A8A8E' }
  if (g.is_receiving)          return { label: 'Recebendo', color: green }
  return { label: 'Pausado', color: orange }
}

export default async function GruposPage() {
  const [stats, evoStatus] = await Promise.all([
    getGruposStats(),
    getEvolutionStatus(),
  ])
  const { groups, totalMembers, activeCount, fullCount, totalGroups, clicksToday, recentBroadcasts } = stats

  const evoColor = evoStatus.connected ? green : (evoStatus.state === 'connecting' ? orange : red)
  const evoLabel = evoStatus.connected ? 'Conectado' : (evoStatus.state === 'connecting' ? 'Conectando…' : 'Desconectado')

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#2D1B2E' }}>Grupos de Promoções</div>
          <div style={{ fontSize: 14, color: '#8A8A8E', marginTop: 4 }}>
            Distribuição proporcional via link único — <code style={{ background: '#F5F5F7', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>plano.julianecost.com/g/entrar</code>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link href="/grupos/broadcast" style={{
            background: '#F5F5F7', color: '#2D1B2E', padding: '9px 18px',
            borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none',
          }}>
            📢 Broadcast
          </Link>
          <Link href="/grupos/gerenciar" style={{
            background: accent, color: '#fff', padding: '9px 18px',
            borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none',
          }}>
            ⚙️ Gerenciar
          </Link>
        </div>
      </div>

      {/* Evolution API status + atalho */}
      <div style={{
        background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)',
        padding: '16px 24px', marginBottom: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 22 }}>📱</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#2D1B2E' }}>Evolution API — WhatsApp</div>
            <div style={{ fontSize: 12, color: '#8A8A8E', marginTop: 2 }}>
              Instância: <code style={{ background: '#F5F5F7', padding: '1px 5px', borderRadius: 4 }}>
                {process.env.EVOLUTION_GRUPOS_INSTANCE ?? 'grupos-promo'}
              </code>
            </div>
          </div>
          {/* Status pill */}
          <span style={{
            fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
            background: evoColor + '18', color: evoColor,
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <span style={{
              display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
              background: evoColor,
              boxShadow: evoStatus.connected ? `0 0 0 2px ${evoColor}40` : 'none',
            }} />
            {evoLabel}
          </span>
        </div>
        <a
          href={EVOLUTION_MANAGER_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: '#2D1B2E', color: '#fff',
            padding: '8px 16px', borderRadius: 10,
            fontSize: 13, fontWeight: 600, textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Abrir Evolution Manager ↗
        </a>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <StatCard label="Total de membros" value={totalMembers.toLocaleString('pt-BR')} sub={`em ${totalGroups} grupos`} />
        <StatCard label="Recebendo agora" value={activeCount} sub="grupos ativos" color={green} />
        <StatCard label="Grupos cheios" value={fullCount} sub="capacity 1.024" color={fullCount > 0 ? red : '#2D1B2E'} />
        <StatCard label="Cliques hoje" value={clicksToday} sub="redirecionamentos" color={accent} />
      </div>

      {/* Lista de grupos */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', marginBottom: 28 }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #F0F0F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#2D1B2E' }}>Grupos cadastrados</div>
          <Link href="/grupos/gerenciar" style={{ fontSize: 13, color: accent, fontWeight: 600, textDecoration: 'none' }}>
            Ver todos →
          </Link>
        </div>

        {groups.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: '#8A8A8E', fontSize: 14 }}>
            Nenhum grupo cadastrado. <Link href="/grupos/gerenciar" style={{ color: accent }}>Adicione o primeiro →</Link>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F0F0F5' }}>
                {['Grupo', 'Membros', 'Ocupação', 'Status', 'Último sync'].map((h) => (
                  <th key={h} style={{ padding: '10px 24px', textAlign: 'left', fontSize: 12, color: '#8A8A8E', fontWeight: 600 }}>{h}</th>
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
                      {g.jid && <div style={{ fontSize: 11, color: '#8A8A8E', marginTop: 2 }}>{g.jid}</div>}
                    </td>
                    <td style={{ padding: '14px 24px', fontSize: 14, fontWeight: 600, color: '#2D1B2E' }}>
                      {g.member_count} <span style={{ color: '#8A8A8E', fontWeight: 400 }}>/ {g.capacity ?? 1024}</span>
                    </td>
                    <td style={{ padding: '14px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: '#F0F0F5', borderRadius: 3, minWidth: 80 }}>
                          <div style={{
                            height: '100%', borderRadius: 3,
                            width: `${Math.min(fill, 100)}%`,
                            background: fill >= 95 ? red : fill >= 80 ? orange : green,
                          }} />
                        </div>
                        <span style={{ fontSize: 12, color: '#8A8A8E', minWidth: 32 }}>{fill}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 24px' }}>
                      <span style={{
                        fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                        background: badge.color + '18', color: badge.color,
                      }}>{badge.label}</span>
                    </td>
                    <td style={{ padding: '14px 24px', fontSize: 12, color: '#8A8A8E' }}>
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
            <div style={{ fontSize: 15, fontWeight: 700, color: '#2D1B2E' }}>Broadcasts recentes</div>
            <Link href="/grupos/broadcast" style={{ fontSize: 13, color: accent, fontWeight: 600, textDecoration: 'none' }}>
              Enviar novo →
            </Link>
          </div>
          <div style={{ padding: '8px 0' }}>
            {recentBroadcasts.map((b: any) => (
              <div key={b.id} style={{ padding: '12px 24px', borderBottom: '1px solid #F9F9FC', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#2D1B2E', marginBottom: 2 }}>
                    {b.title || b.message.slice(0, 60) + (b.message.length > 60 ? '…' : '')}
                  </div>
                  <div style={{ fontSize: 12, color: '#8A8A8E' }}>
                    {b.sent_at ? new Date(b.sent_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                    {' · '}{b.success_count}/{b.total_groups} grupos entregues
                  </div>
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                  background: b.status === 'done' ? green + '18' : orange + '18',
                  color: b.status === 'done' ? green : orange,
                }}>{b.status === 'done' ? 'Enviado' : b.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
