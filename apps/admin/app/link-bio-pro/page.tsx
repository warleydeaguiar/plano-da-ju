import { createAdminClient } from '@/lib/supabase'
import Sidebar from '../components/Sidebar'
import LinkBioProClient from './LinkBioProClient'
import { ETAPAS, etapaDoFunil, rotuloProfissao } from './rotulos'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Link na Bio PRO — Admin Plano da Ju' }

export interface PedidoBioPro {
  id: string
  nome: string | null
  email: string | null
  telefone: string | null
  profissao: string | null
  status_entrega: 'pendente' | 'em_producao' | 'entregue'
  criado_em: string
  entregue_em: string | null
  etapa_id?: string | null
  atualizado_em?: string
  estilo?: string | null
}

export interface MetricasBioPro {
  dias: number
  funil: { id: string; rotulo: string; qtd: number }[]
  pagos: number
  faturamentoCentavos: number
  porProfissao: { rotulo: string; visitas: number; contatos: number; pagos: number }[]
  porOrigem: { origem: string; visitas: number; pagos: number }[]
}

type Linha = {
  id: string; nome: string | null; email: string | null; telefone: string | null; profissao: string | null
  status_pagamento: string; status_entrega: PedidoBioPro['status_entrega']; criado_em: string; atualizado_em: string
  entregue_em: string | null; etapa_id: string | null; pagarme_order_id: string | null; valor_centavos: number
  utm_source: string | null; respostas: Record<string, unknown> | null
}

async function carregar(dias: number) {
  const supabase = createAdminClient()
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString()
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [{ data: pagosRaw }, { data: periodoRaw }] = await Promise.all([
    (supabase as any).from('bio_pro_orders')
      .select('id,nome,email,telefone,profissao,status_entrega,criado_em,entregue_em,respostas')
      .eq('status_pagamento', 'pago')
      .order('criado_em', { ascending: false }),
    (supabase as any).from('bio_pro_orders')
      .select('id,nome,email,telefone,profissao,status_pagamento,status_entrega,criado_em,atualizado_em,entregue_em,etapa_id,pagarme_order_id,valor_centavos,utm_source,respostas')
      .gte('criado_em', desde)
      .order('atualizado_em', { ascending: false })
      .limit(5000),
  ])
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const estiloDe = (r: { respostas: Record<string, unknown> | null }) =>
    typeof r.respostas?.estilo === 'string' ? (r.respostas.estilo as string) : null

  const pedidos: PedidoBioPro[] = ((pagosRaw ?? []) as Linha[]).map((r) => ({ ...r, estilo: estiloDe(r) }))
  const linhas = (periodoRaw ?? []) as Linha[]

  // Funil: cada visita conta em todas as etapas até a mais longe que alcançou.
  const alcance = linhas.map((r) => (r.status_pagamento === 'pago' ? ETAPAS.length : etapaDoFunil(r.etapa_id)))
  const funil: MetricasBioPro['funil'] = ETAPAS.map((e, i) => ({ id: e.id as string, rotulo: e.rotulo as string, qtd: alcance.filter((a) => a >= i).length }))
  const pagosPeriodo = linhas.filter((r) => r.status_pagamento === 'pago')
  funil.push({ id: 'pago', rotulo: 'Pagou', qtd: pagosPeriodo.length })

  const porProf = new Map<string, { visitas: number; contatos: number; pagos: number }>()
  const porOrig = new Map<string, { visitas: number; pagos: number }>()
  for (const r of linhas) {
    if (r.profissao) {
      const p = porProf.get(r.profissao) ?? { visitas: 0, contatos: 0, pagos: 0 }
      p.visitas++
      if (r.email) p.contatos++
      if (r.status_pagamento === 'pago') p.pagos++
      porProf.set(r.profissao, p)
    }
    const o = r.utm_source || 'direto'
    const q = porOrig.get(o) ?? { visitas: 0, pagos: 0 }
    q.visitas++
    if (r.status_pagamento === 'pago') q.pagos++
    porOrig.set(o, q)
  }

  const metricas: MetricasBioPro = {
    dias,
    funil,
    pagos: pagosPeriodo.length,
    faturamentoCentavos: pagosPeriodo.reduce((s, r) => s + (r.valor_centavos ?? 0), 0),
    porProfissao: [...porProf.entries()].map(([k, v]) => ({ rotulo: rotuloProfissao(k), ...v })).sort((a, b) => b.visitas - a.visitas),
    porOrigem: [...porOrig.entries()].map(([origem, v]) => ({ origem, ...v })).sort((a, b) => b.visitas - a.visitas),
  }

  // Abandonos com contato: deixaram nome/WhatsApp e não pagaram — dá pra chamar.
  const abandonos: PedidoBioPro[] = linhas
    .filter((r) => r.status_pagamento !== 'pago' && (r.telefone || r.email))
    .map((r) => ({ ...r, estilo: estiloDe(r) }))

  return { pedidos, abandonos, metricas }
}

export default async function LinkBioProPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const { dias: diasParam } = await searchParams
  const dias = [7, 30, 90].includes(Number(diasParam)) ? Number(diasParam) : 30
  const { pedidos, abandonos, metricas } = await carregar(dias)
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#FFFAF5' }}>
      <Sidebar />
      <LinkBioProClient pedidos={pedidos} abandonos={abandonos} metricas={metricas} />
    </div>
  )
}
