import { createAdminClient } from '@/lib/supabase'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const accent = '#C4607A'
const green  = '#34C759'
const gray   = '#8A8A8E'
const blue   = '#007AFF'

async function getQuickStats() {
  const sb = createAdminClient()
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const [fgTotal, fgToday, fgViews, pcViews, pcViewsToday, pcProfiles] = await Promise.all([
    sb.from('wg_quiz_leads' as any).select('id', { count: 'exact', head: true }).eq('quiz_slug', 'fashion-gold'),
    sb.from('wg_quiz_leads' as any).select('id', { count: 'exact', head: true }).eq('quiz_slug', 'fashion-gold').gte('created_at', today.toISOString()),
    sb.from('wg_quiz_views' as any).select('id', { count: 'exact', head: true }).eq('quiz_slug', 'fashion-gold'),
    sb.from('wg_quiz_views' as any).select('id', { count: 'exact', head: true }).eq('quiz_slug', 'plano-capilar'),
    sb.from('wg_quiz_views' as any).select('id', { count: 'exact', head: true }).eq('quiz_slug', 'plano-capilar').gte('created_at', today.toISOString()),
    sb.from('profiles').select('id', { count: 'exact', head: true }),
  ])

  return {
    fashionGold: {
      totalLeads: fgTotal.count ?? 0,
      todayLeads: fgToday.count ?? 0,
      views:      fgViews.count ?? 0,
      conversion: fgViews.count ? Math.round(((fgTotal.count ?? 0) / fgViews.count) * 100) : null,
    },
    planoCapilar: {
      views:      pcViews.count ?? 0,
      todayViews: pcViewsToday.count ?? 0,
      profiles:   pcProfiles.count ?? 0,
    },
  }
}

export default async function QuizHubPage() {
  const { fashionGold, planoCapilar } = await getQuickStats()

  return (
    <div style={{ padding: '32px 40px', maxWidth: 960 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#2D1B2E', marginBottom: 4 }}>🎯 Quiz</div>
      <div style={{ fontSize: 14, color: gray, marginBottom: 32 }}>Gerencie e acompanhe os quizzes ativos</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Fashion Gold */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(135deg, #8a6d2f 0%, #c9a45c 100%)', padding: '24px 28px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: 1, textTransform: 'uppercase' }}>Captura de Leads</div>
              <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '2px 10px', borderRadius: 20 }}>Ativo</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 2 }}>Fashion Gold</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>Grupos de Promoções Ybera Paris</div>
          </div>

          <div style={{ padding: '20px 28px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div style={{ background: '#F9F9FC', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: gray, fontWeight: 600, marginBottom: 4 }}>TOTAL LEADS</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#2D1B2E' }}>{fashionGold.totalLeads.toLocaleString('pt-BR')}</div>
              </div>
              <div style={{ background: '#F9F9FC', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: gray, fontWeight: 600, marginBottom: 4 }}>HOJE</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: fashionGold.todayLeads > 0 ? green : '#2D1B2E' }}>{fashionGold.todayLeads}</div>
              </div>
              <div style={{ background: '#F9F9FC', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: gray, fontWeight: 600, marginBottom: 4 }}>CLIQUES</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#2D1B2E' }}>{fashionGold.views.toLocaleString('pt-BR')}</div>
              </div>
              <div style={{ background: '#F9F9FC', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: gray, fontWeight: 600, marginBottom: 4 }}>CONVERSÃO</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: fashionGold.conversion != null ? (fashionGold.conversion >= 10 ? green : accent) : '#2D1B2E' }}>
                  {fashionGold.conversion != null ? `${fashionGold.conversion}%` : '—'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <Link href="/quiz/fashion-gold" style={{ flex: 1, textAlign: 'center', background: '#8a6d2f', color: '#fff', padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                Ver métricas completas →
              </Link>
              <Link href="/quiz/configuracoes" style={{ background: '#F5F5F7', color: '#2D1B2E', padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                📸
              </Link>
            </div>
          </div>
        </div>

        {/* Plano Capilar */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(135deg, #8B3A6E 0%, #C4607A 100%)', padding: '24px 28px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: 1, textTransform: 'uppercase' }}>Quiz Principal</div>
              <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '2px 10px', borderRadius: 20 }}>Ativo</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 2 }}>Plano Capilar</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>Quiz de 32 perguntas para venda do app</div>
          </div>

          <div style={{ padding: '20px 28px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div style={{ background: '#F9F9FC', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: gray, fontWeight: 600, marginBottom: 4 }}>CLIQUES TOTAL</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#2D1B2E' }}>{planoCapilar.views.toLocaleString('pt-BR')}</div>
              </div>
              <div style={{ background: '#F9F9FC', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: gray, fontWeight: 600, marginBottom: 4 }}>HOJE</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: planoCapilar.todayViews > 0 ? green : '#2D1B2E' }}>{planoCapilar.todayViews}</div>
              </div>
              <div style={{ background: '#F9F9FC', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: gray, fontWeight: 600, marginBottom: 4 }}>ASSINANTES</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: blue }}>{planoCapilar.profiles.toLocaleString('pt-BR')}</div>
              </div>
              <div style={{ background: '#F9F9FC', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: gray, fontWeight: 600, marginBottom: 4 }}>CONVERSÃO</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#2D1B2E' }}>
                  {planoCapilar.views > 0 ? `${Math.round((planoCapilar.profiles / planoCapilar.views) * 100)}%` : '—'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <Link href="/quiz/plano-capilar" style={{ flex: 1, textAlign: 'center', background: accent, color: '#fff', padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                Ver métricas completas →
              </Link>
              <a href="https://planodaju.julianecost.com/quiz" target="_blank" rel="noopener noreferrer" style={{ background: '#F5F5F7', color: '#2D1B2E', padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                ↗
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Info */}
      <div style={{ marginTop: 28, padding: '18px 24px', background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div style={{ fontSize: 22 }}>💡</div>
        <div style={{ fontSize: 13, color: gray, lineHeight: 1.6 }}>
          <strong style={{ color: '#2D1B2E' }}>Cliques</strong> = visitas ao quiz (rastreadas automaticamente).{' '}
          <strong style={{ color: '#2D1B2E' }}>Conversão</strong> = leads gerados / cliques totais.
          Os analytics de perguntas do Plano Capilar começam a aparecer assim que usuárias respondem o quiz.
        </div>
      </div>
    </div>
  )
}
