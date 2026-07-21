// Gera planos capilares SEM IA (determinístico) a partir do quiz — no formato exato
// que o app espera (hair_plans 12 semanas + profile). Uso:
//   node gen-plans.mjs <stuck.json> [--dry] [--only=N] [--limit=N]
// --dry  : monta e imprime, NÃO grava.  --only=N: só o índice N.  --limit=N: os N primeiros.
import { readFileSync } from 'node:fs'

const BASE = 'https://db.planodaju.julianecost.com'
const SK = readFileSync(new URL('../../apps/admin/.env.local', import.meta.url).pathname, 'utf8')
  .match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim().replace(/^["']|["']$/g, '')

// ── Produtos Ybera (IDs reais) ───────────────────────────────────────────────
const P = {
  kit:     { id: 'c2b25cfb-0317-41e8-8dce-57e6eef9b6e5', nome: 'Kit Cuidados Profundos' },       // 3 máscaras H/N/R
  oleo:    { id: 'e5a86346-1a64-470a-8f2c-4b9cee38c2a6', nome: 'Óleo de Mirra Reparador 60ml' },
  shampoo: { id: '5516342b-0a36-4fae-afc3-6b4d83a88b76', nome: 'Shampoo Multifunção 500ml Cuidados Profundos' },
  cem:     { id: '7e69b7f9-94f1-4aec-91b8-d0b642ff98e8', nome: '100Timetros 90 Cápsulas Softgel' }, // antiqueda
  vello:   { id: '87d47cf7-1a38-41e0-afda-9ed1cfbee6dc', nome: 'Soro Vello Alfa-Lactobaby' },       // tônico do couro (raiz)
  leaveU:  { id: '19161ce9-8e7c-4bf5-b6fa-c9e5342f3606', nome: 'Leave-in Universal 250g' },
  leaveL:  { id: '7ec47dd6-841f-4c61-a460-0dbc5f679f77', nome: 'Leave-In 150ml Loiro Perfeito' },
  leaveC:  { id: 'ea6fad77-6f5c-4b5a-aa67-9fbadb5b2776', nome: 'Leave-in 300ml Cacho Perfeito' },
}
// Leave-in certo pelo tipo/cor: loira → Loiro Perfeito; cacheada/crespa → Cacho Perfeito; senão Universal
function pickLeave(q) {
  if (String(q.cor || '').includes('loiro')) return P.leaveL
  if (q.tipo === 'cacheado' || q.tipo === 'crespo') return P.leaveC
  return P.leaveU
}

// ── Dicionários do quiz → texto ──────────────────────────────────────────────
const INC = {
  pontas: 'as pontas ressecadas e com aspecto de duplas',
  frizz: 'o frizz e o aspecto armado ao longo do dia',
  queda: 'a queda dos fios',
  cresc: 'a sensação de que o cabelo custa a crescer',
  quebra: 'a quebra dos fios',
  volume: 'o volume difícil de controlar',
  oleosidade: 'a raiz que fica oleosa rápido',
}
const QUI = { mechas: 'mechas', descolor: 'descoloração', tintura: 'coloração', botox: 'botox', progressiva: 'progressiva', relax: 'relaxamento' }
const TIPO = { liso: 'liso', ondulado: 'ondulado', cacheado: 'cacheado', crespo: 'crespo' }
const arr = (x) => Array.isArray(x) ? x : (x ? [x] : [])
const nice = (list, map) => arr(list).map(c => map[c] || c)
const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || 'linda'

// ── Seleção de produtos (poucos: 3–4) ────────────────────────────────────────
function pickProdutos(q) {
  const inc = arr(q.incomoda)
  const antiqueda = inc.includes('queda') || inc.includes('cresc') || inc.includes('quebra')
  const out = []
  // âncora = incômodo principal
  if (antiqueda) out.push({ produto_id: P.cem.id, motivo: 'Combate a queda de dentro pra fora — 1 cápsula por dia nutre o folículo e estimula fios mais fortes, o que nenhum produto de fora sozinho faz.', alternativa_id: null })
  out.push({ produto_id: P.kit.id, motivo: 'É o seu âncora de tratamento: as 3 máscaras do cronograma (hidratação, nutrição e reconstrução) recuperam as pontas ressecadas e devolvem maciez, brilho e elasticidade ao fio.', alternativa_id: null })
  out.push({ produto_id: P.oleo.id, motivo: 'Sela a cutícula das pontas todos os dias, mantendo a hidratação dentro do fio e eliminando o aspecto áspero e sem brilho do dia a dia.', alternativa_id: null })
  out.push({ produto_id: P.shampoo.id, motivo: q.oleosidade === 'oleoso' ? 'Limpa a raiz com firmeza sem ressecar os comprimentos — essencial pro seu couro que oleosa rápido.' : 'Limpa com suavidade sem agredir os comprimentos e as pontas já fragilizadas.', alternativa_id: null })
  const leave = pickLeave(q)
  out.push({ produto_id: leave.id, motivo: 'Finaliza protegendo do calor e do atrito do dia: desembaraça, controla o frizz e sela a hidratação nos comprimentos sem pesar.', alternativa_id: null })
  out.push({ produto_id: P.vello.id, motivo: 'Tônico do couro cabeludo: aplicado na raiz todos os dias, estimula e fortalece o folículo — a base pra fios nascerem mais fortes.', alternativa_id: null })
  return { produtos: out, antiqueda, leave }
}

// ── Carta personalizada (Mensagem da Ju) ─────────────────────────────────────
function buildCarta(q, name) {
  const fn = firstName(name)
  const incs = nice(q.incomoda, INC)
  const quis = nice(q.quimica, QUI).filter(x => x !== 'nenhuma')
  const incTxt = incs.length === 1 ? incs[0] : incs.slice(0, -1).join(', ') + ' e ' + incs[incs.length - 1]
  const tipo = TIPO[q.tipo] || 'do seu tipo'
  const causa = quis.length
    ? `o processo de ${quis.join(' + ')}, junto com o secador/chapinha do dia a dia,`
    : `o calor do secador/chapinha e a falta de um cronograma na ordem certa`
  const p1 = `Oi ${fn}, tudo bem?`
  const p2 = `Analisei com carinho as suas respostas no meu questionário e já deu pra ver claramente o seu caso: o que mais te incomoda hoje é ${incTxt}. Fica tranquila — isso tem solução, e eu vou te guiar passo a passo.`
  const p3 = `Seu cabelo ${tipo} chegou nesse ponto porque ${causa} foram consumindo a hidratação e a força do fio mais rápido do que qualquer máscara solta consegue repor. A questão nunca foi você não se cuidar — era faltar o método certo, na ordem certa.`
  const p4 = `Eu montei pra você um cronograma de 12 semanas que alterna hidratação, nutrição e reconstrução ancorado exatamente no seu incômodo principal. Quanto antes você começar, mais rápido as pontas recuperam e o brilho volta — sem gastar rios de dinheiro em salão.`
  const p5 = `Como a foto do seu cabelo ainda não chegou, montei este plano com base nas suas respostas. 💛 Quando puder, envie sua foto aqui no app que eu ajusto os detalhes pra deixar ainda mais certeiro pra você. Vem comigo nesses 90 dias!`
  return [p1, p2, p3, p4, p5].join('\n\n') + '\n\nBeijos da Ju 💛'
}

// ── Diagnóstico (mais objetivo) ──────────────────────────────────────────────
function buildDiagnostico(q) {
  const incs = nice(q.incomoda, INC)
  const quis = nice(q.quimica, QUI).filter(x => x !== 'nenhuma')
  const couro = q.oleosidade === 'oleoso' ? 'couro com tendência oleosa' : q.oleosidade === 'seco' ? 'couro mais seco' : 'couro equilibrado'
  const poro = q.porosidade === 'sim_absorve' ? 'porosidade alta (o fio absorve rápido e perde água rápido)' : q.porosidade === 'nao_demora' ? 'porosidade baixa' : 'porosidade a confirmar'
  return `Pelas suas respostas: cabelo ${TIPO[q.tipo] || ''} ${q.espessura === 'fino' ? 'de fio fino' : q.espessura === 'grosso' ? 'de fio grosso' : ''}, ${couro}, ${poro}. `
    + `Principais pontos a tratar: ${incs.join(', ')}. `
    + (quis.length ? `Histórico de ${quis.join(', ')} — por isso o foco em repor lipídios e proteína na ordem certa. ` : '')
    + `O plano prioriza ${incs[0] || 'a saúde das pontas'} desde a semana 1.`
}

// ── Cronograma de 12 semanas ─────────────────────────────────────────────────
const DIAS = { 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado', 7: 'Domingo' }
const MASKS = { H: 'Máscara de Hidratação', N: 'Máscara de Nutrição', R: 'Máscara de Reconstrução' }
const CICLO = ['H', 'N', 'H', 'R', 'H', 'N', 'H', 'R', 'N', 'H', 'N', 'R'] // por semana
const FOCO = [
  'Diagnóstico + primeira rodada de HIDRATAÇÃO — repor água e maciez nas pontas ressecadas.',
  'NUTRIÇÃO — repor os lipídios (óleos naturais) que a química e o calor foram tirando.',
  'HIDRATAÇÃO — manter as pontas macias e o brilho voltando.',
  'RECONSTRUÇÃO leve — repor proteína e devolver força ao fio (evita a quebra).',
  'HIDRATAÇÃO — consolidando o que já melhorou.',
  'NUTRIÇÃO — selar a cutícula e intensificar o brilho.',
  'HIDRATAÇÃO — marco de 45 dias, cabelo visivelmente mais macio.',
  'RECONSTRUÇÃO — reforço de proteína antes da reta final.',
  'NUTRIÇÃO — maciez e controle do frizz.',
  'HIDRATAÇÃO — brilho e leveza conquistados, mantendo o ritmo.',
  'NUTRIÇÃO intensa — preparando o resultado final.',
  'RECONSTRUÇÃO final + selagem — pontas reparadas e resultado consolidado. Compare com o dia 1!',
]
function buildSemanas(q) {
  // dias de lavagem conforme couro/frequência
  const couro = q.oleosidade
  const washDays = couro === 'oleoso' ? [1, 3, 5, 7] : couro === 'seco' ? [1, 5] : [1, 3, 5]
  const semanas = []
  for (let w = 1; w <= 12; w++) {
    const mask = MASKS[CICLO[w - 1]]
    const tarefas = []
    washDays.forEach((dia, idx) => {
      const trata = idx % 2 === 0 // dia de tratamento (máscara) alternado
      const semShampoo = couro === 'seco' && idx > 0 // couro seco: co-wash nos dias extras
      if (semShampoo) {
        tarefas.push({ dia, titulo: 'Lavagem suave (co-wash)', descricao: 'Lave só com a máscara/condicionador nos comprimentos, sem shampoo, pra não ressecar o couro seco. Massageie e enxágue bem.' })
      } else {
        tarefas.push({ dia, titulo: 'Shampoo de limpeza', descricao: q.oleosidade === 'oleoso' ? 'Aplique na raiz, massageie 1–2 min com a polpa dos dedos e enxágue. Pode repetir se o couro estiver muito oleoso.' : 'Aplique na raiz, massageie 1 min e enxágue bem. Não esfregue os comprimentos.' })
      }
      if (trata) {
        tarefas.push({ dia, titulo: mask, descricao: `Aplique do comprimento médio até as pontas, longe da raiz. Deixe agir 15 min com touca. Enxágue com água fria pra selar a cutícula.${CICLO[w - 1] === 'R' ? ' Use no máximo 1x na semana pra não endurecer o fio.' : ''}` })
      }
      tarefas.push({ dia, titulo: 'Óleo de Mirra nas pontas', descricao: '2–3 gotas nas pontas ainda úmidas, antes do secador. Não enxágue — protege e sela a umidade.' })
    })
    const dica = CICLO[w - 1] === 'R'
      ? 'A reconstrução repõe proteína, mas em excesso endurece — por isso entra 1x a cada bloco, nunca toda semana.'
      : CICLO[w - 1] === 'N'
      ? 'A nutrição repõe os óleos naturais do fio — combina bem com a toalha quente sobre a touca pra penetrar mais fundo.'
      : 'Água fria no fim do enxágue fecha a cutícula e deixa o brilho maior. Vale o esforço!'
    semanas.push({ semana: w, foco: FOCO[w - 1], tarefas, produtos: [P.shampoo.nome, mask, P.oleo.nome], dica })
  }
  return semanas
}

// ── Monta o plano completo de 1 cliente ──────────────────────────────────────
function buildPlan(row) {
  const q = row.quiz_answers || {}
  const { produtos, antiqueda } = pickProdutos(q)
  const diarios = ['Óleo de Mirra Reparador: 2–3 gotas nas pontas com o cabelo úmido, todos os dias — nunca na raiz.']
  diarios.push('Tônico Vello (Soro Vello): aplique no couro cabeludo e massageie com as pontas dos dedos, todos os dias. Não precisa enxaguar — fortalece a raiz.')
  if (antiqueda) diarios.push('100Tímetros: 1 cápsula por dia, sempre no mesmo horário, de preferência com uma refeição.')
  return {
    id: row.id, nome: row.full_name, tipo_cabelo: q.tipo || row.hair_type || null,
    carta_ju: buildCarta(q, row.full_name),
    diagnostico: buildDiagnostico(q),
    diarios, produtos_indicados: produtos,
    semanas: buildSemanas(q),
  }
}

// ── Persiste (REST self-hosted) ──────────────────────────────────────────────
const H = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json' }
async function rest(method, path, body) {
  const r = await fetch(`${BASE}/rest/v1/${path}`, { method, headers: { ...H, Prefer: 'return=minimal' }, body: body ? JSON.stringify(body) : undefined })
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${(await r.text()).slice(0, 200)}`)
}
async function savePlan(plan) {
  const NOTA = 'Como ainda não recebi a foto do seu cabelo, montei este plano com base nas suas respostas do questionário. 💛 Quando puder, envie sua foto aqui no app que eu ajusto os detalhes pra deixar ainda mais certeiro pra você!\n\nOs produtos indicados são os que eu uso e confio nos resultados. Mas podem ser substituídos por produtos de outras marcas, desde que cumpram a mesma função.'
  const rows = plan.semanas.map(s => ({
    user_id: plan.id, week_number: s.semana, focus: s.foco,
    tasks: s.tarefas.map(t => ({ day: t.dia, title: t.titulo, description: t.descricao || '' })).sort((a, b) => a.day - b.day),
    products: s.produtos, tips: s.dica ? [s.dica] : [], juliane_notes: s.semana === 1 ? NOTA : null,
  }))
  await rest('DELETE', `hair_plans?user_id=eq.${plan.id}`)
  await rest('POST', 'hair_plans', rows)
  await rest('PATCH', `profiles?id=eq.${plan.id}`, {
    daily_rituals: plan.diarios, carta_ju: plan.carta_ju,
    recommended_products: plan.produtos_indicados,
    hair_type: plan.tipo_cabelo, plan_status: 'ready', plan_released_at: new Date().toISOString(),
  })
}

// ── main ─────────────────────────────────────────────────────────────────────
const [, , file, ...flags] = process.argv
const dry = flags.includes('--dry')
const only = flags.find(f => f.startsWith('--only='))?.split('=')[1]
const limit = flags.find(f => f.startsWith('--limit='))?.split('=')[1]
let rows = JSON.parse(readFileSync(file, 'utf8'))
if (only != null) rows = [rows[Number(only)]]
else if (limit != null) rows = rows.slice(0, Number(limit))

for (const row of rows) {
  const plan = buildPlan(row)
  if (dry) {
    console.log('\n══════════', plan.nome, '(', plan.id, ')══════════')
    console.log('CARTA:\n' + plan.carta_ju)
    console.log('\nDIAGNÓSTICO:', plan.diagnostico)
    console.log('\nPRODUTOS:', plan.produtos_indicados.map(p => p.produto_id).join(', '))
    console.log('DIÁRIOS:', plan.diarios)
    console.log('SEMANA 1 foco:', plan.semanas[0].foco)
    console.log('SEMANA 1 tarefas:', JSON.stringify(plan.semanas[0].tarefas.map(t => `d${t.dia} ${t.titulo}`)))
    console.log('SEMANA 4 tarefas:', JSON.stringify(plan.semanas[3].tarefas.map(t => `d${t.dia} ${t.titulo}`)))
    console.log('12 semanas geradas:', plan.semanas.length)
  } else {
    await savePlan(plan)
    console.log('✓ salvo:', plan.nome, plan.id)
  }
}
console.log(dry ? '\n(DRY — nada gravado)' : `\n${rows.length} plano(s) salvo(s).`)
