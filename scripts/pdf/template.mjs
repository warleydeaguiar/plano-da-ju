// Template do PDF do Plano Capilar — função PURA (sem I/O).
// Recebe `data` já com imagens resolvidas (data URIs otimizados) e devolve o HTML.
// A orquestração (fetch/otimização de imagem, datas, dados do banco) fica em render-plan.mjs.

const IG = 'https://instagram.com/julianecost'
const GRUPO = 'https://planodaju.julianecost.com/g/entrar'
const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function normTasks(tasks) {
  return (tasks || []).map((t, i) =>
    typeof t === 'string'
      ? { day: i + 1, title: t, description: '' }
      : { day: Number(t.day || i + 1), title: t.title || '', description: t.description || '' }
  ).sort((a, b) => a.day - b.day)
}

export function buildHtml(data) {
  const ju = data.ju || {}
  const first = data.primeiroNome || (data.nome || 'Cliente').split(' ')[0]

  const cover = () => `
    <section class="sheet cover">
      <img class="cover-photo" src="${ju.cover}"/>
      <div class="cover-scrim"></div>
      <div class="cover-txt">
        <div class="cover-kicker">Plano Capilar Personalizado</div>
        <h1>${esc(first)}</h1>
        <div class="cover-sub">Feito à mão pela <b>Juliane Cost</b><br>Tricologista · Especialista capilar Ybera Paris</div>
        <div class="cover-badge">💛 sua transformação em 90 dias</div>
      </div>
    </section>`

  const carta = () => {
    if (!data.carta?.trim()) return ''
    const ps = data.carta.split('\n').map(p => p.trim()).filter(Boolean).map(p => `<p>${esc(p)}</p>`).join('')
    return `
    <section class="sheet pad">
      <div class="miniju"><img src="${ju.carta}"/></div>
      <div class="label center">💌 Mensagem da Ju para você</div>
      <div class="carta">${ps}</div>
    </section>`
  }

  const bar = (label, v, invert = false) => {
    const val = typeof v === 'number' ? v : 0
    return `<div class="scorerow"><span class="sl">${esc(label)}</span>
      <span class="track"><span class="fill" style="width:${Math.max(4, Math.min(100, val))}%"></span></span>
      <span class="sv">${Math.round(val)}</span></div>`
  }

  const analise = () => {
    const fotos = data.fotosCliente || []
    if (!fotos.length && !data.diagnostico) return ''
    const fotosHtml = fotos.map(f => `<figure class="bigfoto"><img src="${f.src}"/><figcaption>${esc(f.label)}</figcaption></figure>`).join('')
    const s = data.scores
    const scores = s ? `<div class="scores">
      ${bar('Frizz', s.frizz, true)}${bar('Brilho', s.brilho)}${bar('Hidratação', s.hidratacao)}${bar('Pontas', s.pontas)}
      <div class="poro">Porosidade aparente: <b>${esc(s.porosidade || '—')}</b></div>
    </div>` : ''
    const diag = data.diagnostico ? `<div class="diag">“${esc(data.diagnostico)}”<div class="diag-by">— Juliane, sobre o seu cabelo</div></div>` : ''
    return `
    <section class="sheet pad break-before">
      <div class="label">Análise do seu cabelo</div>
      <div class="bigfotos">${fotosHtml}</div>
      ${diag}${scores}
    </section>`
  }

  const produtos = () => {
    const cards = (data.produtos || []).map(p => {
      const pr = p.principal || {}
      const img = pr.image ? `<img src="${pr.image}"/>` : '<div class="noimg">🧴</div>'
      const alt = p.alternativa ? `<div class="alt">Alternativa mais em conta: <b>${esc(p.alternativa.name)}</b></div>` : ''
      const combos = (p.combos || []).map(c => `<a class="combo" href="${esc(c.url)}">📦 ${esc(c.name)} — comprar</a>`).join('')
      const combosBox = combos ? `<div class="combos"><div class="combos-h">Compre em combo e economize</div>${combos}</div>` : ''
      const buy = pr.url ? `<a class="buy" href="${esc(pr.url)}">Comprar ${esc(pr.name)} →</a>` : ''
      return `<div class="prod">
        <div class="prod-top"><div class="prod-img">${img}</div>
          <div><div class="prod-brand">${esc(pr.brand || 'Ybera')}</div>
          <div class="prod-name">${esc(pr.name)}</div>
          <div class="prod-why">${esc(p.motivo)}</div></div></div>
        ${alt}${combosBox}${buy}</div>`
    }).join('')
    return `
    <section class="sheet pad break-before">
      <div class="ju-divider"><img src="${ju.prodDivider}"/><div class="ju-divider-txt">Os produtos que <b>eu uso e confio</b> — escolhidos a dedo pro seu cabelo</div></div>
      <div class="label">Produtos indicados pra você</div>
      ${cards}
    </section>`
  }

  // NOVO (ponto 4): compre os produtos + envie o código de rastreio pra Ju
  const compraRastreio = () => {
    const wa = `https://wa.me/${data.wa}?text=${encodeURIComponent(`Oi Ju! Comprei os produtos do meu plano. Meu código de rastreio é: `)}`
    return `
    <section class="sheet pad break-before">
      <div class="label center">🛍️ O próximo passo é seu</div>
      <div class="cta-card">
        <div class="cta-h">Garanta seus produtos pra começar</div>
        <p>Seu cronograma só funciona de verdade com os produtos certos. Compre os itens indicados
        acima usando os links — leva pouco tempo e é o que dá o pontapé inicial na sua transformação.</p>
        <div class="cta-track">
          <div class="cta-track-h">📦 Me manda o código de rastreio</div>
          <p>Assim que comprar, me envie o <b>código de rastreio</b> no WhatsApp. Assim eu consigo saber
          mais ou menos quando os produtos chegam na sua casa e quando seu tratamento vai começar — e já
          fico de olho pra te acompanhar desde o primeiro dia.</p>
          <a class="cta-btn" href="${wa}">Enviar código de rastreio no WhatsApp</a>
        </div>
      </div>
    </section>`
  }

  const cronograma = () => {
    const intro = `
    <section class="sheet pad break-before">
      <div class="ju-divider"><img src="${ju.cronoDivider}"/><div class="ju-divider-txt">Seu cronograma de <b>12 semanas</b> — uma por vez, sem pressa 💛</div></div>
    </section>`
    const weeks = (data.semanas || []).map(w => {
      const byDay = {}
      normTasks(w.tasks).forEach(t => { (byDay[t.day] = byDay[t.day] || []).push(t) })
      const days = Object.keys(byDay).map(Number).sort((a, b) => a - b).map(day => {
        const items = byDay[day].map(t => `<div class="task"><span class="dot"></span><div><div class="task-t">${esc(t.title)}</div>${t.description ? `<div class="task-d">${esc(t.description)}</div>` : ''}</div></div>`).join('')
        return `<div class="cday"><div class="cday-h">${esc(DIAS[(day - 1) % 7])}</div>${items}</div>`
      }).join('')
      const tipRaw = Array.isArray(w.tips) ? w.tips[0] : w.tips
      const tip = tipRaw ? `<div class="tip">💡 ${esc(tipRaw)}</div>` : ''
      return `<section class="sheet pad break-before week-page">
        <div class="wk-badge">Semana ${esc(w.n)} de 12</div>
        <div class="wk-foco">${esc(w.foco)}</div>
        ${days}${tip}
      </section>`
    }).join('')
    return intro + weeks
  }

  const ritual = () => {
    if (!(data.ritualDiario || []).length) return ''
    const items = data.ritualDiario.map(d => `<li>${esc(d)}</li>`).join('')
    return `<section class="sheet pad break-before">
      <div class="label center">🫗 Todo dia, sem falta</div>
      <div class="ritual"><ul>${items}</ul></div></section>`
  }

  // NOVO (ponto 1): dicas universais da Ju (valem pra todas)
  const dicas = () => {
    const list = data.dicas || []
    if (!list.length) return ''
    const cards = list.map(d => `<div class="dica">
      <div class="dica-h"><span class="dica-e">${d.emoji}</span>${esc(d.titulo)}</div>
      <ul>${d.itens.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
    </div>`).join('')
    return `<section class="sheet pad break-before">
      <div class="label center">✨ Dicas de ouro da Ju</div>
      <p class="dicas-intro">Valem pra qualquer cabelo, todos os dias — os cuidados que eu passo pra todas as minhas meninas:</p>
      ${cards}
    </section>`
  }

  // NOVO (ponto 3): data de retorno com a Tricologista Juliane (+90 dias)
  const retorno = () => {
    const r = data.dataRetorno
    if (!r) return ''
    return `<section class="sheet pad break-before">
      <div class="label center">📅 Sua data de retorno</div>
      <div class="retorno-card">
        <div class="retorno-icon">🗓️</div>
        <div class="retorno-h">Seu retorno com a Tricologista Juliane</div>
        <p>Acompanhar a evolução é <b>essencial</b>. Depois de 90 dias seguindo o plano, é hora de
        reavaliarmos juntas seu cabelo, medir o progresso e ajustar os próximos passos.</p>
        <div class="retorno-data">
          <div class="retorno-data-label">Marque na agenda</div>
          <div class="retorno-data-val">${esc(r.formatada)}</div>
          <div class="retorno-data-sub">${esc(r.diaSemana)}</div>
        </div>
        <p class="retorno-note">Um pouco antes da data eu te chamo pra combinarmos o retorno. Pode contar comigo até lá 💛</p>
      </div>
    </section>`
  }

  const footer = () => `
    <section class="sheet cover footer break-before">
      <img class="cover-photo" src="${ju.footer}"/>
      <div class="cover-scrim"></div>
      <div class="cover-txt">
        <div class="footer-msg">Vem comigo nessa jornada, ${esc(first)}.<br>Qualquer dúvida, é só me chamar 💛</div>
        <div class="footer-sign">Beijos da Ju</div>
        <a href="${IG}" class="ln">Seguir a Juliane no Instagram</a>
        <a href="${GRUPO}" class="ln">Entrar no grupo de promoções</a>
      </div>
    </section>`

  const body =
    cover() + carta() + analise() + produtos() + compraRastreio() +
    cronograma() + ritual() + dicas() + retorno() + footer()

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=430">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500;1,9..144,600&family=Plus+Jakarta+Sans:wght@400;500;700;800&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body>${body}</body></html>`
}

