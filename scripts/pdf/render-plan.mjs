// Geração do PDF do Plano Capilar — orquestração.
//   node scripts/pdf/render-plan.mjs <plan.json> <saida.pdf> [dataCompraISO]
//
// Faz: otimiza todas as imagens (sharp → data URI, corta o peso ~10x), carrega as
// dicas universais do módulo real, calcula a data de retorno (+90d) e renderiza o
// PDF com o Chrome headless. Sem dependência de URL remota no momento do render
// (tudo embutido) → rápido e reproduzível.

import sharp from 'sharp'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { buildHtml } from './template.mjs'

const ROOT = new URL('../../', import.meta.url).pathname

// ── Imagens: fetch + resize + data URI (com cache por url|width) ──────────────
const imgCache = new Map()
async function optimize(url, width) {
  if (!url) return ''
  const key = `${url}|${width}`
  if (imgCache.has(key)) return imgCache.get(key)
  try {
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer())
    const out = await sharp(buf).rotate().resize({ width, withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true }).toBuffer()
    const uri = `data:image/jpeg;base64,${out.toString('base64')}`
    imgCache.set(key, uri)
    return uri
  } catch (e) {
    console.warn(`  ⚠ imagem falhou (${url}): ${e.message}`)
    return ''
  }
}

// ── Dicas universais: lê do módulo real (fonte única) ────────────────────────
function loadDicas() {
  try {
    const src = readFileSync(`${ROOT}apps/web/lib/dicas-universais.ts`, 'utf8')
    const m = src.match(/DICAS_UNIVERSAIS[^=]*=\s*(\[[\s\S]*?\]);/)
    if (!m) return []
    // eslint-disable-next-line no-eval
    return eval(`(${m[1]})`)
  } catch { return [] }
}

// ── Data de retorno (+90 dias) formatada em pt-BR ────────────────────────────
function retornoDate(baseISO) {
  const base = baseISO ? new Date(baseISO) : new Date()
  const d = new Date(base.getTime() + 90 * 86400_000)
  const fmt = (opts) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', ...opts }).format(d)
  return {
    formatada: fmt({ day: '2-digit', month: 'long', year: 'numeric' }),
    diaSemana: fmt({ weekday: 'long' }),
  }
}

// ── Chrome headless ──────────────────────────────────────────────────────────
function findChrome() {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ]
  for (const c of candidates) if (existsSync(c)) return c
  throw new Error('Chrome não encontrado')
}

function renderPdf(html, outPath) {
  const tmp = outPath.replace(/\.pdf$/, '.html')
  writeFileSync(tmp, html)
  execFileSync(findChrome(), [
    '--headless', '--disable-gpu', '--no-sandbox', '--no-pdf-header-footer',
    `--print-to-pdf=${outPath}`, `file://${tmp}`,
  ], { stdio: 'ignore' })
}

// ── Monta os dados do plano (a partir do JSON já existente) ───────────────────
async function buildData(plan, fresh, produtos, baseISO) {
  const JU = 'https://db.planodaju.julianecost.com/storage/v1/object/public/ju-assets'
  const af = (fresh && fresh.analise_foto) || {}
  const scores = Object.keys(af).length ? {
    frizz: af.frizz_score, brilho: af.brilho_score, hidratacao: af.hidratacao_score,
    pontas: af.pontas_score, porosidade: af.porosidade_aparente,
  } : null

  // Fotos da Ju (marca — fixas) e da cliente, otimizadas em paralelo
  const [cover, carta, prodDivider, cronoDivider, footer] = await Promise.all([
    optimize(`${JU}/ju-1.jpg`, 900), optimize(`${JU}/ju-2.jpg`, 320),
    optimize(`${JU}/ju-3.jpg`, 760), optimize(`${JU}/ju-5.jpg`, 760), optimize(`${JU}/ju-4.jpg`, 900),
  ])
  const fotoDefs = [['Frente', plan.foto_frente], ['Costas', plan.foto_costas], ['Raiz', plan.foto_raiz]].filter(f => f[1])
  const fotosCliente = await Promise.all(fotoDefs.map(async ([label, url]) => ({ label, src: await optimize(url, 850) })))

  const ytId = (u) => { const m = String(u || '').match(/(?:shorts\/|watch\?v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/); return m ? m[1] : null }
  const produtosOut = await Promise.all((produtos || []).map(async p => {
    if (!p.principal) return p
    const vid = ytId(p.principal.video)
    return {
      ...p,
      principal: {
        ...p.principal,
        image: await optimize(p.principal.image, 240),
        // link do vídeo da Juliane + thumbnail do YouTube (embutida otimizada)
        videoUrl: p.principal.video || null,
        videoThumb: vid ? await optimize(`https://img.youtube.com/vi/${vid}/hqdefault.jpg`, 240) : null,
      },
    }
  }))

  return {
    nome: plan.nome,
    carta: plan.carta || (fresh && fresh.carta_ju) || '',
    diagnostico: (fresh && fresh.diagnostico) || '',
    scores,
    fotosCliente,
    produtos: produtosOut,
    semanas: plan.semanas || [],
    ritualDiario: plan.diarios || (fresh && fresh.diarios) || [],
    dicas: loadDicas(),
    dataRetorno: retornoDate(baseISO),
    wa: '553171260408',
    ju: { cover, carta, prodDivider, cronoDivider, footer },
  }
}

// ── main ─────────────────────────────────────────────────────────────────────
const [, , planPath, outPath, baseISO] = process.argv
if (!planPath || !outPath) {
  console.error('uso: node render-plan.mjs <plan.json> <saida.pdf> [dataCompraISO]')
  process.exit(1)
}
const dir = planPath.replace(/[^/]+$/, '')
const plan = JSON.parse(readFileSync(planPath, 'utf8'))
let fresh = {}
try { fresh = (JSON.parse(readFileSync(`${dir}julia_fresh.json`, 'utf8')).plano_completo) || {} } catch {}
let produtos = plan.recommended || []
try { produtos = JSON.parse(readFileSync(`${dir}julia_products.json`, 'utf8')) } catch {}

console.log('→ otimizando imagens…')
const data = await buildData(plan, fresh, produtos, baseISO)
console.log('→ montando HTML…')
const html = buildHtml(data)
console.log('→ renderizando PDF…')
renderPdf(html, outPath)
const kb = Math.round(readFileSync(outPath).length / 1024)
console.log(`✓ ${outPath} — ${kb} KB (${(kb / 1024).toFixed(1)} MB)`)
