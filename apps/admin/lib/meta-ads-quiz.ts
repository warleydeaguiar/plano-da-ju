/**
 * Meta Marketing API — Plano da Ju
 *
 * Busca investimento das campanhas do Plano Capilar.
 * Conta: DIN - decisões inteligentes (act_306090736984417)
 *
 * Particiona as campanhas em 2 grupos de operação separados:
 *   - PLANO    : campaign_name contém "plano"   → venda do plano capilar
 *   - GRUPOS   : campaign_name contém "grupos"  → cadastro nos grupos Ybera
 *
 * Cada grupo tem seu próprio ROAS / custo por aquisição.
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
export type CampaignType  = 'plano' | 'grupos' | 'outros'

export interface CampaignInsight {
  campaign_id:   string
  campaign_name: string
  type:          CampaignType
  spend:         number
  impressions:   number
  clicks:           number  // todos cliques (CTA + like + share + perfil etc.) — só pra ref.
  link_clicks:      number  // inline_link_clicks — só cliques no link (saída pra LP)
  landing_page_views: number  // action_type=landing_page_view
  reach:         number
  cpc:           number | null
  cpm:           number | null
  ctr:           number | null
}

export interface FunnelTotals {
  link_clicks:        number  // inline_link_clicks (alinhado com "Cliques no link" do Meta UI)
  landing_page_views: number  // landing_page_view
}

export interface AdGroupResult {
  today:      number
  yesterday:  number
  thisMonth:  number
  lastMonth:  number
  campaigns:  CampaignInsight[]
  daily:      Array<{ date: string; spend: number; label: string }>
  // Totais de funil top-of-funnel — relevantes pra cruzar com nosso quiz
  funnelToday:     FunnelTotals
  funnelYesterday: FunnelTotals
  funnelMonth:     FunnelTotals
}

export interface QuizAdsResult {
  status: QuizAdsStatus
  error?: string
  plano:  AdGroupResult
  grupos: AdGroupResult
  outros: AdGroupResult  // campanhas que não batem nenhum dos dois
}

const EMPTY_FUNNEL: FunnelTotals = { link_clicks: 0, landing_page_views: 0 }

const EMPTY_GROUP: AdGroupResult = {
  today: 0, yesterday: 0, thisMonth: 0, lastMonth: 0,
  campaigns: [], daily: [],
  funnelToday:     { ...EMPTY_FUNNEL },
  funnelYesterday: { ...EMPTY_FUNNEL },
  funnelMonth:     { ...EMPTY_FUNNEL },
}

const EMPTY: QuizAdsResult = {
  status: 'not_configured',
  plano:  { ...EMPTY_GROUP },
  grupos: { ...EMPTY_GROUP },
  outros: { ...EMPTY_GROUP },
}

// ─── Helpers ──────────────────────────────────────────────────────
function toDate(d: Date) {
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

/**
 * Classifica uma campanha pelo nome.
 * - "plano" no nome → plano capilar
 * - "grupo"/"grupos" no nome → grupos Ybera (singular OU plural)
 * - senão → outros (ignorado nos cards principais)
 */
