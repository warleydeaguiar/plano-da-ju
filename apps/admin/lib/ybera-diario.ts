/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * YBERA — visão DIA A DIA + "os leads que chegam são os que compram?"
 * (pedido do Warley, 12/11/2026, painel /ybera).
 *
 * Junta, por dia (horário de Brasília):
 *   investimento Meta das campanhas "Grupo" (com imposto) e cliques,
 *   visitas e leads do quiz /quiz/fashion-gold, entradas no grupo (/g/entrar),
 *   pedidos da Ybera (tabela ybera_orders, sincronizada todo dia às 9h).
 *
 * E cruza cada pedido com os leads do quiz: casa por E-MAIL, depois TELEFONE
 * (DDD + 8 dígitos) e por último NOME COMPLETO (só nome com 2+ palavras; vem
 * marcado "pelo nome" porque pode ser homônimo). Um pedido é "de lead" quando
 * a pessoa virou lead ANTES de comprar.
 */
import { createAdminClient } from '@/lib/supabase'
import { getGrupoAdSpendDiario } from '@/lib/meta-ads'
import { fetchYberaOrders } from '@/lib/ybera-api'
import { normEmail, normName, normPhoneKey } from '@/lib/ybera-match'

const BR = 3 * 3600_000
/** Comissão da afiliada sobre as vendas da Ybera (Warley, 12/11/2026: 20%). */
export const COMISSAO_YBERA = Number(process.env.YBERA_COMISSAO ?? '0.20')
export const diaBR = (iso: string) => new Date(new Date(iso).getTime() - BR).toISOString().slice(0, 10)

export type ComoCasou = 'email' | 'telefone' | 'nome'
export type LinhaDia = {
  dia: string
  investido: number | null
  cliques: number | null
  visitas: number
  leads: number
  entradasGrupo: number
  pedidos: number
  vendas: number
  pedidosDeLead: number
  vendasDeLead: number
}
export type CompradoraLead = {
  nome: string
  entrouEm: string
  primeiraCompra: string
  dias: number
  pedidos: number
  valor: number
  produtos: string[]
  como: ComoCasou
  novaCliente: boolean
}
export type DiarioYbera = {
  desde: string
  ate: string
  dias: LinhaDia[]
  metaStatus: string
  metaErro?: string
  totais: {
    investido: number | null
    cliques: number | null
    visitas: number
    leads: number
    entradasGrupo: number
    pedidos: number
    vendas: number
    pedidosDeLead: number
    vendasDeLead: number
  }
  coorte: {
    leads: number
    compraram: number
    novasClientes: number
    valor: number
    diasMedios: number | null
    porComo: Record<ComoCasou, number>
    lista: CompradoraLead[]
    produtos: { nome: string; qtd: number }[]
  }
  ultimaSincronizacao: string | null
}

