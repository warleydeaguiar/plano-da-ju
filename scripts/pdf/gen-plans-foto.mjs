// Gera planos capilares COM análise de foto — a parte visual (analise_foto) é
// produzida por um modelo de visão (aqui, feita manualmente pelo Opus no chat como
// PROVA DE CONCEITO; em produção vem do modelo via OpenRouter). O cronograma de 12
// semanas continua determinístico (template, R$0). Uso:
//   node gen-plans-foto.mjs [--dry] [--only=<id>]
import { readFileSync } from 'node:fs'

const BASE = 'https://db.planodaju.julianecost.com'
const SK = readFileSync(new URL('../../apps/admin/.env.local', import.meta.url).pathname, 'utf8')
  .match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim().replace(/^["']|["']$/g, '')

// ── Produtos Ybera (IDs reais) ───────────────────────────────────────────────
const P = {
  kit:     { id: 'c2b25cfb-0317-41e8-8dce-57e6eef9b6e5', nome: 'Kit Cuidados Profundos' },
  oleo:    { id: 'e5a86346-1a64-470a-8f2c-4b9cee38c2a6', nome: 'Óleo de Mirra Reparador 60ml' },
  shampoo: { id: '5516342b-0a36-4fae-afc3-6b4d83a88b76', nome: 'Shampoo Multifunção 500ml Cuidados Profundos' },
  cem:     { id: '7e69b7f9-94f1-4aec-91b8-d0b642ff98e8', nome: '100Timetros 90 Cápsulas Softgel' },
  vello:   { id: '87d47cf7-1a38-41e0-afda-9ed1cfbee6dc', nome: 'Soro Vello Alfa-Lactobaby' },
  leaveU:  { id: '19161ce9-8e7c-4bf5-b6fa-c9e5342f3606', nome: 'Leave-in Universal 250g' },
  leaveL:  { id: '7ec47dd6-841f-4c61-a460-0dbc5f679f77', nome: 'Leave-In 150ml Loiro Perfeito' },
  leaveC:  { id: 'ea6fad77-6f5c-4b5a-aa67-9fbadb5b2776', nome: 'Leave-in 300ml Cacho Perfeito' },
}
function pickLeave(q) {
  if (String(q.cor || '').includes('loiro')) return P.leaveL
  if (q.tipo === 'cacheado' || q.tipo === 'crespo') return P.leaveC
  return P.leaveU
}

// ── ANÁLISES DE FOTO (visão — feita pelo Opus a partir das fotos reais) ───────
// Cada uma referencia o que É VISÍVEL nas fotos frente/costas/raiz da cliente.
const ANALISES = {
  // Giuliane Martinelli — liso grosso, seco, caspa freq, progressiva+corte químico
  '6ce8be5d-ca38-4375-9d60-915a536a27fd': {
    scores: { brilho: 2.5, hidratacao: 2, frizz: 2, pontas: 1.5, cresc_cm: null },
    avaliacao: 'Olhei suas fotos com atenção, Giuliane. Seu cabelo é liso e de fio grosso, com um comprimento bonito, mas dá pra ver que as pontas estão bem afinadas e com aspecto de duplas — é ali que a progressiva e o corte químico mais pesaram, o fio vai perdendo espessura da metade pra baixo. O brilho está médio e falta hidratação nos comprimentos, que aparecem meio opacos e com um frizz de ressecamento. A boa notícia está na raiz: seu couro parece saudável e eu consigo ver vários fios novos nascendo — sinal claro de que a queda é reversível e o folículo está ativo. A cor acobreada aparece desbotada, o que também é reflexo da cutícula aberta. O foco dos seus 90 dias vai ser: reconstruir as pontas pra frear a quebra, selar a cutícula pra devolver brilho, e fortalecer o fio de dentro pra fora pra sustentar todo esse crescimento novo que já está vindo.',
    // frase curta pra fechar a carta, referenciando a foto
    carta_foto: 'Analisei suas fotos além do questionário: o que mais me chamou atenção foram as pontas afinadas e o frizz de ressecamento nos comprimentos — mas a raiz, com tanto fio novo nascendo, me deixou muito otimista com o seu caso.',
  },
  // Gabriela Grossi — liso fino, oleoso, progressiva, castanho escuro (base saudável)
  'c764c82c-75ea-41c3-b413-6a54b97a3ea9': {
    scores: { brilho: 3, hidratacao: 3, frizz: 2.5, pontas: 2.5, cresc_cm: null },
    avaliacao: 'Analisei suas fotos, Gabriela. Seu cabelo é liso, de fio fino e castanho escuro, e no geral está num estado melhor do que muita gente que chega até mim — o comprimento tem um brilho razoável e a cor está bonita. O ponto principal está mesmo nas pontas: elas estão afinando e com aspecto ralo, o fio perde corpo da altura do ombro pra baixo, e isso conversa direto com a sensação de queda e de cabelo que custa a crescer que você me contou. Também noto um frizzinho de ressecamento no topo e ao redor do rosto, típico de quem usa secador/chapinha e já está com a progressiva num estágio mais antigo. Seu couro aparece limpo e equilibrado. Como sua base é boa, nossos 90 dias vão focar em engrossar e proteger as pontas, nutrir o comprimento pra domar o frizz e fortalecer o fio pra sustentar o crescimento — você tende a ver resultado rápido.',
    carta_foto: 'Analisei suas fotos além do questionário: sua base é ótima (couro equilibrado, comprimento com brilho) — o trabalho concentra nas pontas afinadas e num frizzinho no topo. Com uma base boa dessas, o resultado costuma aparecer rápido.',
  },
  // Lorenna Rocha — liso fino, oleoso, mechas/loiro, porosidade alta, quebradiços
  '02a5a3f8-0629-4468-a0da-34c98db5cc8c': {
    scores: { brilho: 2.5, hidratacao: 2, frizz: 2, pontas: 2, cresc_cm: null },
    avaliacao: 'Olhei suas fotos, Lorenna. Seu cabelo é liso, de fio fino e com mechas loiras que clareiam bastante nas pontas — e é justamente ali que mora o desafio: a parte descolorida está mais porosa e ressecada, com aspecto quebradiço e um frizz que sobe ao longo do comprimento. Isso bate certinho com o que você respondeu (porosidade alta, fios quebradiços). A raiz e o couro parecem saudáveis e o brilho do meio pra cima ainda está ok, mas as pontas pedem socorro de nutrição e reconstrução — cabelo com mechas perde proteína e lipídio muito mais rápido. Nos seus 90 dias o foco é: repor proteína com cautela pra estancar a quebra, encharcar as pontas de nutrição e óleo pra selar a porosidade e acabar com o frizz, sempre preservando a cor das mechas. Feito na ordem certa, a diferença nas pontas vai ser bem visível.',
    carta_foto: 'Analisei suas fotos além do questionário: as mechas deixaram as pontas porosas e quebradiças, com frizz subindo pelo comprimento. Vamos tratar isso com reconstrução na medida e muita nutrição — sempre com cuidado pra preservar a cor.',
  },
}

// ── Dicionários do quiz → texto ──────────────────────────────────────────────
const INC = {
  pontas: 'as pontas ressecadas e com aspecto de duplas', frizz: 'o frizz e o aspecto armado ao longo do dia',
  queda: 'a queda dos fios', cresc: 'a sensação de que o cabelo custa a crescer', quebra: 'a quebra dos fios',
  volume: 'o volume difícil de controlar', oleosidade: 'a raiz que fica oleosa rápido',
}
const QUI = { mechas: 'mechas', descolor: 'descoloração', tintura: 'coloração', botox: 'botox', progressiva: 'progressiva', relax: 'relaxamento' }
const TIPO = { liso: 'liso', ondulado: 'ondulado', cacheado: 'cacheado', crespo: 'crespo' }
const arr = (x) => Array.isArray(x) ? x : (x ? [x] : [])
const nice = (list, map) => arr(list).map(c => map[c] || c)
const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || 'linda'

function pickProdutos(q) {
  const inc = arr(q.incomoda)
  const antiqueda = inc.includes('queda') || inc.includes('cresc') || inc.includes('quebra')
  const out = []
  if (antiqueda) out.push({ produto_id: P.cem.id, motivo: 'Combate a queda de dentro pra fora — 1 cápsula por dia nutre o folículo e estimula fios mais fortes, o que nenhum produto de fora sozinho faz.', alternativa_id: null })
  out.push({ produto_id: P.kit.id, motivo: 'É o seu âncora de tratamento: as 3 máscaras do cronograma (hidratação, nutrição e reconstrução) recuperam as pontas ressecadas e devolvem maciez, brilho e elasticidade ao fio.', alternativa_id: null })
  out.push({ produto_id: P.oleo.id, motivo: 'Sela a cutícula das pontas todos os dias, mantendo a hidratação dentro do fio e eliminando o aspecto áspero e sem brilho do dia a dia.', alternativa_id: null })
  out.push({ produto_id: P.shampoo.id, motivo: q.oleosidade === 'oleoso' ? 'Limpa a raiz com firmeza sem ressecar os comprimentos — essencial pro seu couro que oleosa rápido.' : 'Limpa com suavidade sem agredir os comprimentos e as pontas já fragilizadas.', alternativa_id: null })
  const leave = pickLeave(q)
  out.push({ produto_id: leave.id, motivo: 'Finaliza protegendo do calor e do atrito do dia: desembaraça, controla o frizz e sela a hidratação nos comprimentos sem pesar.', alternativa_id: null })
  out.push({ produto_id: P.vello.id, motivo: 'Tônico do couro cabeludo: aplicado na raiz todos os dias, estimula e fortalece o folículo — a base pra fios nascerem mais fortes.', alternativa_id: null })
  return { produtos: out, antiqueda, leave }
}

// ── Carta personalizada COM foto ─────────────────────────────────────────────
function buildCarta(q, name, analise) {
  const fn = firstName(name)
  const incs = nice(q.incomoda, INC)
  const quis = nice(q.quimica, QUI).filter(x => x !== 'nenhuma')
  const incTxt = incs.length === 1 ? incs[0] : incs.slice(0, -1).join(', ') + ' e ' + incs[incs.length - 1]
  const tipo = TIPO[q.tipo] || 'do seu tipo'
  const causa = quis.length
    ? `o processo de ${quis.join(' + ')}, junto com o secador/chapinha do dia a dia,`
    : `o calor do secador/chapinha e a falta de um cronograma na ordem certa`
  const p1 = `Oi ${fn}, tudo bem?`
  const p2 = `Analisei com carinho as suas respostas no meu questionário e também as fotos que você enviou — e já deu pra ver claramente o que mais te incomoda hoje: ${incTxt}. Fica tranquila — isso tem solução, e eu vou te guiar passo a passo.`
  const p3 = `Seu cabelo ${tipo} chegou nesse ponto porque ${causa} foram consumindo a hidratação e a força do fio mais rápido do que qualquer máscara solta consegue repor. A questão nunca foi você não se cuidar — era faltar o método certo, na ordem certa.`
  const p4 = analise.carta_foto
  const p5 = `Eu montei pra você um cronograma de 12 semanas que alterna hidratação, nutrição e reconstrução, ancorado exatamente no seu incômodo principal e no que eu enxerguei nas suas fotos. Quanto antes você começar, mais rápido as pontas recuperam e o brilho volta — sem gastar rios de dinheiro em salão. Vem comigo nesses 90 dias!`
  return [p1, p2, p3, p4, p5].join('\n\n') + '\n\nBeijos da Ju 💛'
}

function buildDiagnostico(q) {
  const incs = nice(q.incomoda, INC)
  const quis = nice(q.quimica, QUI).filter(x => x !== 'nenhuma')
  const couro = q.oleosidade === 'oleoso' ? 'couro com tendência oleosa' : q.oleosidade === 'seco' ? 'couro mais seco' : 'couro equilibrado'
  const poro = q.porosidade === 'sim_absorve' ? 'porosidade alta (o fio absorve rápido e perde água rápido)' : q.porosidade === 'nao_demora' ? 'porosidade baixa' : 'porosidade a confirmar'
  return `Pelas suas respostas e fotos: cabelo ${TIPO[q.tipo] || ''} ${q.espessura === 'fino' ? 'de fio fino' : q.espessura === 'grosso' ? 'de fio grosso' : ''}, ${couro}, ${poro}. `
    + `Principais pontos a tratar: ${incs.join(', ')}. `
    + (quis.length ? `Histórico de ${quis.join(', ')} — por isso o foco em repor lipídios e proteína na ordem certa. ` : '')
    + `O plano prioriza ${incs[0] || 'a saúde das pontas'} desde a semana 1.`
}

// ── Cronograma de 12 semanas (idêntico ao determinístico) ────────────────────
const MASKS = { H: 'Máscara de Hidratação', N: 'Máscara de Nutrição', R: 'Máscara de Reconstrução' }
const CICLO = ['H', 'N', 'H', 'R', 'H', 'N', 'H', 'R', 'N', 'H', 'N', 'R']
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
  const couro = q.oleosidade
  const washDays = couro === 'oleoso' ? [1, 3, 5, 7] : couro === 'seco' ? [1, 5] : [1, 3, 5]
  const semanas = []
  for (let w = 1; w <= 12; w++) {
    const mask = MASKS[CICLO[w - 1]]
    const incomoda = Array.isArray(q.incomoda) ? q.incomoda.map(String) : (q.incomoda ? [String(q.incomoda)] : [])
    const temQueda = incomoda.some(x => /queda|cresc/i.test(x))
    const tarefas = []
    washDays.forEach((dia, idx) => {
      const trata = idx % 2 === 0
      // TODA lavagem tem shampoo (regra da Juliane) — couro seco só ganha instrução mais suave.
      tarefas.push({ dia, titulo: 'Shampoo de limpeza', descricao: couro === 'oleoso' ? 'Aplique na raiz, massageie 1–2 min com a polpa dos dedos e enxágue. Pode repetir se o couro estiver muito oleoso.' : couro === 'seco' ? 'Aplique só na raiz e massageie de leve, sem esfregar os comprimentos, e enxágue bem. Toda lavagem leva shampoo — ele limpa o couro; a maciez volta com a máscara logo em seguida.' : 'Aplique na raiz, massageie 1 min e enxágue bem. Não esfregue os comprimentos.' })
      if (temQueda && idx === 0) {
        tarefas.push({ dia, titulo: 'Kit antiqueda (1x na semana)', descricao: 'No dia da lavagem, use o kit antiqueda no couro cabeludo massageando bem por 1–2 min. Pelo menos 1x na semana pra estimular a raiz e reduzir a queda.' })
      }
      if (trata) {
        tarefas.push({ dia, titulo: mask, descricao: `Aplique do comprimento médio até as pontas, longe da raiz. Deixe agir 15 min com touca. Enxágue com água fria pra selar a cutícula.${CICLO[w - 1] === 'R' ? ' Use no máximo 1x na semana pra não endurecer o fio.' : ''}` })
      }
      tarefas.push({ dia, titulo: 'Leave-in de finalização', descricao: 'Nos comprimentos e pontas ainda úmidos, antes de finalizar. Não enxágue — dá deslize, controla o frizz e protege o fio ao longo do dia.' })
      tarefas.push({ dia, titulo: 'Óleo de Mirra nas pontas', descricao: '2–3 gotas nas pontas úmidas, depois do leave-in. Não enxágue — sela a umidade e dá brilho.' })
      tarefas.push({ dia, titulo: 'Tônico Vello no couro', descricao: 'Aplique o Soro Vello direto no couro limpo e massageie 1 min com a polpa dos dedos. Não enxágue — fortalece a raiz e estimula o crescimento.' })
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

// ── REST ─────────────────────────────────────────────────────────────────────
const H = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json' }
async function rest(method, path, body, prefer = 'return=minimal') {
  const r = await fetch(`${BASE}/rest/v1/${path}`, { method, headers: { ...H, Prefer: prefer }, body: body ? JSON.stringify(body) : undefined })
  const txt = await r.text()
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${txt.slice(0, 200)}`)
  return txt ? JSON.parse(txt) : null
}

async function run(dry, onlyId) {
  const ids = Object.keys(ANALISES).filter(id => !onlyId || id === onlyId)
  // puxa profiles (quiz + fotos) dos alvos
  const prof = await rest('GET', `profiles?id=in.(${ids.join(',')})&select=id,full_name,hair_type,photo_url,quiz_answers,plan_status`, null, 'return=representation')
  for (const row of prof) {
    const q = row.quiz_answers || {}
    const analise = ANALISES[row.id]
    const { produtos, antiqueda } = pickProdutos(q)
    const diarios = ['Óleo de Mirra Reparador: 2–3 gotas nas pontas com o cabelo úmido, todos os dias — nunca na raiz.']
    diarios.push('Tônico Vello (Soro Vello): aplique no couro cabeludo e massageie com as pontas dos dedos, todos os dias. Não precisa enxaguar — fortalece a raiz.')
    if (antiqueda) diarios.push('100Tímetros: 1 cápsula por dia, sempre no mesmo horário, de preferência com uma refeição.')
    const carta = buildCarta(q, row.full_name, analise)
    const diagnostico = buildDiagnostico(q)
    const semanas = buildSemanas(q)
    const NOTA = `${analise.carta_foto}\n\nOs produtos indicados são os que eu uso e confio nos resultados. Podem ser substituídos por produtos de outras marcas, desde que cumpram a mesma função.`

    if (dry) {
      console.log('\n══════════', row.full_name, `(${row.id}) status=${row.plan_status}`, '══════════')
      console.log('ANÁLISE FOTO:\n' + analise.avaliacao)
      console.log('\nCARTA:\n' + carta)
      console.log('\nDIAGNÓSTICO:', diagnostico)
      console.log('PRODUTOS:', produtos.map(p => p.produto_id.slice(0, 8)).join(', '), '| antiqueda:', antiqueda)
      console.log('SEMANAS:', semanas.length, '| S1:', semanas[0].tarefas.map(t => `d${t.dia} ${t.titulo}`).join(' / '))
      continue
    }
    // 1) photo_analyses (limpa e insere)
    await rest('DELETE', `photo_analyses?user_id=eq.${row.id}`)
    await rest('POST', 'photo_analyses', [{
      user_id: row.id, photo_url: row.photo_url,
      brilho_score: analise.scores.brilho, hidratacao_score: analise.scores.hidratacao,
      frizz_score: analise.scores.frizz, pontas_score: analise.scores.pontas,
      crescimento_estimado_cm: analise.scores.cresc_cm,
      avaliacao_texto: analise.avaliacao,
      raw_response: { source: 'opus-vision-manual', analise_foto: { observacoes: analise.avaliacao, scores: analise.scores } },
      analyzed_at: new Date().toISOString(),
    }])
    // 2) hair_plans (12 semanas)
    const rows = semanas.map(s => ({
      user_id: row.id, week_number: s.semana, focus: s.foco,
      tasks: s.tarefas.map(t => ({ day: t.dia, title: t.titulo, description: t.descricao || '' })).sort((a, b) => a.day - b.day),
      products: s.produtos, tips: s.dica ? [s.dica] : [], juliane_notes: s.semana === 1 ? NOTA : null,
    }))
    await rest('DELETE', `hair_plans?user_id=eq.${row.id}`)
    await rest('POST', 'hair_plans', rows)
    // 3) profiles → ready
    await rest('PATCH', `profiles?id=eq.${row.id}`, {
      daily_rituals: diarios, carta_ju: carta, recommended_products: produtos,
      hair_type: q.tipo || row.hair_type, plan_status: 'ready', plan_released_at: new Date().toISOString(),
    })
    console.log('✓ salvo (com foto):', row.full_name, row.id)
  }
  console.log(dry ? '\n(DRY — nada gravado)' : `\n${prof.length} plano(s) com foto salvos.`)
}

const flags = process.argv.slice(2)
const dry = flags.includes('--dry')
const onlyId = flags.find(f => f.startsWith('--only='))?.split('=')[1]
run(dry, onlyId).catch(e => { console.error('ERRO:', e.message); process.exit(1) })