function classifyCampaign(name: string): CampaignType {
  const n = (name ?? '').toLowerCase()
  if (n.includes('plano'))  return 'plano'
  if (n.includes('grupo'))  return 'grupos'   // pega "Grupo Fashion Gold" e "Grupos ..."
  return 'outros'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchInsights(params: Record<string, string>, revalidate = 1800): Promise<any[]> {
  const qs = new URLSearchParams({ ...params, access_token: TOKEN!, limit: '200' })
  const res = await fetch(`${BASE}/${ACCOUNT_ID}/insights?${qs}`, { next: { revalidate } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`)
  }
  const json = await res.json()
  return json.data ?? []
}

/**
 * Cliques no link (inline_link_clicks) das campanhas do PLANO, por dia, no
 * intervalo [since, until] (YYYY-MM-DD). Usado no gráfico de conversão.
 * Retorna { 'YYYY-MM-DD': cliques }. Vazio se a Meta não estiver configurada.
 */
export async function getPlanoClicksDaily(since: string, until: string): Promise<Record<string, number>> {
  if (!TOKEN) return {}
  try {
    const rows = await fetchInsights({
      level: 'campaign',
      fields: 'campaign_name,inline_link_clicks',
      time_range: JSON.stringify({ since, until }),
      time_increment: '1',
    }, 1800)
    const byDay: Record<string, number> = {}
    for (const r of rows) {
      if (classifyCampaign(r.campaign_name) !== 'plano') continue
      const d: string = r.date_start ?? ''
      if (!d) continue
      byDay[d] = (byDay[d] ?? 0) + parseInt(r.inline_link_clicks ?? '0', 10)
    }
    return byDay
  } catch {
    return {}
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sumSpendOfType(rows: any[], type: CampaignType): number {
  return rows.reduce((s, r) => {
    if (classifyCampaign(r.campaign_name) !== type) return s
    return s + parseFloat(r.spend ?? '0')
  }, 0)
}

/** Extrai uma action específica do array `actions` retornado pela API. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function actionValue(actions: any, actionType: string): number {
  if (!Array.isArray(actions)) return 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const found = actions.find((a: any) => a.action_type === actionType)
  return found ? parseInt(found.value ?? '0', 10) : 0
}

/** Soma cliques no link (inline_link_clicks) de campanhas do tipo dado. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sumLinkClicksOfType(rows: any[], type: CampaignType): number {
  return rows.reduce((s, r) => {
    if (classifyCampaign(r.campaign_name) !== type) return s
    return s + parseInt(r.inline_link_clicks ?? '0', 10)
  }, 0)
}

/** Soma landing_page_view de campanhas do tipo dado. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sumLandingPageViewsOfType(rows: any[], type: CampaignType): number {
  return rows.reduce((s, r) => {
    if (classifyCampaign(r.campaign_name) !== type) return s
    return s + actionValue(r.actions, 'landing_page_view')
  }, 0)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// Imposto da Meta sobre anúncios no Brasil (CIDE/PIS/COFINS/ISS ≈ 13,68%).
// O `spend` da API da Meta vem SEM imposto — o custo REAL é spend × (1 + imposto).
// Aplicado em TODO spend (totais, diário, campanhas) pra refletir em investimento,
// ROAS, CPA e lucro. Editável por env caso a alíquota mude.
export const META_TAX_RATE = Number(process.env.META_ADS_TAX_RATE ?? '0.1368');
const withTax = (n: number) => n * (1 + META_TAX_RATE);

function dailyOfType(rows: any[], type: CampaignType): Array<{ date: string; spend: number; label: string }> {
  const dailyMap: Record<string, number> = {}
  for (const row of rows) {
    if (classifyCampaign(row.campaign_name) !== type) continue
    const date: string = row.date_start ?? ''
    if (!date) continue
    dailyMap[date] = (dailyMap[date] ?? 0) + parseFloat(row.spend ?? '0')
  }
  return Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, spend]) => {
      const d = new Date(date + 'T12:00:00')
      return {
        date, spend: withTax(spend),
        label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      }
    })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildGroup(
  monthRows: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  todayRows: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yestRows: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lastMonthRows: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  last7Rows: any[],
  type: CampaignType,
): AdGroupResult {
  const campaigns: CampaignInsight[] = monthRows
    .filter(r => classifyCampaign(r.campaign_name) === type)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r: any) => ({
      campaign_id:   r.campaign_id,
      campaign_name: r.campaign_name,
      type,
      spend:         withTax(parseFloat(r.spend ?? '0')),
      impressions:   parseInt(r.impressions ?? '0', 10),
      clicks:        parseInt(r.clicks ?? '0', 10),
      link_clicks:   parseInt(r.inline_link_clicks ?? '0', 10),
      landing_page_views: actionValue(r.actions, 'landing_page_view'),
      reach:         parseInt(r.reach ?? '0', 10),
      cpc:           r.cpc ? parseFloat(r.cpc) : null,
      cpm:           r.cpm ? parseFloat(r.cpm) : null,
      ctr:           r.ctr ? parseFloat(r.ctr) : null,
    }))
    .sort((a, b) => b.spend - a.spend)

  return {
    today:     withTax(sumSpendOfType(todayRows, type)),
    yesterday: withTax(sumSpendOfType(yestRows, type)),
    thisMonth: withTax(sumSpendOfType(monthRows, type)),
    lastMonth: withTax(sumSpendOfType(lastMonthRows, type)),
    campaigns,
    daily:     dailyOfType(last7Rows, type),
    funnelToday:     {
      link_clicks:        sumLinkClicksOfType(todayRows, type),
      landing_page_views: sumLandingPageViewsOfType(todayRows, type),
    },
    funnelYesterday: {
      link_clicks:        sumLinkClicksOfType(yestRows, type),
      landing_page_views: sumLandingPageViewsOfType(yestRows, type),
    },
    funnelMonth: {
      link_clicks:        sumLinkClicksOfType(monthRows, type),
      landing_page_views: sumLandingPageViewsOfType(monthRows, type),
    },
  }
}

// ─── Main export ──────────────────────────────────────────────────
export async function getQuizAdSpend(): Promise<QuizAdsResult> {
  if (!TOKEN) return EMPTY

  try {
    // Datas em horário de Brasília — antes usavam UTC (servidor Vercel), e
    // entre 21h-00h BR a query Meta pedia "amanhã" e "hoje" sumia.
    const BR_OFFSET = 3 * 60 * 60 * 1000
    const nowBR     = new Date(Date.now() - BR_OFFSET)
    const todayStr  = toDate(nowBR)
    const yesterday = new Date(nowBR.getTime() - 86400000)
    const yestStr   = toDate(yesterday)

    const yyyy = nowBR.getUTCFullYear()
    const mm   = String(nowBR.getUTCMonth() + 1).padStart(2, '0')
    const monthStart     = `${yyyy}-${mm}-01`
    const lastMonthD     = new Date(Date.UTC(yyyy, nowBR.getUTCMonth() - 1, 1))
    const lastMonthStart = toDate(lastMonthD)
    const lastMonthEnd   = toDate(new Date(Date.UTC(yyyy, nowBR.getUTCMonth(), 0)))

    const fields = 'campaign_id,campaign_name,spend,impressions,clicks,inline_link_clicks,reach,cpc,cpm,ctr,actions'

    // Buscar tudo em paralelo
    const [todayRows, yestRows, monthRows, lastMonthRows, last7Rows] = await Promise.all([
      fetchInsights({ level: 'campaign', fields, time_range: JSON.stringify({ since: todayStr,       until: todayStr      }) }),
      fetchInsights({ level: 'campaign', fields, time_range: JSON.stringify({ since: yestStr,        until: yestStr       }) }),
      fetchInsights({ level: 'campaign', fields, time_range: JSON.stringify({ since: monthStart,     until: todayStr      }) }),
      fetchInsights({ level: 'campaign', fields, time_range: JSON.stringify({ since: lastMonthStart, until: lastMonthEnd }) }),
      fetchInsights({ level: 'campaign', fields: 'campaign_id,campaign_name,spend', date_preset: 'last_7d', time_increment: '1' }, 900),
    ])

    return {
      status: 'ok',
      plano:  buildGroup(monthRows, todayRows, yestRows, lastMonthRows, last7Rows, 'plano'),
      grupos: buildGroup(monthRows, todayRows, yestRows, lastMonthRows, last7Rows, 'grupos'),
      outros: buildGroup(monthRows, todayRows, yestRows, lastMonthRows, last7Rows, 'outros'),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    console.error('[meta-ads-quiz]', e?.message)
    return { ...EMPTY, status: 'error', error: e?.message }
  }
}
