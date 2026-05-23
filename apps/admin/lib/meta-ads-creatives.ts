/**
 * Meta Marketing API — Análise de Criativos (nível de anúncio).
 *
 * Busca insights por ANÚNCIO + thumbnail do criativo, e calcula métricas de
 * performance por criativo: investimento, CPM, CTR, hook rate, compras,
 * custo/compra, ROAS.
 *
 * Reaproveita o token/conta da lib meta-ads-quiz.
 */

const TOKEN      = process.env.META_ADS_QUIZ_TOKEN
const ACCOUNT_ID = process.env.META_ADS_QUIZ_ACCOUNT ?? 'act_306090736984417'
const API_VER    = 'v20.0'
const BASE       = `https://graph.facebook.com/${API_VER}`

export type CreativesStatus = 'ok' | 'not_configured' | 'error'
export type CreativePeriod  = '7d' | '30d' | '90d'
export type CampaignType    = 'compras' | 'leads' | 'outros'

export interface CreativeRow {
  ad_id:         string
  ad_name:       string
  campaign_name: string
  adset_name:    string
  campaign_type: CampaignType
  thumbnail_url: string | null
  instagram_url: string | null
  spend:         number
  impressions:   number
  link_clicks:   number
  landing_page_views: number
  cpm:           number | null
  ctr:           number | null
  hook_rate:     number | null   // % (3s video views / impressions)
  cost_per_link_click: number | null  // relevante p/ campanhas de lead
  purchases:     number
  revenue:       number
  cost_per_purchase: number | null
  roas:          number | null
}

/**
 * Classifica o criativo pelo nome da campanha:
 *  - "plano"  → Compras (venda do plano capilar)
 *  - "grupos" → Leads (cadastro nos grupos Ybera)
 *  - senão    → Outros
 */
function classifyCampaign(name: string): CampaignType {
  const n = (name ?? '').toLowerCase()
  if (n.includes('plano'))  return 'compras'
  if (n.includes('grupos')) return 'leads'
  return 'outros'
}

export interface CreativesResult {
  status:         CreativesStatus
  error?:         string
  period:         CreativePeriod
  totalSpend:     number
  totalPurchases: number
  totalRevenue:   number
  bestCpp:        number | null
  activeCount:    number   // criativos com investimento no período
  creatives:      CreativeRow[]
}

const DATE_PRESET: Record<CreativePeriod, string> = {
  '7d':  'last_7d',
  '30d': 'last_30d',
  '90d': 'last_90d',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function actionValue(actions: any, types: string[]): number {
  if (!Array.isArray(actions)) return 0
  let total = 0
  for (const t of types) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const found = actions.find((a: any) => a.action_type === t)
    if (found) total += parseFloat(found.value ?? '0')
  }
  return total
}

