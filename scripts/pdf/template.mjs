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
      const video = pr.videoUrl ? `<a class="vid" href="${esc(pr.videoUrl)}">
        <span class="vid-thumb">${pr.videoThumb ? `<img src="${pr.videoThumb}"/>` : ''}<span class="vid-play">▶</span></span>
        <span class="vid-txt"><b>🎬 A Juliane explica este produto</b><small>Toque para assistir no YouTube</small></span></a>` : ''
      return `<div class="prod">
        <div class="prod-top"><div class="prod-img">${img}</div>
          <div><div class="prod-brand">${esc(pr.brand || 'Ybera')}</div>
          <div class="prod-name">${esc(pr.name)}</div>
          <div class="prod-why">${esc(p.motivo)}</div></div></div>
        ${video}${alt}${combosBox}${buy}</div>`
    }).join('')
    return `
    <section class="sheet pad break-before">
      <div class="ju-divider"><img src="${ju.prodDivider}" style="object-position:center 30%"/><div class="ju-divider-txt">Os produtos que <b>eu uso e confio</b> — escolhidos a dedo pro seu cabelo</div></div>
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
      <div class="ju-divider"><img src="${ju.cronoDivider}" style="object-position:center 44%"/><div class="ju-divider-txt">Seu cronograma de <b>12 semanas</b> — uma por vez, sem pressa 💛</div></div>
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

  // ═══════════════════════════════════════════════════════════════════════
  // SEÇÕES EDUCATIVAS — conteúdo do "Guia Completo de Cuidados Capilares" da
  // Juliane, adaptado pro plano personalizado. Estático (vale pra todas), com
  // toques personalizados onde faz sentido (frequência de lavagem pelo couro).
  // ═══════════════════════════════════════════════════════════════════════
  const mlSearch = (q) => `https://lista.mercadolivre.com.br/${encodeURIComponent(q)}`

  const callout = (kicker, html, tone = 'rose') =>
    `<div class="callout ${tone}">${kicker ? `<div class="callout-k">${esc(kicker)}</div>` : ''}<div class="callout-b">${html}</div></div>`

  // Fundamentos: bem-vinda + o que transforma + como o cabelo funciona
  const fundamentos = () => `
    <section class="sheet pad break-before">
      <div class="label">Antes de começar</div>
      <h2 class="serif-h">Bem-vinda!</h2>
      <p class="lead">Se você chegou até aqui, é porque decidiu cuidar do seu cabelo de verdade. E eu preciso te contar uma coisa importante logo de cara.</p>
      ${callout('Não existe produto milagroso.', 'O que realmente transforma um cabelo é a soma de vários fatores trabalhando juntos, todos os dias. Mesmo o melhor tratamento do mundo pode não entregar resultado se for usado da forma errada.', 'wine')}
      <div class="sub-h">O que transforma um cabelo</div>
      <ul class="pillars">
        <li><b>Produtos corretos</b> — os certos para o que o seu fio precisa.</li>
        <li><b>Aplicação correta</b> — a ordem e o modo de usar fazem toda a diferença.</li>
        <li><b>Constância</b> — resultado nasce da repetição, não de um dia perfeito.</li>
        <li><b>Alimentação</b> — fio bonito também se constrói de dentro pra fora.</li>
        <li><b>Hábitos diários</b> — pequenos cuidados que somam ao longo dos meses.</li>
      </ul>
    </section>
    <section class="sheet pad break-before">
      <div class="label">Fundamentos</div>
      <h2 class="serif-h">Como o cabelo funciona</h2>
      <p class="lead">Antes de tratar, entenda como o fio é formado. Ele tem três camadas — e o tratamento acontece principalmente nas duas primeiras.</p>
      <div class="tri">
        <div class="tri-card"><div class="tri-t">Cutícula</div><div class="tri-k">Camada externa</div><p>Como um telhado de escamas. Fechada, protege tudo o que está por dentro.</p></div>
        <div class="tri-card"><div class="tri-t">Córtex</div><div class="tri-k">Camada central</div><p>Onde fica quase toda a estrutura: queratina, proteínas, pigmentos e a elasticidade do fio.</p></div>
        <div class="tri-card"><div class="tri-t">Medula</div><div class="tri-k">Núcleo</div><p>A parte mais interna. Praticamente não influencia nos tratamentos cosméticos.</p></div>
      </div>
      <div class="sub-h">A cutícula é o seu termômetro</div>
      <div class="two-col">
        <div class="tc-card ok"><div class="tc-h">Cutícula fechada</div><ul><li>Cabelo com brilho</li><li>Desembaraça fácil</li><li>Perde menos água</li><li>Toque macio</li></ul></div>
        <div class="tc-card bad"><div class="tc-h">Cutícula aberta</div><ul><li>Frizz e aspereza</li><li>Ressecamento</li><li>Pontas duplas</li><li>Quebra</li></ul></div>
      </div>
      ${callout('Guarde isto', 'Grande parte do tratamento é manter a cutícula saudável. Quando o córtex sofre com descoloração, chapinha, secador ou química, o fio perde força e começa a quebrar — é por isso que a reconstrução existe.', 'rose')}
    </section>`

  // O cronograma e as 3 etapas (com ativos)
  const etapas = () => `
    <section class="sheet pad break-before">
      <div class="label">O coração do tratamento</div>
      <h2 class="serif-h">O que é cronograma capilar?</h2>
      <p class="lead">É um planejamento pra devolver ao cabelo, de forma organizada, tudo o que ele perde no dia a dia. Cada etapa tem uma função — e é a alternância entre elas que faz o resultado acontecer.</p>
      <div class="etapas-chips">
        <div class="ec h"><span>Devolve ÁGUA</span><b>Hidratação</b></div>
        <div class="ec n"><span>Devolve LIPÍDIOS</span><b>Nutrição</b></div>
        <div class="ec r"><span>Devolve PROTEÍNAS</span><b>Reconstrução</b></div>
      </div>
      <div class="need">
        <div><span>Sem brilho, opaco</span> → está pedindo <b>hidratação</b></div>
        <div><span>Frizz e ressecado</span> → está pedindo <b>nutrição</b></div>
        <div><span>Quebrando muito</span> → está pedindo <b>reconstrução</b></div>
      </div>
      ${callout('A regra de ouro', 'Um cronograma de verdade se diferencia de "usar sempre a mesma máscara" justamente porque alterna as etapas. O excesso de qualquer uma — principalmente reconstrução — atrapalha em vez de ajudar.', 'rose')}
    </section>
    <section class="sheet pad break-before">
      <div class="label">As três etapas</div>
      <h2 class="serif-h">Hidratação, Nutrição &amp; Reconstrução</h2>
      <div class="step-card h"><div class="step-h"><span class="step-ic">💧</span><div><b>Hidratação</b><small>Devolve água</small></div></div>
        <p>Imagine uma planta sem água: ela murcha. O cabelo também. Quando falta hidratação, o fio fica opaco, áspero, armado e difícil de desembaraçar.</p>
        <p class="ativos"><b>Ativos:</b> babosa, pantenol, glicerina, aloe vera, ácido hialurônico. É a etapa mais frequente do cronograma.</p></div>
      <div class="step-card n"><div class="step-h"><span class="step-ic">🫧</span><div><b>Nutrição</b><small>Devolve lipídios</small></div></div>
        <p>São os óleos naturais que protegem o fio. Quando falta nutrição, surgem frizz, pontas espigadas, excesso de volume e porosidade. A nutrição é a responsável pelo brilho.</p>
        <p class="ativos"><b>Ativos:</b> óleo de argan, coco, abacate e macadâmia; manteiga de karité e murumuru.</p></div>
      <div class="step-card r"><div class="step-h"><span class="step-ic">✚</span><div><b>Reconstrução</b><small>Devolve proteínas</small></div></div>
        <p>Repõe queratina, colágeno e aminoácidos. Indicada pra cabelos descoloridos, quebradiços, elásticos ou muito danificados.</p>
        <p class="ativos"><b>Atenção:</b> reconstrução em excesso endurece o fio. Entra só a cada 15–30 dias, conforme a necessidade — nunca toda semana.</p></div>
    </section>`

  // Como lavar + máscara/condicionador + óleo/protetor
  const comoLavar = () => `
    <section class="sheet pad break-before">
      <div class="label">Passo a passo</div>
      <h2 class="serif-h">Como lavar corretamente</h2>
      <p class="lead">Parece simples, mas a maior parte das pessoas lava o cabelo do jeito errado. Estes cinco passos mudam a base de tudo.</p>
      <ol class="steps">
        <li><b>Molhe completamente os fios.</b> A água precisa penetrar de verdade antes do shampoo.</li>
        <li><b>Shampoo apenas na raiz.</b> Nunca esfregue o comprimento — quem limpa o comprimento é a espuma escorrendo.</li>
        <li><b>Massageie com as pontas dos dedos.</b> Nunca as unhas. A massagem ativa a circulação do couro.</li>
        <li><b>Enxágue completamente.</b> Resíduo de shampoo deixa o cabelo pesado e sem brilho.</li>
        <li><b>Raiz muito oleosa? Faça uma segunda lavagem.</b> A primeira remove a sujeira; a segunda realmente limpa.</li>
      </ol>
      ${callout('Temperatura importa', 'Água morna na lavagem e água fria no enxágue final. Água muito quente abre demais a cutícula, estimula oleosidade na raiz, resseca o comprimento e aumenta o frizz.', 'rose')}
    </section>
    <section class="sheet pad break-before">
      <div class="label">Aplicação</div>
      <h2 class="serif-h">Máscara &amp; condicionador</h2>
      <ol class="steps">
        <li><b>Retire o excesso de água com a toalha.</b> Quanto menos água no fio, melhor a absorção da máscara.</li>
        <li><b>Divida o cabelo em mechas</b> e passe mecha por mecha, enluvando delicadamente.</li>
        <li><b>Nunca aplique na raiz</b> — exceto máscaras específicas pra couro cabeludo.</li>
        <li><b>Respeite o tempo indicado.</b> Mais tempo não significa mais resultado. Depois, enxágue completamente.</li>
      </ol>
      ${callout('Condicionador é obrigatório? Sim.', 'Muita gente acha que a máscara substitui — na maioria das vezes, não. O condicionador sela a cutícula depois do tratamento: menos frizz, mais brilho e fios alinhados.', 'rose')}
      <div class="sub-h">Óleo capilar &amp; protetor térmico</div>
      <p class="lead">O óleo é um finalizador: ele não hidrata em profundidade, ele sela tudo o que a máscara entregou. <b>Óleo de Mirra:</b> 2 a 3 gotas já bastam — óleo em excesso pesa. Se você usa chapinha ou secador, protetor térmico <b>não é opcional</b>: o calor acima de 180 °C começa a degradar as proteínas do fio.</p>
      ${callout('A ordem certa importa', 'Máscara sela com água fria → toalha → óleo de mirra nas pontas úmidas → protetor térmico → só então o calor. Fazer na sequência errada é o que consome a hidratação mais rápido do que qualquer máscara consegue repor.', 'wine')}
    </section>`

  // Rotina & hábitos (frequência personalizada pelo couro) + o que prejudica
  const habitos = () => {
    const c = data.couro
    const freq = [
      ['Raiz oleosa', 'Pode lavar diariamente.', 'oleoso'],
      ['Raiz normal', 'Dia sim, dia não.', 'normal'],
      ['Raiz seca', '2 a 3 vezes por semana.', 'seco'],
    ].map(([t, d, key]) => `<div class="freq-row${c === key ? ' on' : ''}"><span>${esc(t)}</span><span>${esc(d)}${c === key ? ' <b>· o seu caso</b>' : ''}</span></div>`).join('')
    return `
    <section class="sheet pad break-before">
      <div class="label">No dia a dia</div>
      <h2 class="serif-h">Rotina &amp; hábitos que fazem a diferença</h2>
      <div class="sub-h">Com que frequência lavar?</div>
      <div class="freq">${freq}</div>
      <p class="micro">Couro cabeludo limpo favorece um ambiente mais saudável pros fios crescerem.</p>
      <div class="two-col">
        <div class="tc-card"><div class="tc-h">Como pentear</div><ul><li>Comece sempre pelas pontas.</li><li>Depois o comprimento; só então a raiz.</li><li>Nunca puxe o pente de cima pra baixo.</li><li>Pente de dentes largos ou cerdas macias.</li></ul></div>
        <div class="tc-card"><div class="tc-h">Fronha de cetim</div><ul><li>Menos quebra e menos nós</li><li>Menos frizz</li><li>Mais brilho ao acordar</li></ul></div>
      </div>
      ${callout('Evite dormir de cabelo molhado', 'O fio molhado é mais frágil, e o hábito favorece quebra, frizz, caspa e fungos. Deixe secar antes de deitar e evite prender o cabelo muito apertado.', 'rose')}
    </section>
    <section class="sheet pad break-before">
      <div class="label">Fuja disto</div>
      <h2 class="serif-h">O que mais prejudica o cabelo</h2>
      <p class="lead">Boa parte dos danos não vem do que falta — vem do que se repete sem perceber.</p>
      <div class="two-col avoid">
        <ul><li>Dormir de cabelo molhado.</li><li>Prender o cabelo muito apertado.</li><li>Chapinha todos os dias.</li><li>Água muito quente.</li></ul>
        <ul><li>Escovar com força.</li><li>Descolorações frequentes.</li><li>Lavar pouco quando o couro é oleoso.</li><li>Não cortar as pontas.</li></ul>
      </div>
      ${callout('Cortar os fios regularmente', 'Cabelo danificado: corte a cada <b>3 meses</b>. Pontas saudáveis: a cada <b>6 meses</b> pra manter o formato e a saúde.', 'wine')}
    </section>`
  }

  // Escovas & acessórios (indicações com busca no Mercado Livre)
  const escovas = () => {
    const brush = (nome, tag, desc, itens, buscar) => `<div class="brush"><div class="brush-h">${tag ? `<span class="brush-tag">${esc(tag)}</span>` : ''}<b>${esc(nome)}</b></div><p>${esc(desc)}</p><ul>${itens.map(i => `<li>${esc(i)}</li>`).join('')}</ul>${buscar ? `<a class="buy sm" href="${mlSearch(buscar)}">Buscar no Mercado Livre →</a>` : ''}</div>`
    return `
    <section class="sheet pad break-before">
      <div class="label">Ferramentas</div>
      <h2 class="serif-h">As melhores escovas</h2>
      <p class="lead">A escova certa diminui a quebra, reduz o frizz e facilita o desembaraço. A errada faz o contrário: arranca fios e favorece pontas duplas.</p>
      ${brush('Tangle Teezer', '★ Minha favorita', 'Uma das melhores do mundo pra desembaraçar sem puxar os fios. Pode usar no cabelo molhado.', ['Reduz a quebra', 'Ótima pra fios finos, loiros e com química'], 'tangle teezer escova')}
      ${brush('Michel Mercier', '★', 'Pensada pra diferentes espessuras. Muito confortável e puxa menos os fios.', ['Ótima pra cabelos longos e grossos', 'Diminui bastante a quebra'], 'escova michel mercier')}
      ${brush('Wet Brush', null, 'Ótimo custo-benefício, cerdas extremamente flexíveis. Desembaraça molhado sem machucar o couro.', ['Serve pra todos os tipos de cabelo'], 'wet brush escova')}
      ${brush('Escovas de bambu', null, 'Pra quem prefere materiais naturais: massageiam o couro e produzem menos eletricidade estática.', ['Ajudam a reduzir o frizz', 'Muito resistentes'], 'escova de bambu cabelo')}
      ${callout('Escovas que eu evitaria', 'Escovas com bolinhas nas pontas <b>quando essas bolinhas começam a soltar</b> — o plástico exposto vira um "gancho" que aumenta o atrito e a quebra. Evite também cerdas quebradas, escovas muito antigas ou sujas. Lave a sua pelo menos 1x por semana com água morna e shampoo neutro.', 'rose')}
      <div class="brush"><div class="brush-h"><span class="brush-tag">★ Pra prender</span><b>Scrunchie de cetim</b></div><p>O acessório que menos agride — ideal pro dia a dia e pra dormir.</p><ul><li>Reduz a quebra e o atrito</li><li>Não marca tanto os fios</li><li>Diminui o frizz</li></ul><a class="buy sm" href="${mlSearch('scrunchie de cetim')}">Buscar no Mercado Livre →</a></div>
      ${callout('Dica da Ju', 'Se você prende o cabelo todo dia, <b>alterne a altura do penteado</b>: um dia mais alto, outro mais baixo, outro com presilha. Isso evita a tração constante sempre na mesma região do couro e ajuda a prevenir a quebra.', 'wine')}
    </section>`
  }

  // Alimentação de dentro pra fora
  const alimentacao = () => `
    <section class="sheet pad break-before">
      <div class="label">De dentro pra fora</div>
      <h2 class="serif-h">Alimentação que fortalece</h2>
      <p class="lead">O cabelo é formado principalmente por proteína. Se faltam nutrientes, ele sente — e nenhum produto tópico compensa isso sozinho.</p>
      <div class="food-card">
        <div class="tc-h">Inclua na rotina</div>
        <div class="two-col">
          <ul><li>Carnes magras e ovos</li><li>Peixes</li><li>Espinafre e brócolis</li><li>Castanhas</li></ul>
          <ul><li>Abacate</li><li>Morango e laranja</li><li>Feijão</li></ul>
        </div>
        <p class="micro">Proteínas, ferro, zinco, vitamina C, complexo B e gorduras boas — nutrientes pra formação e fortalecimento dos fios.</p>
      </div>
      <div class="two-col">
        <div class="tc-card"><div class="tc-h">Água</div><ul><li>Fios desidratados começam dentro do corpo.</li><li>Beba água ao longo do dia.</li></ul></div>
        <div class="tc-card"><div class="tc-h">Vitaminas que ajudam</div><ul><li>Ferro, vitamina D, zinco</li><li>Biotina, complexo B, ômega 3</li></ul></div>
      </div>
      <p class="micro">A suplementação pode ajudar quando existe deficiência nutricional, mas deve ser orientada por um profissional de saúde. Este material é educativo e não substitui avaliação individual.</p>
    </section>`

  const body =
    cover() + carta() + fundamentos() + analise() + etapas() +
    produtos() + compraRastreio() + comoLavar() +
    cronograma() + ritual() + habitos() + escovas() + alimentacao() +
    retorno() + footer()

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
.ju-divider img { width:100%; height:235px; object-fit:cover; object-position:center 30%; }
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
.vid { display:flex; align-items:center; gap:11px; margin-top:11px; background:#FFF3F6; border:1px solid #F3D6DE; border-radius:12px; padding:9px 11px; text-decoration:none; }
.vid-thumb { position:relative; width:54px; height:54px; border-radius:10px; overflow:hidden; flex-shrink:0; background:#000; display:block; }
.vid-thumb img { width:100%; height:100%; object-fit:cover; opacity:.9; }
.vid-play { position:absolute; inset:0; margin:auto; width:22px; height:22px; border-radius:50%; background:rgba(255,255,255,.92); color:#BE185D; font-size:10px; display:flex; align-items:center; justify-content:center; padding-left:2px; }
.vid-txt b { display:block; font-size:12.5px; font-weight:800; color:#BE185D; }
.vid-txt small { font-size:11px; color:#7A6A6D; }
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

/* ── Seções educativas (guia) ── */
.serif-h { font-family:'Fraunces',Georgia,serif; font-size:30px; font-weight:600; line-height:1.12; color:#7A1B3D; margin:2px 0 10px; }
.lead { font-size:13.5px; line-height:1.55; color:#5c4a4e; margin-bottom:12px; }
.sub-h { font-size:15px; font-weight:800; color:#3D2B2E; margin:14px 0 9px; }
.micro { font-size:11.5px; line-height:1.5; color:#9A8A8E; margin-top:12px; font-style:italic; }
.callout { border-radius:14px; padding:16px 18px; margin:16px 0 4px; }
.callout.rose { background:#FBEAF1; }
.callout.wine { background:#F3E7ED; border-left:4px solid #BE185D; }
.callout-k { font-size:11px; font-weight:800; letter-spacing:.6px; text-transform:uppercase; color:#BE185D; margin-bottom:6px; }
.callout-b { font-size:13px; line-height:1.6; color:#5c4a4e; }
.callout.wine .callout-b, .callout.rose .callout-b { font-family:'Fraunces',Georgia,serif; font-size:13.5px; }
.pillars { list-style:none; }
.pillars li { font-size:13.5px; line-height:1.5; padding:7px 0 7px 18px; position:relative; border-bottom:1px solid #F6E7EC; color:#5c4a4e; }
.pillars li:last-child { border-bottom:none; }
.pillars li:before { content:''; position:absolute; left:0; top:13px; width:8px; height:8px; border-radius:2px; background:#E9A9BF; }
.pillars b, .lead b, .need b, .callout-b b, .ativos b, .freq-row b { color:#7A1B3D; }
.tri { display:flex; flex-direction:column; gap:8px; margin-bottom:4px; }
.tri-card { background:#fff; border:1px solid #F0DCE4; border-radius:14px; padding:11px 15px; }
.tri-t { font-family:'Fraunces',Georgia,serif; font-size:18px; color:#7A1B3D; }
.tri-k { font-size:9.5px; font-weight:800; letter-spacing:.8px; text-transform:uppercase; color:#A89AA0; margin:1px 0 4px; }
.tri-card p { font-size:12px; line-height:1.45; color:#5c4a4e; }
.two-col { display:flex; gap:10px; }
.two-col > * { flex:1; }
.tc-card { background:#fff; border:1px solid #F0DCE4; border-radius:14px; padding:14px 15px; }
.tc-card.ok { border-color:#BBE3CF; } .tc-card.bad { border-color:#F3C6D4; }
.tc-h { font-size:13.5px; font-weight:800; color:#7A1B3D; margin-bottom:8px; }
.tc-card.ok .tc-h { color:#1F7A55; }
.tc-card ul, .avoid ul { list-style:none; }
.tc-card li, .avoid li { font-size:12.5px; line-height:1.45; padding:3px 0 3px 14px; position:relative; color:#5c4a4e; }
.tc-card li:before, .avoid li:before { content:'•'; position:absolute; left:2px; color:#E9A9BF; font-weight:800; }
.etapas-chips { display:flex; gap:8px; margin-bottom:16px; }
.etapas-chips .ec { flex:1; border-radius:12px; padding:14px 8px; text-align:center; color:#fff; }
.ec span { display:block; font-size:9px; font-weight:800; letter-spacing:.5px; opacity:.9; }
.ec b { font-family:'Fraunces',Georgia,serif; font-size:16px; font-weight:600; }
.ec.h { background:#5B7C99; } .ec.n { background:#C08A2E; } .ec.r { background:#7A1B3D; }
.need > div { font-size:13px; line-height:1.5; padding:9px 0; border-bottom:1px solid #F6E7EC; color:#5c4a4e; }
.need > div:last-child { border-bottom:none; }
.need span { font-weight:800; color:#3D2B2E; }
.step-card { border-radius:14px; padding:15px 16px; margin-bottom:11px; }
.step-card.h { background:#EEF3F7; } .step-card.n { background:#FBF2E2; } .step-card.r { background:#F6E7ED; }
.step-h { display:flex; align-items:center; gap:11px; margin-bottom:8px; }
.step-ic { width:38px; height:38px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:18px; background:#fff; flex-shrink:0; }
.step-h b { font-family:'Fraunces',Georgia,serif; font-size:19px; color:#3D2B2E; display:block; }
.step-h small { font-size:10px; font-weight:800; letter-spacing:.6px; text-transform:uppercase; color:#A89AA0; }
.step-card p { font-size:12.5px; line-height:1.55; color:#5c4a4e; margin-bottom:6px; }
.step-card .ativos { font-size:12px; color:#7A6A6D; margin-bottom:0; }
.steps { list-style:none; counter-reset:s; }
.steps li { counter-increment:s; font-size:13px; line-height:1.5; padding:9px 0 9px 34px; position:relative; border-bottom:1px solid #F6E7EC; color:#5c4a4e; }
.steps li:last-child { border-bottom:none; }
.steps li:before { content:counter(s); position:absolute; left:0; top:8px; width:23px; height:23px; border-radius:50%; background:#7A1B3D; color:#fff; font-size:12px; font-weight:800; display:flex; align-items:center; justify-content:center; }
.freq { background:#fff; border:1px solid #F0DCE4; border-radius:14px; overflow:hidden; }
.freq-row { display:flex; justify-content:space-between; gap:12px; font-size:13px; padding:11px 15px; border-bottom:1px solid #F6E7EC; color:#5c4a4e; }
.freq-row:last-child { border-bottom:none; }
.freq-row span:first-child { font-weight:800; color:#7A1B3D; }
.freq-row.on { background:#FBEAF1; }
.brush { background:#fff; border:1px solid #F0DCE4; border-radius:14px; padding:14px 16px; margin-bottom:11px; page-break-inside:avoid; }
.brush-h { display:flex; align-items:center; gap:9px; margin-bottom:5px; }
.brush-h b { font-family:'Fraunces',Georgia,serif; font-size:17px; color:#7A1B3D; }
.brush-tag { background:#7A1B3D; color:#fff; font-size:9px; font-weight:800; letter-spacing:.4px; text-transform:uppercase; padding:3px 8px; border-radius:99px; }
.brush p { font-size:12.5px; line-height:1.5; color:#5c4a4e; margin-bottom:6px; }
.brush ul { list-style:none; margin-bottom:4px; }
.brush li { font-size:12px; line-height:1.4; padding:2px 0 2px 14px; position:relative; color:#5c4a4e; }
.brush li:before { content:'•'; position:absolute; left:2px; color:#E9A9BF; font-weight:800; }
.buy.sm { font-size:12.5px; padding:9px; margin-top:8px; }
.food-card { background:#F6ECE4; border-radius:14px; padding:16px; margin-bottom:12px; }
`
