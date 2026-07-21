// Renderiza uma AMOSTRA do PDF a partir de uma cliente real do banco.
// Uso: node scripts/pdf/render-sample.mjs <userId> <saida.pdf>
import sharp from 'sharp'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { buildHtml } from './template.mjs'

const BASE = 'https://db.planodaju.julianecost.com'
const SK = readFileSync(new URL('../../apps/web/.env.local', import.meta.url).pathname, 'utf8')
  .match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim().replace(/^["']|["']$/g, '')
const JU = `${BASE}/storage/v1/object/public/ju-assets`

const imgCache = new Map()
async function optimize(url, width) {
  if (!url) return ''
  const key = `${url}|${width}`
  if (imgCache.has(key)) return imgCache.get(key)
  try {
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer())
    const out = await sharp(buf).rotate().resize({ width, withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toBuffer()
    const uri = `data:image/jpeg;base64,${out.toString('base64')}`
    imgCache.set(key, uri); return uri
  } catch (e) { console.warn(`  ⚠ imagem falhou (${url}): ${e.message}`); return '' }
}
function retornoDate(baseISO) {
  const base = baseISO ? new Date(baseISO) : new Date()
  const d = new Date(base.getTime() + 90 * 86400_000)
  const fmt = (o) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', ...o }).format(d)
  return { formatada: fmt({ day: '2-digit', month: 'long', year: 'numeric' }), diaSemana: fmt({ weekday: 'long' }) }
}
function findChrome() {
  for (const c of ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium']) if (existsSync(c)) return c
  throw new Error('Chrome não encontrado')
}
function renderPdf(html, outPath) {
  const tmp = resolve(outPath.replace(/\.pdf$/, '.html')); const abs = resolve(outPath); writeFileSync(tmp, html)
  execFileSync(findChrome(), ['--headless', '--disable-gpu', '--no-sandbox', '--no-pdf-header-footer', `--print-to-pdf=${abs}`, `file://${tmp}`], { stdio: 'ignore' })
}
async function rest(path) {
  const r = await fetch(`${BASE}/rest/v1/${path}`, { headers: { apikey: SK, Authorization: `Bearer ${SK}` } })
  if (!r.ok) throw new Error(`${path} → ${r.status}`); return r.json()
}

const [, , userId, outPath] = process.argv
if (!userId || !outPath) { console.error('uso: render-sample.mjs <userId> <saida.pdf>'); process.exit(1) }

const [prof] = await rest(`profiles?id=eq.${userId}&select=full_name,carta_ju,daily_rituals,recommended_products,quiz_answers,photo_url,photo_back_url,photo_root_url`)
const plans = await rest(`hair_plans?user_id=eq.${userId}&select=week_number,focus,tasks,tips&order=week_number`)
const [pa] = await rest(`photo_analyses?user_id=eq.${userId}&select=brilho_score,hidratacao_score,frizz_score,pontas_score,avaliacao_texto,raw_response&order=analyzed_at&limit=1`)

// Produtos: resolve nomes/imagens/links a partir de recommended_products
const rec = Array.isArray(prof.recommended_products) ? prof.recommended_products : []
const ids = [...new Set(rec.flatMap(p => [p.produto_id, p.alternativa_id]).filter(Boolean))]
const prods = ids.length ? await rest(`products?id=in.(${ids.join(',')})&select=id,name,brand,image_url,affiliate_url,video_url`) : []
const byId = new Map(prods.map(p => [p.id, p]))

const produtos = await Promise.all(rec.map(async r => {
  const pr = byId.get(r.produto_id); if (!pr) return null
  const alt = r.alternativa_id ? byId.get(r.alternativa_id) : null
  const ytId = (u) => { const m = String(u || '').match(/(?:shorts\/|watch\?v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/); return m ? m[1] : null }
  const vid = ytId(pr.video_url)
  return {
    motivo: r.motivo || '',
    principal: {
      name: pr.name, brand: pr.brand || 'Ybera',
      image: await optimize(pr.image_url, 240), url: pr.affiliate_url || null,
      videoUrl: pr.video_url || null,
      videoThumb: vid ? await optimize(`https://img.youtube.com/vi/${vid}/hqdefault.jpg`, 240) : null,
    },
    alternativa: alt ? { name: alt.name } : null, combos: [],
  }
}))

// Scores 1–5 → 0–100 pras barras do PDF
const af = pa?.raw_response?.analise_foto || {}
const sc = (v) => (v == null ? undefined : Math.round(Number(v) * 20))
const scores = pa ? {
  frizz: sc(pa.frizz_score), brilho: sc(pa.brilho_score), hidratacao: sc(pa.hidratacao_score),
  pontas: sc(pa.pontas_score), porosidade: af.porosidade_aparente || af.scores?.porosidade || null,
} : null

const [cover, carta, prodDivider, cronoDivider, footer] = await Promise.all([
  optimize(`${JU}/ju-1.jpg`, 900), optimize(`${JU}/ju-2.jpg`, 320),
  optimize(`${JU}/ju-3.jpg`, 760), optimize(`${JU}/ju-5.jpg`, 760), optimize(`${JU}/ju-4.jpg`, 900),
])
const fotoDefs = [['Frente', prof.photo_url], ['Costas', prof.photo_back_url], ['Raiz', prof.photo_root_url]].filter(f => f[1])
const fotosCliente = await Promise.all(fotoDefs.map(async ([label, url]) => ({ label, src: await optimize(url, 850) })))

const data = {
  nome: prof.full_name,
  carta: prof.carta_ju || '',
  diagnostico: pa?.avaliacao_texto || '',
  scores, fotosCliente, produtos: produtos.filter(Boolean),
  semanas: plans.map(w => ({ n: w.week_number, foco: w.focus, tasks: w.tasks || [], tips: w.tips || [] })),
  ritualDiario: prof.daily_rituals || [],
  couro: prof.quiz_answers?.oleosidade || 'normal',
  dataRetorno: retornoDate(null),
  wa: '553171260408',
  ju: { cover, carta, prodDivider, cronoDivider, footer },
}

console.log('→ montando HTML…')
const html = buildHtml(data)
console.log('→ renderizando PDF…')
renderPdf(html, outPath)
console.log(`✓ ${outPath} — ${Math.round(readFileSync(outPath).length / 1024)} KB`)
