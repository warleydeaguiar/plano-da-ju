import { createAdminClient } from '@/lib/supabase'
import { getPlanoDaily } from '@/lib/meta-ads-quiz'
import Sidebar from '../../components/Sidebar'
import { T, fonts } from '../../theme'
import ConversaoClient from './ConversaoClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Conversão — Admin Plano da Ju' }

const SINCE = '2026-05-01' // início do plano capilar

export default async function ConversaoPage() {
  const untilBR = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10)

  // 1) Cliques no link das campanhas de PLANO, por dia (+ os ids das campanhas,
  //    que é como o funil marca o lead em utm_campaign).
  const { byDay: clicksByDay, campanhas } = await getPlanoDaily(SINCE, untilBR)
  const idsPlano = campanhas.map(c => c.id)

  // 2) Vendas por dia já classificadas pela campanha que trouxe o lead.
  //    Mesma regra de venda do dashboard: 1 cliente por dia, menor valor do
  //    grupo (o webhook grava order.paid + charge.paid; o menor é o preço sem
  //    os juros da parcela). Cortesia da parceria não entra — não tem pagamento.
  const sb = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: linhas } = await (sb.rpc as any)('conversao_vendas_diarias', {
    p_desde: SINCE,
    p_campanhas_plano: idsPlano,
  })

  type Linha = {
    dia: string; vendas: number; receita_cents: number
    vendas_plano: number; receita_plano_cents: number
    vendas_outra_campanha: number; vendas_sem_origem: number
  }
  const porDia = new Map<string, Linha>()
  for (const l of ((linhas ?? []) as Linha[])) porDia.set(String(l.dia).slice(0, 10), l)

  // 3) Série diária contínua de SINCE até hoje
  const days: Array<{
    date: string; clicks: number
    sales: number; revenue: number
    salesOutras: number; salesSemOrigem: number
    salesTotal: number; revenueTotal: number
  }> = []
  const cur = new Date(SINCE + 'T12:00:00Z')
  const end = new Date(untilBR + 'T12:00:00Z')
  while (cur <= end) {
    const date = cur.toISOString().slice(0, 10)
    const l = porDia.get(date)
    days.push({
      date,
      clicks: clicksByDay[date] ?? 0,
      sales: Number(l?.vendas_plano ?? 0),
      revenue: Number(l?.receita_plano_cents ?? 0) / 100,
      salesOutras: Number(l?.vendas_outra_campanha ?? 0),
      salesSemOrigem: Number(l?.vendas_sem_origem ?? 0),
      salesTotal: Number(l?.vendas ?? 0),
      revenueTotal: Number(l?.receita_cents ?? 0) / 100,
    })
    cur.setUTCDate(cur.getUTCDate() + 1)
  }

  const metaOk = Object.keys(clicksByDay).length > 0

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: T.bg, fontFamily: fonts.ui, color: T.ink }}>
      <Sidebar />
      <main className="dash-main" style={{ marginLeft: 234, flex: 1, height: '100vh', overflowY: 'auto', padding: 32 }}>
        <ConversaoClient days={days} metaOk={metaOk} campanhas={campanhas} />
      </main>
    </div>
  )
}
