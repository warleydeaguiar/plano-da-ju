/**
 * Meta Marketing API — Ybera
 *
 * Busca o investimento em anúncios do Meta Ads para campanhas com
 * "Grupo" no nome (grupos de promoção Ybera afiliados).
 *
 * Setup:
 *  1. Business Manager → Configurações → Usuários do Sistema → criar usuário
 *  2. Gerar token permanente com permissão ads_read
 *  3. Preencher META_ADS_ACCESS_TOKEN e META_ADS_ACCOUNT_ID nas env vars
 *
 * Documentação: https://developers.facebook.com/docs/marketing-apis
 */

import { META_TAX_RATE } from './meta-ads-quiz'

// Usa o mesmo token/conta que o resto do sistema (META_ADS_QUIZ_*), com
// fallback pros nomes antigos. Antes só lia META_ADS_ACCESS_TOKEN (nunca setado)
// → a página Ybera mostrava "não configurado" mesmo com o Meta funcionando.
const TOKEN      = process.env.META_ADS_QUIZ_TOKEN ?? process.env.META_ADS_ACCESS_TOKEN
const ACCOUNT_ID = process.env.META_ADS_QUIZ_ACCOUNT ?? process.env.META_ADS_ACCOUNT_ID ?? 'act_306090736984417'
const API_VER    = 'v20.0'
const BASE       = `https://graph.facebook.com/${API_VER}`

/**
 * Campanha conta como "grupos de promoção"? Filtramos NO CÓDIGO (case-insensitive,
 * pega "Grupo" e "Grupos") em vez de depender do filtro `campaign.name CONTAIN` da
 * API da Meta — que às vezes não retorna nada e zerava o investimento no painel.
 */
function isGrupoCampaign(name: string | null | undefined): boolean {
  return /grupo/i.test(String(name ?? ''))
}

export type MetaAdsStatus = 'ok' | 'not_configured' | 'error'

export interface MetaCampaignSpend {
  campaign_id:   string
  campaign_name: string
  spend:         number
}

export interface MetaAdsResult {
  status:      MetaAdsStatus
  error?:      string
  totalSpend:  number
  campaigns:   MetaCampaignSpend[]
  /** Gastos mês-a-mês dos últimos 6 meses (para gráfico) */
  monthly:     Array<{ month: string; spend: number }>
}

/** Retorna gasto com campanhas "Grupo" no mês especificado */
export async function getGrupoAdSpend(
  datePreset: 'this_month' | 'last_month' = 'this_month'
): Promise<MetaAdsResult> {
  if (!TOKEN || !ACCOUNT_ID) {
    return { status: 'not_configured', totalSpend: 0, campaigns: [], monthly: [] }
  }

  try {
    // 1. Buscar insights no nível de campanha
    const params = new URLSearchParams({
      level:       'campaign',
      fields:      'campaign_id,campaign_name,spend',
      date_preset: datePreset,
      access_token: TOKEN,
      limit:        '500',
    })

    const res  = await fetch(`${BASE}/${ACCOUNT_ID}/insights?${params}`, {
      next: { revalidate: 1800 }, // cache 30min
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return {
        status:     'error',
        error:      err?.error?.message ?? `HTTP ${res.status}`,
        totalSpend: 0,
        campaigns:  [],
        monthly:    [],
      }
    }

    const json = await res.json()
    const data: MetaCampaignSpend[] = (json.data ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((d: any) => isGrupoCampaign(d.campaign_name))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((d: any) => ({
        campaign_id:   d.campaign_id,
        campaign_name: d.campaign_name,
        spend:         parseFloat(d.spend ?? '0') * (1 + META_TAX_RATE),  // inclui imposto Meta BR
      }))

    const totalSpend = data.reduce((s, c) => s + c.spend, 0)

    // 2. Buscar os últimos 6 meses para gráfico histórico
    const monthly = await getMonthlySpend()

    return { status: 'ok', totalSpend, campaigns: data, monthly }
  } catch (e: any) {
    return {
      status:     'error',
      error:      e?.message ?? 'Erro desconhecido',
      totalSpend: 0,
      campaigns:  [],
      monthly:    [],
    }
  }
}

/** Retorna gasto por mês dos últimos 6 meses */
async function getMonthlySpend(): Promise<Array<{ month: string; spend: number }>> {
  if (!TOKEN || !ACCOUNT_ID) return []

  const results: Array<{ month: string; spend: number }> = []
  const now = new Date()

  await Promise.allSettled(
    Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const since = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
      const untilD = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      const until  = `${untilD.getFullYear()}-${String(untilD.getMonth() + 1).padStart(2, '0')}-${String(untilD.getDate()).padStart(2, '0')}`
      const label  = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })

      const params = new URLSearchParams({
        level:       'campaign',
        fields:      'campaign_name,spend',
        time_range:  JSON.stringify({ since, until }),
        access_token: TOKEN!,
        limit:        '500',
      })

      return fetch(`${BASE}/${ACCOUNT_ID}/insights?${params}`, { next: { revalidate: 3600 } })
        .then(r => r.json())
        .then(json => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const spend = (1 + META_TAX_RATE) * (json.data ?? [])
            .filter((d: any) => isGrupoCampaign(d.campaign_name))
            .reduce((s: number, d: any) => s + parseFloat(d.spend ?? '0'), 0)
          results.push({ month: label, spend })
        })
        .catch(() => results.push({ month: label, spend: 0 }))
    })
  )

  return results.sort((a, b) => {
    // meses mais antigos primeiro
    const ai = results.indexOf(a), bi = results.indexOf(b)
    return ai - bi
  }).reverse()
}
