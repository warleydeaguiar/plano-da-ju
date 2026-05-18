/**
 * Meta Marketing API — Plano da Ju (Quiz Capilar)
 *
 * Busca investimento e resultados das campanhas do quiz capilar.
 * Conta: DIN - decisões inteligentes (act_306090736984417)
 *
 * Setup:
 *  1. business.facebook.com → Configurações do negócio → Usuários do sistema
 *  2. Criar usuário de sistema ou usar existente → Gerar token
 *  3. Permissões necessárias: ads_read, read_insights
 *  4. Atribuir a conta act_306090736984417 ao usuário
 *  5. Adicionar nas env vars do Vercel:
 *       META_ADS_QUIZ_TOKEN   = token gerado
 *       META_ADS_QUIZ_ACCOUNT = act_306090736984417
 */

const TOKEN      = process.env.META_ADS_QUIZ_TOKEN
const ACCOUNT_ID = process.env.META_ADS_QUIZ_ACCOUNT ?? 'act_306090736984417'
const API_VER    = 'v20.0'
const BASE       = `https://graph.facebook.com/${API_VER}`

export type QuizAdsStatus = 'ok' | 'not_configured' | 'error'

export interface CampaignInsight {
  campaign_id:   string
  campaign_name: string
  spend:         number
  impressions:   number
  clicks:        number
  reach:         number
  cpc:           number | null
  cpm:           number | null
  ctr:           number | null
}

export interface QuizAdsResult {
  status:      QuizAdsStatus
  error?:      string
  totalSpend:  number
  campaigns:   CampaignInsight[]
  // Resumo por período
  today:       number
  yesterday:   number
  thisMonth:   number
  lastMonth:   number
  // Últimos 7 dias por dia (para gráfico)
  daily:       Array<{ date: string; spend: number; label: string }>
}

const EMPTY: QuizAdsResult = {
  status: 'not_configured',
  totalSpend: 0, campaigns: [],
  today: 0, yesterday: 0, thisMonth: 0, lastMonth: 0,
  daily: [],
}

// ─── Helpers ──────────────────────────────────────────────────────
function toDate(d: Date) {
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

async function fetchInsights(
  params: Record<string, string>,
  revalidate = 1800
): Promise<any[]> {
  const qs = new URLSearchParams({ ...params, access_token: TOKEN!, limit: '200' })
  const res = await fetch(`${BASE}/${ACCOUNT_ID}/insights?${qs}`, {
    next: { revalidate },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`)
  }
  const json = await res.json()
  return json.data ?? []
}

function sumSpend(rows: any[]): number {
  return rows.reduce((s, r) => s + parseFloat(r.spend ?? '0'), 0)
}

// ─── Main export ──────────────────────────────────────────────────
export async function getQuizAdSpend(): Promise<QuizAdsResult> {
  if (!TOKEN) return EMPTY

  try {
    const now       = new Date()
    const todayStr  = toDate(now)
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1)
    const yestStr   = toDate(yesterday)

    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const lastMonthD = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthStart = toDate(lastMonthD)
    const lastMonthEnd   = toDate(new Date(now.getFullYear(), now.getMonth(), 0))

    const fields = 'campaign_id,campaign_name,spend,impressions,clicks,reach,cpc,cpm,ctr'

    // Buscar tudo em paralelo
    const [todayRows, yestRows, monthRows, lastMonthRows, last7Rows] = await Promise.all([
      fetchInsights({ level: 'campaign', fields, time_range: JSON.stringify({ since: todayStr,      until: todayStr      }) }),
      fetchInsights({ level: 'campaign', fields, time_range: JSON.stringify({ since: yestStr,       until: yestStr       }) }),
      fetchInsights({ level: 'campaign', fields, time_range: JSON.stringify({ since: monthStart,    until: todayStr      }) }),
      fetchInsights({ level: 'campaign', fields, time_range: JSON.stringify({ since: lastMonthStart, until: lastMonthEnd }) }),
      fetchInsights({ level: 'campaign', fields: 'campaign_id,campaign_name,spend', date_preset: 'last_7d', time_increment: '1' }, 900),
    ])

    // Campanhas deste mês ordenadas por gasto
    const campaigns: CampaignInsight[] = monthRows
      .map((r: any) => ({
        campaign_id:   r.campaign_id,
        campaign_name: r.campaign_name,
        spend:         parseFloat(r.spend   ?? '0'),
        impressions:   parseInt(r.impressions ?? '0', 10),
        clicks:        parseInt(r.clicks    ?? '0', 10),
        reach:         parseInt(r.reach     ?? '0', 10),
        cpc:           r.cpc  ? parseFloat(r.cpc)  : null,
        cpm:           r.cpm  ? parseFloat(r.cpm)  : null,
        ctr:           r.ctr  ? parseFloat(r.ctr)  : null,
      }))
      .sort((a, b) => b.spend - a.spend)

    // Gasto diário últimos 7 dias
    const dailyMap: Record<string, number> = {}
    for (const row of last7Rows) {
      const date: string = row.date_start ?? ''
      dailyMap[date] = (dailyMap[date] ?? 0) + parseFloat(row.spend ?? '0')
    }
    const daily = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, spend]) => {
        const d = new Date(date + 'T12:00:00')
        return {
          date,
          spend,
          label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        }
      })

    return {
      status:     'ok',
      totalSpend: sumSpend(monthRows),
      campaigns,
      today:      sumSpend(todayRows),
      yesterday:  sumSpend(yestRows),
      thisMonth:  sumSpend(monthRows),
      lastMonth:  sumSpend(lastMonthRows),
      daily,
    }
  } catch (e: any) {
    console.error('[meta-ads-quiz]', e?.message)
    return { ...EMPTY, status: 'error', error: e?.message }
  }
}