const PURCHASE_TYPES = [
  'purchase',
  'offsite_conversion.fb_pixel_purchase',
  'onsite_web_purchase',
  'web_in_store_purchase',
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function metaGet(path: string, params: Record<string, string>, revalidate = 1800): Promise<any> {
  const qs = new URLSearchParams({ ...params, access_token: TOKEN! })
  const res = await fetch(`${BASE}/${path}?${qs}`, { next: { revalidate } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`)
  }
  return res.json()
}

/**
 * Busca os thumbnails/links dos criativos de uma lista de ad_ids.
 * Retorna um mapa ad_id → { thumbnail_url, instagram_url }.
 */
async function fetchCreatives(adIds: string[]): Promise<Record<string, { thumbnail_url: string | null; instagram_url: string | null }>> {
  const map: Record<string, { thumbnail_url: string | null; instagram_url: string | null }> = {}
  if (adIds.length === 0) return map

  // Busca em lotes de 50 ad_ids via o endpoint /ads da conta filtrando por id
  // (a API limita o filter; usamos paginação simples por chunk).
  const chunks: string[][] = []
  for (let i = 0; i < adIds.length; i += 50) chunks.push(adIds.slice(i, i + 50))

  await Promise.all(chunks.map(async chunk => {
    try {
      const filtering = JSON.stringify([{ field: 'id', operator: 'IN', value: chunk }])
      const json = await metaGet(`${ACCOUNT_ID}/ads`, {
        fields: 'id,creative{thumbnail_url,image_url,instagram_permalink_url}',
        filtering,
        limit: '50',
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const ad of (json.data ?? []) as any[]) {
        const c = ad.creative ?? {}
        map[ad.id] = {
          thumbnail_url: c.thumbnail_url ?? c.image_url ?? null,
          instagram_url: c.instagram_permalink_url ?? null,
        }
      }
    } catch (e) {
      console.error('[meta-creatives] fetchCreatives chunk', e instanceof Error ? e.message : e)
    }
  }))

  return map
}

export async function getCreativeAnalysis(period: CreativePeriod = '30d'): Promise<CreativesResult> {
  const empty: CreativesResult = {
    status: 'not_configured', period, totalSpend: 0, totalPurchases: 0,
    totalRevenue: 0, bestCpp: null, activeCount: 0, creatives: [],
  }
  if (!TOKEN) return empty

  try {
    // video_3_sec_watched_actions foi descontinuado na v20. As views de 3s
    // vêm no array `actions` (action_type='video_view').
    const fields = [
      'ad_id', 'ad_name', 'campaign_name', 'adset_name',
      'spend', 'impressions', 'inline_link_clicks', 'cpm', 'ctr',
      'actions', 'action_values',
    ].join(',')

    const json = await metaGet(`${ACCOUNT_ID}/insights`, {
      level: 'ad',
      fields,
      date_preset: DATE_PRESET[period],
      limit: '300',
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (json.data ?? []) as any[]

    // Monta as linhas com métricas calculadas
    const partial: Omit<CreativeRow, 'thumbnail_url' | 'instagram_url'>[] = rows.map(r => {
      const spend       = parseFloat(r.spend ?? '0')
      const impressions = parseInt(r.impressions ?? '0', 10)
      const link_clicks = parseInt(r.inline_link_clicks ?? '0', 10)
      const cpm         = r.cpm ? parseFloat(r.cpm) : null
      const ctr         = r.ctr ? parseFloat(r.ctr) : null
      const video3s     = actionValue(r.actions, ['video_view'])
      const hook_rate   = impressions > 0 && video3s > 0 ? (video3s / impressions) * 100 : null
      const landing_page_views = actionValue(r.actions, ['landing_page_view'])
      const cost_per_link_click = link_clicks > 0 ? spend / link_clicks : null
      const purchases   = actionValue(r.actions, PURCHASE_TYPES)
      const revenue     = actionValue(r.action_values, PURCHASE_TYPES)
      const cost_per_purchase = purchases > 0 ? spend / purchases : null
      const roas        = spend > 0 && revenue > 0 ? revenue / spend : null
      return {
        ad_id: r.ad_id, ad_name: r.ad_name ?? '(sem nome)',
        campaign_name: r.campaign_name ?? '', adset_name: r.adset_name ?? '',
        campaign_type: classifyCampaign(r.campaign_name),
        spend, impressions, link_clicks, landing_page_views, cpm, ctr, hook_rate,
        cost_per_link_click, purchases, revenue, cost_per_purchase, roas,
      }
    }).filter(r => r.spend > 0) // só criativos com investimento no período

    // Busca thumbnails
    const creativeMap = await fetchCreatives(partial.map(p => p.ad_id))

    const creatives: CreativeRow[] = partial.map(p => ({
      ...p,
      thumbnail_url: creativeMap[p.ad_id]?.thumbnail_url ?? null,
      instagram_url: creativeMap[p.ad_id]?.instagram_url ?? null,
    }))

    // Agregados
    const totalSpend     = creatives.reduce((s, c) => s + c.spend, 0)
    const totalPurchases = creatives.reduce((s, c) => s + c.purchases, 0)
    const totalRevenue   = creatives.reduce((s, c) => s + c.revenue, 0)
    const cpps           = creatives.map(c => c.cost_per_purchase).filter((v): v is number => v !== null)
    const bestCpp        = cpps.length > 0 ? Math.min(...cpps) : null

    return {
      status: 'ok', period,
      totalSpend, totalPurchases, totalRevenue, bestCpp,
      activeCount: creatives.length,
      creatives,
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    console.error('[meta-ads-creatives]', e?.message)
    return { ...empty, status: 'error', error: e?.message }
  }
}
