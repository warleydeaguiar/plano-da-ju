// TESTE da geração "constrained" no OpenRouter:
// a IA (Haiku) devolve um JSON PEQUENO (códigos + carta + análise da foto);
// o TEMPLATE monta as 12 semanas. Mede tokens/custo e compara com o modelo atual.
// Uso: node test-constrained.mjs <userId> [--model=anthropic/claude-haiku-4.5]
import { readFileSync } from 'node:fs'

const BASE = 'https://db.planodaju.julianecost.com'
const env = readFileSync(new URL('../../apps/web/.env.local', import.meta.url).pathname, 'utf8')
const SK = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim().replace(/^["']|["']$/g, '')
const OR = env.match(/OPENROUTER_API_KEY=(.+)/)[1].trim().replace(/^["']|["']$/g, '')

const userId = process.argv[2]
const model = process.argv.find(a => a.startsWith('--model='))?.split('=')[1] || 'anthropic/claude-haiku-4.5'
if (!userId) { console.error('uso: node test-constrained.mjs <userId>'); process.exit(1) }

// ── Núcleo de produtos Ybera (o AI escolhe por CÓDIGO curto, não UUID) ────────
const PROD = {
  cem:     { id: '7e69b7f9-94f1-4aec-91b8-d0b642ff98e8', nome: '100Timetros 90 Cápsulas Softgel', papel: 'antiqueda (queda/crescimento) — cápsula oral' },
  kit:     { id: 'c2b25cfb-0317-41e8-8dce-57e6eef9b6e5', nome: 'Kit Cuidados Profundos', papel: 'cronograma: 3 máscaras H/N/R' },
  oleo:    { id: 'e5a86346-1a64-470a-8f2c-4b9cee38c2a6', nome: 'Óleo de Mirra Reparador 60ml', papel: 'selagem/nutrição diária das pontas' },
  shampoo: { id: '5516342b-0a36-4fae-afc3-6b4d83a88b76', nome: 'Shampoo Multifunção 500ml Cuidados Profundos', papel: 'limpeza' },
}

// ── PROMPT constrained: pede SÓ decisões + textos únicos (nada de 12 semanas) ─
const PROMPT = `Você é a Juliane Cost, especialista capilar. Analise a FOTO (se houver) e o QUIZ da cliente e DECIDA o tratamento. NÃO escreva as 12 semanas — só devolva as decisões e os textos únicos abaixo. O sistema monta o cronograma a partir dos seus códigos.

CÓDIGOS DE MÁSCARA (cronograma): H=Hidratação (repõe água/maciez/brilho), N=Nutrição (repõe lipídios, controla frizz), R=Reconstrução (repõe proteína, p/ quebra/química — nunca em excesso).
Monte "cronograma" = 12 letras (uma por semana), avançando a rotação conforme o incômodo principal:
- pontas/ressecamento/porosidade alta → foco H+N, pouca R (ex.: H N H N H R ...).
- quebra/química/dano (loiro, progressiva) → foco R (ex.: R H N R H N ...).
- frizz/volume → equilíbrio (H N R H N R ...).
- saudável/manutenção → H N H R ...
Semana 12 SEMPRE termina com R (reconstrução final + selagem).

COURO → "couro" e "lavagens_semana": oleoso=lava quase todo dia (lavagens_semana 4-7); normal=3; seco=2 (co-wash nos dias extras).

PRODUTOS (escolha 2-4 CÓDIGOS do núcleo, âncora primeiro): cem (antiqueda — só se incômodo tem queda/crescimento/quebra), kit (cronograma de máscaras — quase sempre), oleo (pontas/nutrição — quase sempre), shampoo (limpeza — 1 só).

REGRAS: só fale de problema que ESTÁ no quiz ("incomoda") ou que dá pra VER na foto — nunca invente caspa/oleosidade/loiro. Carta calorosa em 1ª pessoa (a Juliane), NUNCA diga que é IA.

RESPONDA SOMENTE JSON válido, sem markdown:
{
  "tipo_cabelo": "Liso|Ondulado|Cacheado|Crespo",
  "couro": "seco|normal|oleoso",
  "lavagens_semana": 2,
  "incomodo_principal": "queda|crescimento|frizz|quebra|pontas|volume|ressecamento",
  "cronograma": ["H","N","H","R","H","N","H","R","N","H","N","R"],
  "produtos": ["cem","kit","oleo","shampoo"],
  "diagnostico": "2-3 frases ligando foto+quiz e o foco nº1",
  "analise_foto": { "frizz_score": 1-5, "brilho_score": 1-5, "hidratacao_score": 1-5, "pontas_score": 1-5, "porosidade_aparente": "baixa|média|alta", "observacoes": "o que dá pra VER na foto (2-4 frases, tom da Ju falando com a cliente)" },
  "carta_ju": "Oi {nome}, tudo bem?\\n\\n... (5-8 frases, parágrafos curtos com \\n\\n, termine com 'Beijos da Ju 💛')"
}`

// ── TEMPLATE que monta as 12 semanas a partir dos códigos da IA ───────────────
const MASKNAME = { H: 'Máscara de Hidratação', N: 'Máscara de Nutrição', R: 'Máscara de Reconstrução' }
const FOCO_BASE = {
  H: 'HIDRATAÇÃO — repor água, maciez e brilho nos comprimentos e pontas.',
  N: 'NUTRIÇÃO — repor os lipídios (óleos naturais) que a química e o calor tiraram, controlando o frizz.',
  R: 'RECONSTRUÇÃO — repor proteína e devolver força ao fio (combate a quebra). Só 1x no bloco.',
}
function washDaysFor(couro, n) {
  if (couro === 'oleoso') return [1, 3, 5, 7].slice(0, Math.max(3, Math.min(4, n || 4)))
  if (couro === 'seco') return [1, 5]
  return [1, 3, 5]
}
function buildSemanas(couro, lavagens, cronograma) {
  const washDays = washDaysFor(couro, lavagens)
  return cronograma.map((code, i) => {
    const w = i + 1
    const mask = MASKNAME[code] || MASKNAME.H
    let foco = FOCO_BASE[code] || FOCO_BASE.H
    if (w === 1) foco = 'Diagnóstico + ' + foco
    if (w === 12) foco += ' Resultado consolidado — compare com o dia 1!'
    const tarefas = []
    washDays.forEach((dia, idx) => {
      const trata = idx % 2 === 0
      const coWash = couro === 'seco' && idx > 0
      tarefas.push(coWash
        ? { dia, titulo: 'Lavagem suave (co-wash)', descricao: 'Só com a máscara/condicionador nos comprimentos, sem shampoo, pra não ressecar o couro seco.' }
        : { dia, titulo: 'Shampoo de limpeza', descricao: couro === 'oleoso' ? 'Na raiz, massageie 1–2 min e enxágue. Pode repetir se estiver muito oleoso.' : 'Na raiz, massageie 1 min e enxágue. Não esfregue os comprimentos.' })
      if (trata) tarefas.push({ dia, titulo: mask, descricao: `Do comprimento médio às pontas, longe da raiz. 15 min com touca, enxágue com água fria.${code === 'R' ? ' Máximo 1x na semana.' : ''}` })
      tarefas.push({ dia, titulo: 'Óleo de Mirra nas pontas', descricao: '2–3 gotas nas pontas úmidas, antes do secador. Não enxágue.' })
    })
    const dica = code === 'R' ? 'Proteína em excesso endurece — reconstrução entra 1x por bloco, nunca toda semana.'
      : code === 'N' ? 'Nutrição penetra melhor com toalha quente sobre a touca.'
      : 'Água fria no fim do enxágue fecha a cutícula e dá mais brilho.'
    return { semana: w, foco, tarefas: tarefas.sort((a, b) => a.dia - b.dia), produtos: ['Shampoo Multifunção', mask, 'Óleo de Mirra'], dica }
  })
}

// ── REST helper ───────────────────────────────────────────────────────────────
async function rest(path) {
  const r = await fetch(`${BASE}/rest/v1/${path}`, { headers: { apikey: SK, Authorization: `Bearer ${SK}` } })
  if (!r.ok) throw new Error(`${path} → ${r.status}`)
  return r.json()
}

// ── main ─────────────────────────────────────────────────────────────────────
const [prof] = await rest(`profiles?id=eq.${userId}&select=full_name,quiz_answers,photo_url,photo_back_url,photo_root_url`)
if (!prof) { console.error('perfil não encontrado'); process.exit(1) }
const q = prof.quiz_answers || {}
const fotos = [prof.photo_url, prof.photo_back_url, prof.photo_root_url].filter(Boolean)

const catalogo = Object.entries(PROD).map(([c, p]) => `- ${c} = ${p.nome} (${p.papel})`).join('\n')
const quizTxt = `\n\nCLIENTE: ${prof.full_name}\nINCÔMODO PRINCIPAL (ordem): ${JSON.stringify(q.incomoda)}\nQUIZ:\n${JSON.stringify(q, null, 2)}\n\nNÚCLEO DE PRODUTOS:\n${catalogo}`

const content = []
for (const url of fotos) content.push({ type: 'image_url', image_url: { url } })
if (fotos.length > 1) content.push({ type: 'text', text: `${fotos.length} fotos do MESMO cabelo (frente/costas/raiz). Analise todas.` })
if (fotos.length === 0) content.push({ type: 'text', text: 'SEM FOTO: baseie no quiz; em analise_foto use estimativa conservadora.' })
content.push({ type: 'text', text: PROMPT + quizTxt })

console.log(`\n▶ Modelo: ${model} · ${fotos.length} foto(s) · cliente ${prof.full_name}\n`)
const t0 = Date.now()
const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${OR}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://planodaju.julianecost.com', 'X-Title': 'Plano da Ju (teste constrained)' },
  body: JSON.stringify({ model, max_tokens: 2000, messages: [{ role: 'user', content }] }),
})
const j = await res.json()
if (!res.ok) { console.error('ERRO OpenRouter', res.status, JSON.stringify(j).slice(0, 400)); process.exit(1) }
const dt = ((Date.now() - t0) / 1000).toFixed(1)
const txt = j.choices?.[0]?.message?.content || ''
const out = JSON.parse(txt.match(/\{[\s\S]*\}/)[0])

console.log('═══ JSON PEQUENO DA IA ═══')
console.log('tipo:', out.tipo_cabelo, '| couro:', out.couro, '| lavagens/sem:', out.lavagens_semana, '| incômodo:', out.incomodo_principal)
console.log('cronograma:', out.cronograma.join(' '))
console.log('produtos:', out.produtos.join(', '))
console.log('\nDIAGNÓSTICO:', out.diagnostico)
console.log('\nANÁLISE FOTO:', out.analise_foto?.observacoes)
console.log('scores:', JSON.stringify(out.analise_foto))
console.log('\nCARTA:\n' + out.carta_ju)

const semanas = buildSemanas(out.couro, out.lavagens_semana, out.cronograma)
console.log('\n═══ SEMANAS MONTADAS PELO TEMPLATE (a partir dos códigos) ═══')
console.log('S1:', semanas[0].foco, '\n   ', semanas[0].tarefas.map(t => `d${t.dia} ${t.titulo}`).join(' / '))
console.log('S4:', semanas[3].foco)
console.log('S12:', semanas[11].foco)
console.log('total semanas:', semanas.length)

// ── Custo ─────────────────────────────────────────────────────────────────────
const u = j.usage || {}
console.log('\n═══ TOKENS / CUSTO ═══')
console.log(`tempo: ${dt}s | prompt_tokens: ${u.prompt_tokens} | completion_tokens: ${u.completion_tokens} | total: ${u.total_tokens}`)
// preços aprox OpenRouter (USD/1M): Haiku 4.5 in 1.0 / out 5.0 ; Sonnet 4.6 in 3.0 / out 15.0
const PR = { 'anthropic/claude-haiku-4.5': [1.0, 5.0], 'anthropic/claude-sonnet-4-6': [3.0, 15.0] }
const [pin, pout] = PR[model] || [3.0, 15.0]
const custoUSD = (u.prompt_tokens * pin + u.completion_tokens * pout) / 1e6
const BRL = 5.6
console.log(`custo estimado: US$ ${custoUSD.toFixed(5)}  ≈  R$ ${(custoUSD * BRL).toFixed(4)} / plano`)
console.log(`(cost real reportado pelo OpenRouter: ${j.usage?.cost != null ? 'US$ ' + j.usage.cost : 'n/d'})`)