async function todas(sb: any, montar: (from: number, to: number) => any, max = 50000): Promise<any[]> {
  const out: any[] = []
  for (let i = 0; i < max; i += 1000) {
    const { data, error } = await montar(i, i + 999)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return out
}

function produtosDo(o: any): { nome: string; qtd: number }[] {
  return (Array.isArray(o.products) ? o.products : [])
    .filter((p: any) => p && Number(p.value ?? 0) > 0) // brinde não conta
    .map((p: any) => ({ nome: String(p.name ?? '—'), qtd: Number(p.quantity ?? 1) }))
}

export async function carregarDiarioYbera(nDias: number): Promise<DiarioYbera> {
  const sb = createAdminClient()
  const hoje = diaBR(new Date().toISOString())
  const desde = new Date(Date.parse(`${hoje}T00:00:00Z`) - (nDias - 1) * 86400_000).toISOString().slice(0, 10)
  const desdeIso = new Date(Date.parse(`${desde}T00:00:00Z`) + BR).toISOString()

  const [meta, visitas, entradas, leads, pedidos, sinc] = await Promise.all([
    getGrupoAdSpendDiario(desde, hoje),
    todas(sb, (a, b) => (sb.from('wg_quiz_views') as any).select('session_id, created_at')
      .eq('quiz_slug', 'fashion-gold').gte('created_at', desdeIso).range(a, b)),
    todas(sb, (a, b) => (sb.from('wg_redirect_clicks') as any).select('created_at').gte('created_at', desdeIso).range(a, b)),
    // TODOS os leads do quiz dos grupos: quem virou lead há meses também pode comprar agora.
    todas(sb, (a, b) => (sb.from('wg_quiz_leads') as any).select('id, name, email, phone, created_at')
      .eq('quiz_slug', 'fashion-gold').order('created_at').range(a, b)),
    todas(sb, (a, b) => (sb.from('ybera_orders') as any)
      .select('id, register_date, subtotal, customer_name, customer_email, customer_phone, products').order('register_date').range(a, b)),
    (sb.from('ybera_orders') as any).select('synced_at').order('synced_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  // A tabela é sincronizada 1x por dia (9h): os pedidos de depois disso vêm AO VIVO da API.
  const ultimoPedido = pedidos.length ? diaBR(pedidos[pedidos.length - 1].register_date) : desde
  const vivos = await fetchYberaOrders(ultimoPedido, hoje).catch(() => null)
  if (vivos?.status === 'ok') {
    const ja = new Set(pedidos.map((o) => String(o.id)))
    for (const o of vivos.orders) {
      if (ja.has(String(o.id))) continue
      pedidos.push({ id: o.id, register_date: o.registerDate, subtotal: o.subtotal, customer_name: o.customer?.name,
        customer_email: o.customer?.email, customer_phone: o.customer?.phone, products: o.products })
    }
    pedidos.sort((a, b) => String(a.register_date).localeCompare(String(b.register_date)))
  }

  // ── índice dos leads (o mais antigo vence: é quando ela entrou) ──
  const porEmail = new Map<string, any>(), porTel = new Map<string, any>(), porNome = new Map<string, any>()
  for (const l of leads) {
    const e = normEmail(l.email), t = normPhoneKey(l.phone), n = normName(l.name)
    if (e && !porEmail.has(e)) porEmail.set(e, l)
    if (t && !porTel.has(t)) porTel.set(t, l)
    if (n.split(' ').length >= 2 && !porNome.has(n)) porNome.set(n, l)
  }
  const acharLead = (o: any): { lead: any; como: ComoCasou } | null => {
    const e = normEmail(o.customer_email); if (e && porEmail.has(e)) return { lead: porEmail.get(e), como: 'email' }
    const t = normPhoneKey(o.customer_phone); if (t && porTel.has(t)) return { lead: porTel.get(t), como: 'telefone' }
    const n = normName(o.customer_name); if (n.split(' ').length >= 2 && porNome.has(n)) return { lead: porNome.get(n), como: 'nome' }
    return null
  }
  // Primeira compra de cada cliente (por e-mail/telefone) — para saber se é cliente NOVA.
  const primeiraCompraCliente = new Map<string, string>()
  const chaveCliente = (o: any) => normEmail(o.customer_email) || normPhoneKey(o.customer_phone) || normName(o.customer_name)
  for (const o of pedidos) {
    const k = chaveCliente(o)
    if (k && o.register_date && !primeiraCompraCliente.has(k)) primeiraCompraCliente.set(k, o.register_date)
  }

  // ── dia a dia ──
  const linhas = new Map<string, LinhaDia>()
  for (let t = Date.parse(`${desde}T00:00:00Z`); t <= Date.parse(`${hoje}T00:00:00Z`); t += 86400_000) {
    const d = new Date(t).toISOString().slice(0, 10)
    linhas.set(d, {
      dia: d,
      investido: meta.status === 'ok' ? (meta.gasto[d] ?? 0) : null,
      cliques: meta.status === 'ok' ? (meta.cliques[d] ?? 0) : null,
      visitas: 0, leads: 0, entradasGrupo: 0, pedidos: 0, vendas: 0, pedidosDeLead: 0, vendasDeLead: 0,
    })
  }
  const sessoesPorDia = new Map<string, Set<string>>()
  for (const v of visitas) {
    const d = diaBR(v.created_at); if (!linhas.has(d)) continue
    if (!sessoesPorDia.has(d)) sessoesPorDia.set(d, new Set())
    sessoesPorDia.get(d)!.add(v.session_id ?? `${v.created_at}`)
  }
  for (const [d, s] of sessoesPorDia) linhas.get(d)!.visitas = s.size
  for (const c of entradas) { const d = diaBR(c.created_at); if (linhas.has(d)) linhas.get(d)!.entradasGrupo++ }
  for (const l of leads) { const d = diaBR(l.created_at); if (linhas.has(d)) linhas.get(d)!.leads++ }
  for (const o of pedidos) {
    if (!o.register_date) continue
    const d = diaBR(o.register_date); const L = linhas.get(d); if (!L) continue
    const v = Number(o.subtotal ?? 0)
    L.pedidos++; L.vendas += v
    const m = acharLead(o)
    if (m && m.lead.created_at <= o.register_date) { L.pedidosDeLead++; L.vendasDeLead += v }
  }
  const dias = [...linhas.values()].sort((a, b) => b.dia.localeCompare(a.dia))
  const soma = (k: keyof LinhaDia) => dias.reduce((s, x) => s + (Number(x[k]) || 0), 0)

  // ── coorte: os leads que ENTRARAM no período — quem comprou depois? ──
  const leadsPeriodo = leads.filter((l) => l.created_at >= desdeIso)
  const idsPeriodo = new Set(leadsPeriodo.map((l) => l.id))
  const porLead = new Map<string, { lead: any; como: ComoCasou; pedidos: any[] }>()
  for (const o of pedidos) {
    if (!o.register_date) continue
    const m = acharLead(o)
    if (!m || !idsPeriodo.has(m.lead.id) || o.register_date < m.lead.created_at) continue
    const x = porLead.get(m.lead.id) ?? { lead: m.lead, como: m.como, pedidos: [] }
    x.pedidos.push(o); porLead.set(m.lead.id, x)
  }
  const lista: CompradoraLead[] = []
  const prodTotal = new Map<string, number>()
  const porComo: Record<ComoCasou, number> = { email: 0, telefone: 0, nome: 0 }
  for (const { lead, como, pedidos: ps } of porLead.values()) {
    const primeira = ps[0].register_date
    const prods = new Map<string, number>()
    for (const o of ps) for (const p of produtosDo(o)) { prods.set(p.nome, (prods.get(p.nome) ?? 0) + p.qtd); prodTotal.set(p.nome, (prodTotal.get(p.nome) ?? 0) + p.qtd) }
    const k = chaveCliente(ps[0])
    porComo[como]++
    lista.push({
      nome: String(ps[0].customer_name ?? lead.name ?? '—'),
      entrouEm: lead.created_at, primeiraCompra: primeira,
      dias: Math.max(0, Math.round((Date.parse(primeira) - Date.parse(lead.created_at)) / 86400_000)),
      pedidos: ps.length, valor: ps.reduce((s, o) => s + Number(o.subtotal ?? 0), 0),
      produtos: [...prods.entries()].sort((a, b) => b[1] - a[1]).map(([n, q]) => q > 1 ? `${n} (${q})` : n),
      como, novaCliente: !k || (primeiraCompraCliente.get(k) ?? primeira) >= lead.created_at,
    })
  }
  lista.sort((a, b) => b.primeiraCompra.localeCompare(a.primeiraCompra))

  return {
    desde, ate: hoje, dias, metaStatus: meta.status, metaErro: meta.error,
    totais: {
      investido: meta.status === 'ok' ? soma('investido') : null,
      cliques: meta.status === 'ok' ? soma('cliques') : null,
      visitas: soma('visitas'), leads: soma('leads'), entradasGrupo: soma('entradasGrupo'),
      pedidos: soma('pedidos'), vendas: soma('vendas'), pedidosDeLead: soma('pedidosDeLead'), vendasDeLead: soma('vendasDeLead'),
    },
    coorte: {
      leads: leadsPeriodo.length,
      compraram: lista.length,
      novasClientes: lista.filter((x) => x.novaCliente).length,
      valor: lista.reduce((s, x) => s + x.valor, 0),
      diasMedios: lista.length ? lista.reduce((s, x) => s + x.dias, 0) / lista.length : null,
      porComo, lista,
      produtos: [...prodTotal.entries()].map(([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd).slice(0, 10),
    },
    ultimaSincronizacao: (sinc as any)?.data?.synced_at ?? null,
  }
}