const CSS = `
@page { size: 430px 900px; margin: 0; }
* { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
body { font-family:'Plus Jakarta Sans',system-ui,sans-serif; color:#3D2B2E; background:#FFFAF5; width:430px; }
img { display:block; max-width:100%; }
.sheet { width:430px; min-height:900px; position:relative; page-break-inside:avoid; }
.break-before { page-break-before:always; }
.pad { padding:26px 22px 30px; }
.center { text-align:center; }
.label { font-size:11px; font-weight:800; letter-spacing:1.5px; text-transform:uppercase; color:#BE185D; margin-bottom:14px; }
.cover { height:900px; overflow:hidden; }
.cover-photo { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
.cover-scrim { position:absolute; inset:0; background:linear-gradient(180deg,rgba(190,24,93,0.05) 0%,rgba(61,26,44,0.15) 45%,rgba(61,20,44,0.86) 100%); }
.cover-txt { position:absolute; left:0; right:0; bottom:0; padding:36px 30px 44px; color:#fff; text-align:center; }
.cover-kicker { font-size:12px; font-weight:800; letter-spacing:2px; text-transform:uppercase; opacity:.92; }
.cover h1 { font-family:'Fraunces',Georgia,serif; font-size:60px; font-weight:600; font-style:italic; margin:6px 0 12px; text-shadow:0 2px 18px rgba(0,0,0,.35); }
.cover-sub { font-size:14px; line-height:1.55; opacity:.96; }
.cover-badge { margin-top:22px; display:inline-block; background:rgba(255,255,255,0.22); border-radius:99px; padding:10px 20px; font-size:13px; font-weight:700; }
.miniju { text-align:center; margin-bottom:14px; }
.miniju img { width:96px; height:96px; border-radius:50%; object-fit:cover; margin:0 auto; border:3px solid #F3C6D4; }
.carta { font-family:'Fraunces',Georgia,serif; font-size:14.5px; line-height:1.6; background:linear-gradient(160deg,#FFF3F6,#FFFBF7); border:1px solid #F3D6DE; border-radius:18px; padding:20px; }
.carta p { margin-bottom:11px; } .carta p:last-child { margin-bottom:0; }
.bigfotos { display:flex; flex-direction:column; gap:12px; margin-bottom:16px; }
.bigfoto { border-radius:16px; overflow:hidden; border:1px solid #F3D6DE; position:relative; }
.bigfoto img { width:100%; height:300px; object-fit:cover; }
.bigfoto figcaption { position:absolute; left:10px; bottom:10px; background:rgba(61,20,44,.75); color:#fff; font-size:11px; font-weight:700; padding:4px 10px; border-radius:8px; text-transform:uppercase; letter-spacing:.5px; }
.diag { font-family:'Fraunces',Georgia,serif; font-size:15.5px; line-height:1.65; background:#fff; border:1px solid #F3D6DE; border-radius:16px; padding:18px; margin-bottom:16px; }
.diag-by { font-family:'Plus Jakarta Sans'; font-size:12px; color:#BE185D; font-weight:700; margin-top:8px; }
.scores { background:#fff; border:1px solid #F3D6DE; border-radius:16px; padding:16px 18px; }
.scorerow { display:flex; align-items:center; gap:10px; margin:9px 0; }
.sl { width:82px; font-size:12.5px; font-weight:700; color:#7A6A6D; }
.track { flex:1; height:9px; background:#F3E3E8; border-radius:99px; overflow:hidden; }
.fill { display:block; height:100%; background:linear-gradient(90deg,#FB7185,#BE185D); border-radius:99px; }
.sv { width:26px; text-align:right; font-size:12.5px; font-weight:800; color:#BE185D; }
.poro { font-size:12.5px; color:#7A6A6D; margin-top:10px; padding-top:10px; border-top:1px solid #F6E7EC; }
.ju-divider { border-radius:18px; overflow:hidden; position:relative; margin-bottom:20px; }
.ju-divider img { width:100%; height:220px; object-fit:cover; }
.ju-divider-txt { position:absolute; left:0; right:0; bottom:0; padding:16px; background:linear-gradient(180deg,transparent,rgba(61,20,44,.8)); color:#fff; font-family:'Fraunces',Georgia,serif; font-size:16px; line-height:1.45; }
.prod { background:#fff; border:1px solid #F3D6DE; border-radius:16px; padding:15px; margin-bottom:13px; page-break-inside:avoid; }
.prod-top { display:flex; gap:13px; }
.prod-img { width:70px; height:70px; border-radius:12px; overflow:hidden; flex-shrink:0; border:1px solid #F3D6DE; display:flex; align-items:center; justify-content:center; background:#fff; }
.prod-img img { width:100%; height:100%; object-fit:contain; }
.noimg { font-size:30px; }
.prod-brand { font-size:10px; font-weight:800; color:#A89AA0; text-transform:uppercase; letter-spacing:.5px; }
.prod-name { font-size:15px; font-weight:800; margin:2px 0; }
.prod-why { font-size:12.5px; color:#7A6A6D; line-height:1.45; }
.alt { font-size:12px; color:#7A6A6D; margin-top:10px; padding-top:9px; border-top:1px dashed #F0C0CE; }
.combos { margin-top:10px; background:#FBF7F2; border-radius:10px; padding:9px 11px; }
.combos-h { font-size:10px; font-weight:800; color:#B8860B; text-transform:uppercase; margin-bottom:4px; }
.combo { display:block; font-size:12px; color:#BE185D; text-decoration:none; padding:2px 0; }
.buy { display:block; text-align:center; margin-top:12px; background:linear-gradient(135deg,#FB7185,#BE185D); color:#fff; text-decoration:none; font-weight:800; font-size:13.5px; padding:12px; border-radius:12px; }
.cta-card { background:linear-gradient(160deg,#FFF3F6,#fff); border:1px solid #F3D6DE; border-radius:18px; padding:22px; }
.cta-h { font-family:'Fraunces',Georgia,serif; font-size:20px; margin-bottom:8px; }
.cta-card > p { font-size:13.5px; line-height:1.6; color:#5c4a4e; }
.cta-track { margin-top:16px; background:#fff; border:1px solid #F3D6DE; border-radius:14px; padding:16px; }
.cta-track-h { font-size:15px; font-weight:800; color:#BE185D; margin-bottom:6px; }
.cta-track p { font-size:13px; line-height:1.55; color:#5c4a4e; }
.cta-btn { display:block; text-align:center; margin-top:14px; background:#22A06B; color:#fff; text-decoration:none; font-weight:800; font-size:14px; padding:13px; border-radius:12px; }
.week-page { background:#FFFAF5; }
.wk-badge { display:inline-block; background:#BE185D; color:#fff; font-size:12px; font-weight:800; padding:6px 14px; border-radius:99px; text-transform:uppercase; letter-spacing:.6px; }
.wk-foco { font-family:'Fraunces',Georgia,serif; font-size:20px; line-height:1.28; margin:11px 0 15px; color:#3D2B2E; }
.cday { background:#fff; border:1px solid #F3D6DE; border-radius:14px; padding:12px 15px; margin-bottom:10px; }
.cday-h { font-size:12px; font-weight:800; color:#BE185D; text-transform:uppercase; letter-spacing:.5px; margin-bottom:7px; }
.task { display:flex; gap:9px; padding:4px 0; }
.dot { width:7px; height:7px; border-radius:50%; background:#FB7185; margin-top:5px; flex-shrink:0; }
.task-t { font-size:13.5px; font-weight:700; }
.task-d { font-size:12px; color:#7A6A6D; line-height:1.4; margin-top:1px; }
.tip { background:#FFF7EE; border-radius:12px; padding:13px 15px; font-size:13px; color:#7A5B2E; line-height:1.5; margin-top:6px; }
.ritual { background:linear-gradient(160deg,#FFF6F9,#fff); border:1px solid #F3D6DE; border-radius:18px; padding:22px; }
.ritual ul { list-style:none; }
.ritual li { font-size:15px; line-height:1.55; padding:9px 0 9px 26px; position:relative; border-bottom:1px solid #F6E7EC; }
.ritual li:last-child { border-bottom:none; }
.ritual li:before { content:'🫗'; position:absolute; left:0; font-size:16px; }
.dicas-intro { font-size:13px; color:#7A6A6D; line-height:1.5; margin-bottom:16px; }
.dica { background:#fff; border:1px solid #F3D6DE; border-radius:14px; padding:15px 17px; margin-bottom:11px; page-break-inside:avoid; }
.dica-h { font-size:15px; font-weight:800; color:#3D2B2E; display:flex; align-items:center; gap:9px; margin-bottom:9px; }
.dica-e { font-size:19px; }
.dica ul { list-style:none; }
.dica li { font-size:13px; line-height:1.5; color:#5c4a4e; padding:4px 0 4px 16px; position:relative; }
.dica li:before { content:'•'; position:absolute; left:2px; color:#FB7185; font-weight:800; }
.retorno-card { background:linear-gradient(160deg,#FBEEF7,#fff); border:1px solid #E7C3DD; border-radius:18px; padding:24px 22px; text-align:center; }
.retorno-icon { font-size:38px; margin-bottom:6px; }
.retorno-h { font-family:'Fraunces',Georgia,serif; font-size:21px; line-height:1.3; margin-bottom:10px; }
.retorno-card > p { font-size:13.5px; line-height:1.6; color:#5c4a4e; }
.retorno-data { margin:20px 0; background:#fff; border:2px dashed #E7A3C9; border-radius:16px; padding:18px; }
.retorno-data-label { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:1px; color:#BE185D; }
.retorno-data-val { font-family:'Fraunces',Georgia,serif; font-size:30px; font-weight:600; color:#BE185D; margin:4px 0 2px; }
.retorno-data-sub { font-size:13px; color:#7A6A6D; text-transform:capitalize; }
.retorno-note { font-size:12.5px; color:#7A6A6D; font-style:italic; }
.footer .cover-txt { padding-bottom:40px; }
.footer-msg { font-family:'Fraunces',Georgia,serif; font-size:18px; line-height:1.55; margin-bottom:8px; }
.footer-sign { font-family:'Fraunces',Georgia,serif; font-style:italic; font-size:22px; margin-bottom:20px; }
.ln { display:block; background:rgba(255,255,255,0.2); color:#fff; text-decoration:none; font-weight:800; font-size:13.5px; padding:13px; border-radius:13px; margin-top:9px; }
`
