'use client'

import Link from 'next/link'

const accent = '#C4607A'
const green  = '#34C759'
const blue   = '#007AFF'
const gray   = '#8A8A8E'
const red    = '#FF3B30'

// Paleta de cores para as barras das perguntas
const BAR_COLORS = ['#C4607A', '#8B3A6E', '#E1306C', '#6366F1', '#4285F4', '#34C759', '#FF9500', '#c9a45c']

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: 12, color: gray, fontWeight: 600, marginBottom: 8, letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color ?? '#2D1B2E', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: gray, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function ViewsChart({ series }: { series: { label: string; views: number }[] }) {
  const max = Math.max(...series.map(d => d.views), 1)
  const labelIndexes = new Set([0, Math.floor(series.length / 2), series.length - 1])
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 72 }}>
        {series.map((d, i) => {
          const h = Math.max(Math.round((d.views / max) * 68), d.views > 0 ? 3 : 0)
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
              <div title={`${d.label}: ${d.views}`} style={{ width: '100%', height: h, background: accent, borderRadius: '2px 2px 0 0', opacity: 0.8 }} />
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', marginTop: 4 }}>
        {series.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            {labelIndexes.has(i) && <div style={{ fontSize: 9, color: gray }}>{d.label}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

function QuestionCard({ qa }: { qa: any }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#2D1B2E', flex: 1, paddingRight: 12 }}>{qa.question}</div>
        <span style={{ fontSize: 12, color: gray, whiteSpace: 'nowrap', background: '#F5F5F7', padding: '3px 10px', borderRadius: 20, flexShrink: 0 }}>
          {qa.total.toLocaleString('pt-BR')} resp.
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {qa.options.map((opt: any, i: number) => {
          const color = BAR_COLORS[i % BAR_COLORS.length]
          return (
            <div key={opt.value}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 13, color: '#2D1B2E', fontWeight: opt.pct >= 30 ? 700 : 500 }}>{opt.label}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: gray }}>{opt.count}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color, minWidth: 36, textAlign: 'right' }}>{opt.pct}%</span>
                </div>
              </div>
              <div style={{ height: 6, background: '#F0F0F5', borderRadius: 3 }}>
                <div style={{ height: '100%', borderRadius: 3, width: `${opt.pct}%`, background: color, transition: 'width 0.6s ease' }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function PlanoCapilarClient({ data }: { data: any }) {
  const { kpis, dailySeries, questionAnalytics } = data

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Link href="/quiz" style={{ fontSize: 13, color: gray, textDecoration: 'none' }}>Quiz</Link>
            <span style={{ color: gray }}>›</span>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#2D1B2E' }}>Plano Capilar</div>
          </div>
          <div style={{ fontSize: 13, color: gray }}>Quiz de 32 perguntas para venda do app</div>
        </div>
        <a href="https://planodaju.julianecost.com/quiz" target="_blank" rel="noopener noreferrer"
          style={{ background: accent, color: '#fff', padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
          Ver quiz ↗
        </a>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="CLIQUES TOTAL" value={kpis.views.toLocaleString('pt-BR')} sub="visitas ao quiz" />
        <StatCard label="HOJE" value={kpis.today} sub="desde meia-noite" color={kpis.today > 0 ? green : '#2D1B2E'} />
        <StatCard label="ÚLTIMOS 30 DIAS" value={kpis.viewsMonth.toLocaleString('pt-BR')} sub="cliques no período" />
        <StatCard label="ASSINANTES" value={kpis.profiles.toLocaleString('pt-BR')} sub="clientes ativos" color={blue} />
        <StatCard
          label="TAXA DE CONVERSÃO"
          value={kpis.conversion != null ? `${kpis.conversion}%` : '—'}
          sub="assinantes / cliques"
          color={kpis.conversion != null ? (kpis.conversion >= 5 ? green : kpis.conversion >= 2 ? accent : red) : '#2D1B2E'}
        />
      </div>

      {/* Gráfico de views */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 24px', marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#2D1B2E' }}>📈 Cliques por dia</div>
          <div style={{ fontSize: 12, color: gray }}>Últimos 30 dias</div>
        </div>
        <ViewsChart series={dailySeries} />
        <div style={{ marginTop: 12, display: 'flex', gap: 20 }}>
          <div style={{ fontSize: 12, color: gray }}>
            Total: <strong style={{ color: '#2D1B2E' }}>{dailySeries.reduce((s: number, d: any) => s + d.views, 0)}</strong>
          </div>
          <div style={{ fontSize: 12, color: gray }}>
            Média/dia: <strong style={{ color: '#2D1B2E' }}>{(dailySeries.reduce((s: number, d: any) => s + d.views, 0) / 30).toFixed(1)}</strong>
          </div>
        </div>
      </div>

      {/* Analytics das perguntas */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#2D1B2E' }}>📊 Análise das respostas</div>
        {questionAnalytics.length === 0 && (
          <span style={{ fontSize: 12, color: gray }}>Os dados aparecem conforme as usuárias respondem o quiz</span>
        )}
      </div>

      {questionAnalytics.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#2D1B2E', marginBottom: 8 }}>Ainda sem dados de respostas</div>
          <div style={{ fontSize: 13, color: gray, lineHeight: 1.6, maxWidth: 400, margin: '0 auto' }}>
            Quando as usuárias começarem a responder o quiz, os percentuais de cada pergunta aparecerão aqui automaticamente.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          {questionAnalytics.map((qa: any) => (
            <QuestionCard key={qa.questionId} qa={qa} />
          ))}
        </div>
      )}
    </div>
  )
}
