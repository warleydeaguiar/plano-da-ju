'use client';

// Experiência "Consulta com a Juliane" — tela pós-compra (substitui o cronômetro).
// Tempo REAL e persistente: ancorada em [startMs (plan_requested_at), endMs
// (plan_released_at)]. Sobrevive a refresh (recomputa a etapa pela hora atual).
// Dados reais vêm de buildConsultaData(profile). Sem controles de dev.

import { Component, useEffect, useRef, type ReactNode } from 'react';
import type { ConsultaData } from '../../lib/consulta';
import { CONSULTA_AVG_MIN } from '../../lib/consulta';
import Picture from '@/app/components/Picture';

const CSS = `
.cns{ --bg:#150810; --bg2:#1E0B16; --raise:#2A1120; --raise2:#361628;
 --line:rgba(233,169,191,.16); --line2:rgba(233,169,191,.28);
 --wine:#7A1B3D; --rose:#EC6E93; --rose-soft:#E8829E; --gold:#D9A96B;
 --cream:#F7ECEF; --muted:#C7A6B4; --muted2:#9C7C8B; --ok:#6FD3A3; --no:#E5738A;
 --serif:Georgia,'Times New Roman',serif; --sans:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
 position:relative; min-height:calc(100dvh - 60px); background:radial-gradient(120% 55% at 50% 0%, #2b1120 0%, #1a0b13 55%, #140810 100%);
 color:var(--cream); font-family:var(--sans); overflow:hidden; }
.cns *{ box-sizing:border-box; }
.cns .hero{ position:relative; height:200px; overflow:hidden; }
.cns .hero>img{ width:100%; height:100%; object-fit:cover; object-position:50% 30%; display:block; }
.cns .hero-grad{ position:absolute; inset:0; background:linear-gradient(180deg, rgba(20,8,16,.28) 0%, rgba(20,8,16,0) 32%, rgba(20,8,16,.5) 68%, rgba(20,8,16,.97) 100%); }
.cns .hero-top{ position:absolute; top:0; left:0; right:0; padding:15px 16px 0; display:flex; align-items:flex-start; justify-content:space-between; z-index:2; }
.cns .live{ display:inline-flex; align-items:center; gap:6px; font-size:9.5px; color:#fff; font-weight:700; letter-spacing:.5px; text-transform:uppercase; background:rgba(20,8,16,.5); backdrop-filter:blur(4px); -webkit-backdrop-filter:blur(4px); padding:5px 10px; border-radius:99px; border:1px solid rgba(255,255,255,.14); }
.cns .live i{ width:6px; height:6px; border-radius:50%; background:#ff5c8a; box-shadow:0 0 8px #ff5c8a; animation:cnsPulse 1.6s infinite; }
@keyframes cnsPulse{0%{box-shadow:0 0 0 0 rgba(255,92,138,.6)}70%{box-shadow:0 0 0 7px rgba(255,92,138,0)}100%{box-shadow:0 0 0 0 rgba(255,92,138,0)}}
.cns .clock{ text-align:right; background:rgba(20,8,16,.5); backdrop-filter:blur(4px); -webkit-backdrop-filter:blur(4px); padding:4px 10px 5px; border-radius:12px; border:1px solid rgba(255,255,255,.12); }
.cns .clock .t{ font-variant-numeric:tabular-nums; font-size:18px; font-weight:800; letter-spacing:.5px; color:var(--gold); line-height:1.05; }
.cns .clock .l{ font-size:8px; letter-spacing:1px; text-transform:uppercase; color:rgba(247,236,239,.7); }
.cns .hero-cap{ position:absolute; left:18px; right:18px; bottom:12px; z-index:2; }
.cns .hero-name{ font-family:var(--serif); font-weight:600; font-size:23px; color:#fff; text-shadow:0 2px 14px rgba(0,0,0,.55); line-height:1.1; }
.cns .hero-role{ font-size:11.5px; color:var(--cream); opacity:.92; margin-top:3px; text-shadow:0 1px 8px rgba(0,0,0,.5); }
.cns .pbar{ height:3px; background:rgba(233,169,191,.12); position:relative; overflow:hidden; }
.cns .pbar i{ position:absolute; left:0; top:0; bottom:0; width:0%; background:linear-gradient(90deg,var(--wine),var(--rose),var(--gold)); transition:width .5s linear; box-shadow:0 0 12px rgba(217,169,107,.6); }
.cns .stepline{ display:flex; justify-content:space-between; padding:9px 20px 0; font-size:10.5px; color:var(--muted2); letter-spacing:.3px; }
.cns .stepline b{ color:var(--gold); font-weight:700; }
.cns .body{ padding:14px 18px 40px; max-width:460px; margin:0 auto; }
.cns .now{ background:linear-gradient(165deg,var(--raise2),var(--raise)); border:1px solid var(--line2); border-radius:20px; padding:18px 17px; position:relative; overflow:hidden; box-shadow:0 18px 40px -24px rgba(0,0,0,.9); }
.cns .now::before{ content:""; position:absolute; inset:0; opacity:.5; pointer-events:none; background:radial-gradient(80% 50% at 15% 0%, rgba(236,110,147,.18), transparent 60%); }
.cns .ey{ font-size:11px; letter-spacing:1.5px; text-transform:lowercase; color:var(--gold); font-weight:700; position:relative; }
.cns .now h2{ font-family:var(--serif); font-weight:500; font-size:20px; line-height:1.28; margin:7px 0 0; position:relative; }
.cns .attnw{ position:relative; }
.cns .attn{ display:inline-flex; align-items:center; gap:6px; margin-top:10px; font-size:10.5px; font-weight:600; color:var(--gold); background:rgba(217,169,107,.12); border:1px solid rgba(217,169,107,.32); padding:4px 10px; border-radius:99px; }
.cns .speaker{ display:flex; align-items:center; gap:8px; margin-top:13px; position:relative; }
.cns .qav{ width:27px; height:27px; border-radius:50%; object-fit:cover; border:1px solid var(--line2); flex:none; }
.cns .speaker span{ font-size:11px; color:var(--muted); font-weight:700; letter-spacing:.3px; }
.cns .quote{ font-family:var(--serif); font-style:italic; font-size:15px; line-height:1.58; color:var(--cream); margin:9px 0 0; position:relative; padding-left:14px; border-left:2px solid var(--rose); }
.cns .quote .hl{ color:var(--gold); font-style:normal; font-weight:600; }
.cns .widget{ margin-top:14px; position:relative; }
.cns .chips{ display:flex; flex-wrap:wrap; gap:7px; }
.cns .chip{ font-size:11.5px; padding:6px 11px; border-radius:99px; border:1px solid var(--line2); background:rgba(233,169,191,.06); color:var(--cream); opacity:0; transform:translateY(6px); animation:cnsRise .5s forwards; }
.cns .chip b{ color:var(--gold); font-weight:700; }
@keyframes cnsRise{to{opacity:1; transform:none}}
.cns .photos{ display:flex; gap:9px; }
.cns .photo{ flex:1; aspect-ratio:3/4; border-radius:12px; position:relative; overflow:hidden; border:1px solid var(--line2); background:linear-gradient(160deg,#3a1928,#24101b); }
.cns .photo span{ position:absolute; bottom:6px; left:0; right:0; text-align:center; font-size:9px; letter-spacing:.5px; color:var(--muted); text-transform:uppercase; }
.cns .photo::after{ content:""; position:absolute; left:0; right:0; height:34%; top:-34%; background:linear-gradient(180deg,transparent,rgba(217,169,107,.5),transparent); animation:cnsScan 2.1s linear infinite; }
@keyframes cnsScan{to{top:120%}}
.cns .list{ display:flex; flex-direction:column; gap:8px; }
.cns .li{ display:flex; align-items:flex-start; gap:9px; font-size:12.5px; line-height:1.4; opacity:0; transform:translateX(-6px); animation:cnsRise .45s forwards; }
.cns .li .mk{ flex:none; width:19px; height:19px; border-radius:50%; display:grid; place-items:center; font-size:11px; font-weight:800; margin-top:1px; }
.cns .li.no .mk{ background:rgba(229,115,138,.15); color:var(--no); border:1px solid rgba(229,115,138,.4); }
.cns .li.no .tx{ color:var(--muted); text-decoration:line-through; text-decoration-color:rgba(229,115,138,.6); }
.cns .li.ok .mk{ background:rgba(111,211,163,.14); color:var(--ok); border:1px solid rgba(111,211,163,.4); }
.cns .li .tx b{ color:var(--cream); font-weight:600; }
.cns .villain{ margin-top:2px; padding:14px; border-radius:16px; text-align:center; background:radial-gradient(120% 120% at 50% 0%, rgba(229,115,138,.22), rgba(122,27,61,.14)); border:1px solid rgba(229,115,138,.4); }
.cns .villain .l{ font-size:10px; letter-spacing:2px; text-transform:uppercase; color:var(--no); font-weight:700; }
.cns .villain .b{ font-family:var(--serif); font-size:22px; margin-top:4px; }
.cns .matrix{ display:grid; grid-template-columns:repeat(6,1fr); gap:5px; }
.cns .cell{ aspect-ratio:1; border-radius:6px; background:rgba(233,169,191,.07); border:1px solid var(--line); animation:cnsGlow 2.4s ease-in-out infinite; }
@keyframes cnsGlow{0%,100%{background:rgba(233,169,191,.05)}50%{background:rgba(217,169,107,.28)}}
.cns .sum{ display:flex; flex-direction:column; gap:13px; }
.cns .timecard{ text-align:center; padding:16px; border-radius:16px; background:radial-gradient(120% 120% at 50% 0%, rgba(217,169,107,.2), rgba(122,27,61,.12)); border:1px solid var(--line2); }
.cns .timecard .big{ font-family:var(--serif); font-size:38px; line-height:1; color:var(--gold); }
.cns .timecard .big small{ font-size:15px; color:var(--cream); }
.cns .timecard .sub{ font-size:11px; color:var(--muted); margin-top:6px; }
.cns .compare{ display:flex; align-items:center; justify-content:center; gap:8px; margin-top:11px; font-size:11.5px; }
.cns .compare .avg{ color:var(--muted2); } .cns .compare .you{ color:var(--gold); font-weight:700; }
.cns .compare .barline{ flex:none; width:120px; height:6px; border-radius:99px; background:rgba(233,169,191,.14); position:relative; overflow:hidden; }
.cns .compare .barline i{ position:absolute; left:0; top:0; bottom:0; border-radius:99px; }
.cns .compare .barline .a{ width:65%; background:var(--muted2); }
.cns .compare .barline .y{ width:100%; background:linear-gradient(90deg,var(--rose),var(--gold)); opacity:.9; height:3px; top:auto; bottom:0; }
.cns .why{ font-size:12.5px; line-height:1.55; color:var(--muted); background:rgba(233,169,191,.05); border:1px solid var(--line); border-radius:13px; padding:12px 13px; }
.cns .why b{ color:var(--cream); }
.cns .stats{ display:grid; grid-template-columns:repeat(2,1fr); gap:8px; }
.cns .stat{ background:rgba(233,169,191,.05); border:1px solid var(--line); border-radius:12px; padding:10px 12px; }
.cns .stat b{ display:block; font-family:var(--serif); font-size:19px; color:var(--gold); line-height:1; }
.cns .stat span{ font-size:10.5px; color:var(--muted); }
.cns .recap-hint{ font-size:12px; color:var(--muted); text-align:center; }
.cns .planbtn{ width:100%; margin-top:2px; padding:15px; border-radius:14px; border:none; cursor:pointer; font-family:var(--sans); font-size:15px; font-weight:800; color:#fff; background:linear-gradient(90deg,var(--wine),var(--rose)); box-shadow:0 14px 30px -12px rgba(236,110,147,.8); transition:.15s; }
.cns .planbtn:disabled{ opacity:.55; cursor:default; box-shadow:none; }
.cns .planbtn:not(:disabled):hover{ filter:brightness(1.06); }
.cns .logwrap{ margin-top:20px; }
.cns .logh{ display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
.cns .logh .t{ font-size:11px; letter-spacing:1.2px; text-transform:uppercase; color:var(--muted); font-weight:700; }
.cns .logh .c{ font-size:11px; color:var(--gold); font-weight:700; font-variant-numeric:tabular-nums; }
.cns .log{ display:flex; flex-direction:column; gap:9px; }
.cns .obs{ display:flex; gap:10px; align-items:flex-start; font-size:12.5px; line-height:1.45; color:var(--muted); padding-bottom:9px; border-bottom:1px solid var(--line); animation:cnsObsin .5s ease; }
.cns .obs:last-child{ border-bottom:0; }
@keyframes cnsObsin{from{opacity:0; transform:translateY(6px)}to{opacity:1; transform:none}}
.cns .obs .ck{ flex:none; width:18px; height:18px; border-radius:50%; background:rgba(111,211,163,.14); border:1px solid rgba(111,211,163,.4); color:var(--ok); display:grid; place-items:center; font-size:10px; font-weight:800; margin-top:1px; }
.cns .obs b{ color:var(--cream); font-weight:600; }
.cns .wait{ position:absolute; inset:0; z-index:20; overflow:hidden; display:flex; align-items:center; justify-content:center; text-align:center; transition:opacity .6s ease; }
.cns .wait.hidden{ opacity:0; pointer-events:none; }
.cns .wait-bg{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; object-position:50% 24%; }
.cns .wait-scrim{ position:absolute; inset:0; background:linear-gradient(180deg, rgba(20,8,16,.72), rgba(20,8,16,.9)); }
.cns .wait-inner{ position:relative; z-index:2; padding:0 26px; width:100%; max-width:420px; }
.cns .wait-live{ display:inline-flex; align-items:center; gap:6px; font-size:10px; font-weight:800; letter-spacing:1px; text-transform:uppercase; color:#fff; background:rgba(236,110,147,.18); border:1px solid rgba(236,110,147,.5); padding:5px 12px; border-radius:99px; }
.cns .wait-live i{ width:6px; height:6px; border-radius:50%; background:#ff5c8a; box-shadow:0 0 8px #ff5c8a; animation:cnsPulse 1.6s infinite; }
.cns .wait-ring{ width:130px; height:130px; border-radius:50%; margin:22px auto 0; position:relative; background:conic-gradient(var(--gold) var(--p,0%), rgba(247,236,239,.14) 0); }
.cns .wait-ring::before{ content:""; position:absolute; inset:7px; border-radius:50%; background:#180a11; }
.cns .wait-num{ position:absolute; inset:0; display:grid; place-items:center; font-variant-numeric:tabular-nums; font-size:29px; font-weight:800; color:var(--cream); }
.cns .wait-h{ font-family:var(--serif); font-weight:500; font-size:21px; line-height:1.28; margin:20px 0 0; color:#fff; }
.cns .queue{ margin:18px auto 0; max-width:300px; display:flex; flex-direction:column; gap:9px; }
.cns .qrow{ display:flex; align-items:center; gap:10px; font-size:13px; padding:11px 14px; border-radius:12px; border:1px solid var(--line); color:var(--muted); background:rgba(255,255,255,.03); }
.cns .qrow.you{ border-color:rgba(217,169,107,.5); background:rgba(217,169,107,.1); color:var(--cream); }
.cns .qrow b{ color:var(--gold); }
.cns .qdot{ width:9px; height:9px; border-radius:50%; background:var(--rose); flex:none; animation:cnsPulse 1.6s infinite; }
.cns .qdot.y{ background:var(--gold); animation:none; }
.cns .wait-sub{ font-size:12.5px; color:var(--muted); margin:16px 0 0; }
@media (prefers-reduced-motion:reduce){ .cns *{ animation-duration:.001s!important; } }
`;

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

interface Stage {
  w: number; label: string; ey: string; title: string; quote: string; obs: string;
  attn?: boolean; widget?: string;
}

function buildStages(d: ConsultaData, minutes: number): { stages: Stage[]; summaryHTML: string } {
  const corTxt = d.cor ? `, <span class="hl">${esc(d.cor)}</span>` : '';
  const quimList = d.quimica.length
    ? d.quimica.slice(0, 3).map(q => `<span class="chip">${esc(q)}</span>`).join('')
    : '';
  const chips = (items: string[]) => `<div class="chips">${items.map(i => `<span class="chip">${i}</span>`).join('')}</div>`;
  const listW = (kind: 'no' | 'ok', items: string[]) =>
    `<div class="list">${items.map((t, i) => `<div class="li ${kind}" style="animation-delay:${i * 0.28}s"><span class="mk">${kind === 'no' ? '✕' : '✓'}</span><span class="tx">${t}</span></div>`).join('')}</div>`;

  const quimicaStage: Stage = d.temQuimica
    ? { w: 2, label: 'suas químicas', ey: 'o que você já fez',
        title: 'Levando em conta o que você já fez',
        quote: `Você me contou que fez <span class="hl">${esc(d.quimica.join(' e '))}</span>. Pra mim isso pesa MUITO — não dá pra tratar igual um cabelo virgem. Vou ter que dosar proteína e água com jeitinho, senão em vez de ajudar eu endureço seu fio.`,
        widget: `<div class="chips">${quimList}<span class="chip">cuidado: proteína demais endurece</span></div>`,
        obs: `Você já passou por ${esc(d.quimica.join(', '))} — vou dosar proteína e água com cuidado` }
    : { w: 2, label: 'seu histórico', ey: 'o histórico do seu fio',
        title: 'Vendo o histórico do seu cabelo',
        quote: `Seu cabelo não tem química pesada recente — isso me dá mais liberdade pra trabalhar, mas não quer dizer descuido: <span class="hl">todo fio</span> pede o equilíbrio certo pra não ressecar nem pesar.`,
        widget: chips(['sem química pesada recente', 'foco em manter a saúde do fio']),
        obs: 'Sem química pesada recente — dá pra trabalhar com mais liberdade' };

  const descartes: string[] = [];
  descartes.push(d.temQuimica
    ? 'reconstrução toda semana — seu fio já passou por química e ia ficar <b>duro</b>'
    : 'reconstrução toda semana — <b>proteína demais</b> endurece o fio à toa');
  descartes.push('receita genérica de internet — <b>não</b> foi pensada pro SEU cabelo');
  descartes.push(d.couroKind === 'oleoso'
    ? 'lavar sem shampoo — seu <b>couro oleoso</b> não permite'
    : d.couroKind === 'seco'
      ? 'lavar demais — ia <b>ressecar</b> ainda mais seu couro'
      : 'produto pesado na raiz — ia <b>sobrecarregar</b> o fio');
  descartes.push('exagerar na quantidade — <b>mais não é melhor</b>, sobrecarrega o cabelo');

  const compat = [
    'hidratação e nutrição na <b>dose certa</b> pro seu fio',
    `os produtos que <b>casam</b> com ${esc(d.tipo.toLowerCase())}${d.cor ? ` ${esc(d.cor)}` : ''}`,
    'reconstrução <b>na medida</b>, sem exagero',
    'finalização com <b>leave-in + tônico</b> pra proteger no dia a dia',
  ];

  const stages: Stage[] = [
    { w: 1, label: 'começando', ey: 'oi, chegou aqui 💛',
      title: 'Deixa eu começar a olhar seu cabelo',
      quote: `Oi, <span class="hl">${esc(d.nome)}</span>! Suas fotos acabaram de cair aqui pra mim. Vou olhar tudo com calma, do meu jeito — um pedacinho de cada vez. Fica comigo que eu vou te contando o que for vendo, tá bom?`,
      obs: 'Recebi suas fotos e comecei a te olhar' },
    { w: 2, label: 'suas fotos', ey: 'primeiro, suas fotos',
      title: 'Abrindo suas fotos pra ver de pertinho',
      quote: 'Deixa eu dar um zoom aqui... a frente, o comprimento e a raiz. É de perto assim que eu enxergo o que no espelho a gente nem percebe. E já tô vendo coisa 👀',
      widget: `<div class="photos">${['Frente', 'Comprimento', 'Raiz'].map(l => `<div class="photo"><span>${l}</span></div>`).join('')}</div>`,
      obs: 'Olhei suas fotos de bem perto (frente, comprimento e raiz)' },
    { w: 3, label: 'seu couro', ey: 'seu couro cabeludo',
      title: 'Olhando bem a sua raiz',
      quote: `Óh, seu couro é <span class="hl">${esc(d.couro)}</span>, e o comprimento pede outra coisa. Não dá pra cuidar da raiz igual às pontas — cada parte quer um cuidado diferente.`,
      widget: chips([`couro: <b>${esc(d.couro)}</b>`, 'comprimento pede cuidado próprio', 'cada parte, um cuidado']),
      obs: `Seu couro é ${esc(d.couro)} e o comprimento pede outro cuidado` },
    { w: 3, label: 'fio e pontas', ey: 'seu fio e suas pontas',
      title: 'Agora o fio e as pontas, com cuidado',
      quote: d.porosidadeAlta
        ? 'Seu fio é bem <span class="hl">poroso</span> — ele bebe água num instante e perde do mesmo jeito, por isso resseca fácil. As pontas tão pedindo pra <span class="hl">selar</span>, não pra colocar mais peso.'
        : 'Olhando o fio e as pontas: a cutícula precisa de atenção pra <span class="hl">segurar</span> a hidratação. As pontas tão pedindo selagem e um cuidado mais gentil.',
      widget: chips(d.porosidadeAlta ? ['porosidade alta', 'cutícula aberta', 'pontas pedindo selagem'] : ['cutícula pede atenção', 'pontas pedindo selagem']),
      obs: d.porosidadeAlta ? 'Fio poroso (resseca rápido) e pontas pedindo selagem' : 'Fio e pontas pedindo selagem e cuidado gentil' },
    quimicaStage,
    { w: 1, label: 'tipo e cor', ey: 'seu tipo de cabelo',
      title: 'Confirmando o que a foto me mostra',
      quote: `Pela foto dá pra ver certinho: <span class="hl">${esc(d.tipo.toLowerCase())}</span>${corTxt}. Isso já me diz o que combina com você — e o que definitivamente não é pro seu caso.`,
      widget: chips([`<b>${esc(d.tipo)}</b>`].concat(d.cor ? [`<b>${esc(d.cor)}</b>`] : [])),
      obs: `${esc(d.tipo)}${d.cor ? ', ' + esc(d.cor) : ''} — vi certinho na foto` },
    { w: 4, label: 'juntando tudo', ey: 'agora junto tudo', attn: true,
      title: 'Juntando tudo na cabeça (essa parte dá trabalho)',
      quote: 'Deixa eu cruzar tudo agora: seu tipo de fio, o couro, a porosidade, as químicas e o que mais te incomoda. Olha, o seu caso é <span class="hl">daqueles que dão trabalho</span> de verdade — tem muita coisa junta. Vou com calma aqui.',
      widget: `<div class="matrix">${Array.from({ length: 24 }, (_, i) => `<div class="cell" style="animation-delay:${i * 0.09}s"></div>`).join('')}</div>`,
      obs: 'Cruzei tudo: tipo, couro, porosidade, química e o que te incomoda' },
    { w: 4, label: 'o que eu tiro', ey: 'o que eu vou tirar da frente', attn: true,
      title: 'Já vou tirando o que não serve pra você',
      quote: 'Cuidar bem também é saber o que <span class="hl">NÃO</span> fazer — e no seu caso isso é ainda mais importante. Já corto fora:',
      widget: listW('no', descartes),
      obs: 'Cortei fora algumas abordagens que não combinam com você' },
    { w: 3, label: 'o que combina', ey: 'o que combina de verdade',
      title: 'Vendo o que casa com o seu cabelo',
      quote: 'Agora eu fico só com o que passa no teste pro seu caso:',
      widget: listW('ok', compat),
      obs: 'Separei o que casa certinho com o seu cabelo' },
    { w: 2, label: 'o principal', ey: 'achei 💡',
      title: 'Achei o que mais te atrapalha',
      quote: 'Pronto — agora ficou claro pra mim. O que mais rouba a beleza do seu cabelo hoje é isso aqui, ó:',
      widget: `<div class="villain"><div class="l">o principal</div><div class="b">${esc(d.problema)}</div></div>`,
      obs: `Descobri seu principal ponto de atenção: ${esc(d.problema)}` },
    { w: 1, label: 'terminei', ey: 'terminei 💛',
      title: 'Prontinho, terminei de te olhar',
      quote: `Ufa! Terminei de te analisar, <span class="hl">${esc(d.nome)}</span>. Seu caso me pediu mais atenção que a média — mas é assim que eu gosto de fazer, com cuidado. Seu plano de 90 dias já tá aqui, montado só pra você.`,
      widget: '__SUMMARY__',
      obs: 'Terminei sua análise e montei seu plano de 90 dias' },
  ];

  const descCount = descartes.length, compCount = compat.length;
  const summaryHTML = `<div class="sum">
    <div class="timecard"><div class="big">${minutes}<small> min</small></div>
    <div class="sub">foi quanto eu levei no SEU cabelo</div>
    <div class="compare"><span class="avg">média ${CONSULTA_AVG_MIN}min</span>
    <span class="barline"><i class="a"></i><i class="y"></i></span><span class="you">você ${minutes}min</span></div></div>
    <div class="why">Seu caso me pediu mais tempo porque tem <b>bastante coisa pra equilibrar ao mesmo tempo</b>${d.temQuimica ? ' (inclusive a química que você já fez)' : ''} — e cada detalhe muda o que eu posso (e o que eu não posso) fazer. Por isso eu fui devagar, pra não errar com você.</div>
    <div class="stats">
      <div class="stat"><b>${stages.length}</b><span>etapas de análise</span></div>
      <div class="stat"><b>+20</b><span>variáveis cruzadas</span></div>
      <div class="stat"><b>${descCount}</b><span>coisas descartadas</span></div>
      <div class="stat"><b>${compCount}</b><span>ativos aprovados</span></div>
    </div>
    <div class="recap-hint">Tudo que eu reparei tá logo aqui embaixo 👇</div>
    <button class="planbtn" id="cns-planbtn" disabled>Seu plano abre em <span id="cns-unlock">…</span></button>
  </div>`;

  return { stages, summaryHTML };
}

function ConsultaInner({ data, startMs, endMs, minutes, revisao = false }: {
  data: ConsultaData; startMs: number; endMs: number; minutes: number;
  /**
   * Modo revisão (equipe). A consulta normal é ancorada em tempo real: as
   * etapas avançam conforme o relógio caminha de plan_requested_at até
   * plan_released_at. Isso torna a experiência impossível de revisar — janela
   * curta passa voando, janela longa trava nas duas primeiras etapas e a
   * pessoa nunca chega no fim.
   *
   * Com `revisao`, o relógio sai de cena: a fila é dispensada e as 11 etapas
   * viram navegação manual, com passar/voltar e um play automático. Serve para
   * conferir texto e layout de cada etapa sem depender de estar dentro da
   * janela certa.
   */
  revisao?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const reloadedRef = useRef(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const q = (sel: string) => root.querySelector(sel) as HTMLElement | null;

    const QUEUE_MS = 30_000;
    const consultStart = startMs + QUEUE_MS;
    const consultTotal = Math.max(60_000, endMs - consultStart); // nunca zero
    const { stages, summaryHTML } = buildStages(data, minutes);
    const totalW = stages.reduce((s, x) => s + x.w, 0);
    const cum: number[] = [];
    stages.reduce((acc, x, i) => (cum[i] = acc + x.w, acc + x.w), 0);

    const fmt = (sec: number) => { sec = Math.max(0, Math.round(sec)); const m = Math.floor(sec / 60), s = sec % 60; return m + ':' + (s < 10 ? '0' : '') + s; };
    const stageAtProgress = (p: number) => { const target = p * totalW; for (let i = 0; i < stages.length; i++) if (target < cum[i]) return i; return stages.length - 1; };

    let curStage = -1;
    function addObs(i: number) {
      const log = q('#cns-log'); if (!log) return;
      const d = document.createElement('div'); d.className = 'obs';
      d.innerHTML = '<span class="ck">✓</span><span>' + stages[i].obs + '</span>';
      log.appendChild(d);
      const n = log.children.length;
      const c = q('#cns-obscount'); if (c) c.textContent = n + (n === 1 ? ' coisa' : ' coisas');
    }
    function renderStage(i: number) {
      const s = stages[i];
      const set = (id: string, html: string) => { const e = q(id); if (e) e.innerHTML = html; };
      set('#cns-ey', s.ey); set('#cns-title', s.title);
      set('#cns-attn', s.attn ? '<span class="attn">⏳ no seu caso, essa parte leva mais tempo</span>' : '');
      set('#cns-quote', s.quote);
      set('#cns-widget', s.widget === '__SUMMARY__' ? summaryHTML : (s.widget || ''));
      const sn = q('#cns-stepn'); if (sn) sn.textContent = String(i + 1);
      const sl = q('#cns-steplabel'); if (sl) sl.textContent = s.label;
    }

    // ── Modo revisão: navegação manual pelas etapas ──────────────────
    if (revisao) {
      const wait = q('#cns-wait');
      if (wait) wait.classList.add('hidden'); // sem fila: ela não é o objeto da revisão
      let i = 0;
      let tocando = true;
      let timer = 0;

      const pinta = () => {
        // Refaz o log do zero para o índice atual, para que voltar também
        // volte a lista de observações — senão ela só cresce.
        const log = q('#cns-log');
        if (log) log.innerHTML = '';
        for (let k = 0; k <= i; k++) addObs(k);
        renderStage(i);
        const pf = q('#cns-pfill');
        if (pf) pf.style.width = (((i + 1) / stages.length) * 100) + '%';
        const ck = q('#cns-clock');
        if (ck) ck.textContent = `${minutes}:00`;
        const pos = q('#cns-rev-pos');
        if (pos) pos.textContent = `${i + 1} / ${stages.length}`;
        const btnPlay = q('#cns-rev-play');
        if (btnPlay) btnPlay.textContent = tocando ? '⏸ pausar' : '▶ tocar';
        const btn = q('#cns-planbtn') as HTMLButtonElement | null;
        // No fim das etapas o botão do plano libera, igual à cliente vê.
        if (btn) {
          const fim = i === stages.length - 1;
          btn.disabled = !fim;
          btn.textContent = fim ? 'Ver meu plano →' : btn.textContent;
        }
      };

      const agenda = () => {
        clearTimeout(timer);
        if (!tocando) return;
        timer = window.setTimeout(() => {
          if (i < stages.length - 1) { i++; pinta(); agenda(); }
          else { tocando = false; pinta(); }
        }, 5000);
      };

      const onRev = (e: Event) => {
        const t = (e.target as HTMLElement)?.closest('button');
        if (!t) return;
        if (t.id === 'cns-rev-prev' && i > 0) { i--; tocando = false; pinta(); agenda(); }
        if (t.id === 'cns-rev-next' && i < stages.length - 1) { i++; tocando = false; pinta(); agenda(); }
        if (t.id === 'cns-rev-play') { tocando = !tocando; pinta(); agenda(); }
      };
      root.addEventListener('click', onRev);
      pinta();
      agenda();
      return () => { clearTimeout(timer); root.removeEventListener('click', onRev); };
    }

    let raf = 0;
    function tick() {
      const now = Date.now();
      const wait = q('#cns-wait');
      if (now < consultStart) {
        // Fila de espera
        const rem = Math.max(0, (consultStart - now) / 1000);
        const wn = q('#cns-waitnum'); if (wn) wn.textContent = fmt(rem);
        const ring = q('.wait-ring'); if (ring) ring.style.setProperty('--p', Math.min(100, (1 - rem / (QUEUE_MS / 1000)) * 100) + '%');
        raf = requestAnimationFrame(tick); return;
      }
      if (wait && !wait.classList.contains('hidden')) wait.classList.add('hidden');

      const elapsed = now - consultStart;
      const p = Math.min(1, elapsed / consultTotal);
      const pf = q('#cns-pfill'); if (pf) pf.style.width = (p * 100) + '%';
      const ck = q('#cns-clock'); if (ck) ck.textContent = fmt(Math.max(0, (endMs - now) / 1000));

      const si = stageAtProgress(p);
      if (si !== curStage) { for (let k = curStage + 1; k <= si; k++) addObs(k); curStage = si; renderStage(si); }

      // Desbloqueio do plano
      if (now >= endMs) {
        const btn = q('#cns-planbtn') as HTMLButtonElement | null;
        if (btn) { btn.disabled = false; btn.textContent = 'Ver meu plano →'; }
        // auto-revela depois de uma folga, caso a pessoa não clique
        if (!reloadedRef.current && now >= endMs + 4000) { reloadedRef.current = true; window.location.reload(); }
      } else {
        const un = q('#cns-unlock'); if (un) un.textContent = fmt((endMs - now) / 1000);
      }
      raf = requestAnimationFrame(tick);
    }

    function onClick(e: Event) {
      const t = e.target as HTMLElement;
      if (t && t.closest('#cns-planbtn') && Date.now() >= endMs) window.location.reload();
    }
    root.addEventListener('click', onClick);
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); root.removeEventListener('click', onClick); };
  }, [data, startMs, endMs, minutes, revisao]);

  return (
    <div className="cns" ref={rootRef}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {revisao && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: '#2A1E2C', color: '#fff',
          padding: '10px 14px', display: 'flex', alignItems: 'center',
          gap: 10, flexWrap: 'wrap', fontFamily: 'system-ui, sans-serif', fontSize: 13,
        }}>
          <strong style={{ letterSpacing: 0.4 }}>MODO REVISÃO</strong>
          <span style={{ opacity: 0.7 }}>a cliente não vê esta barra</span>
          <span style={{ flex: 1 }} />
          <button id="cns-rev-prev" style={BTN_REV}>‹ voltar</button>
          <span id="cns-rev-pos" style={{ minWidth: 52, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>1 / 11</span>
          <button id="cns-rev-next" style={BTN_REV}>passar ›</button>
          <button id="cns-rev-play" style={BTN_REV}>⏸ pausar</button>
        </div>
      )}

      <div className="hero">
        <Picture src="/images/consulta-hero.jpg" alt="Juliane Cost analisando o seu caso" />
        <div className="hero-grad" />
        <div className="hero-top">
          <span className="live"><i /> Com você agora</span>
          <div className="clock"><div className="t" id="cns-clock">{Math.round((endMs - Date.now()) / 60000)}:00</div><div className="l">restante</div></div>
        </div>
        <div className="hero-cap">
          <div className="hero-name">Juliane Cost</div>
          <div className="hero-role">Tricologista · analisando o seu caso agora</div>
        </div>
      </div>
      <div className="pbar"><i id="cns-pfill" /></div>
      <div className="stepline"><span>etapa <b id="cns-stepn">1</b> de 11</span><span id="cns-steplabel">começando</span></div>

      <div className="body">
        <div className="now">
          <div className="ey" id="cns-ey">oi, chegou aqui 💛</div>
          <h2 id="cns-title">Deixa eu começar a olhar seu cabelo</h2>
          <div className="attnw" id="cns-attn" />
          <div className="speaker"><Picture className="qav" src="/images/consulta-face.jpg" alt="Juliane" /><span>Juliane</span></div>
          <div className="quote" id="cns-quote" />
          <div className="widget" id="cns-widget" />
        </div>
        <div className="logwrap">
          <div className="logh"><span className="t">O que eu já reparei no seu cabelo</span><span className="c" id="cns-obscount">1 coisa</span></div>
          <div className="log" id="cns-log" />
        </div>
      </div>

      <div className="wait" id="cns-wait">
        <Picture className="wait-bg" src="/images/consulta-hero.jpg" alt="" />
        <div className="wait-scrim" />
        <div className="wait-inner">
          <span className="wait-live"><i /> Consulta ao vivo</span>
          <div className="wait-ring"><div className="wait-num" id="cns-waitnum">0:30</div></div>
          <h2 className="wait-h">A Juliane está finalizando<br />o atendimento de outra cliente</h2>
          <div className="queue">
            <div className="qrow"><span className="qdot" /> Em atendimento agora</div>
            <div className="qrow you"><span className="qdot y" /> <b>Você</b> — próxima da fila</div>
          </div>
          <p className="wait-sub">Já já é a sua vez, fica aqui comigo 💛</p>
        </div>
      </div>
    </div>
  );
}

// Rede de segurança: se a experiência falhar por qualquer motivo, a cliente NÃO
// vê tela quebrada — mostra um recado gentil e a página se atualiza sozinha até o
// plano abrir (o plano em si é servido por outro caminho, intocado).
function ConsultaFallback() {
  useEffect(() => {
    const id = setInterval(() => window.location.reload(), 45_000);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 24, color: '#7A1B3D', fontFamily: 'Georgia, serif' }}>
      <div>
        <div style={{ fontSize: 22, marginBottom: 8 }}>A Juliane está preparando o seu plano 💛</div>
        <div style={{ fontSize: 14, opacity: 0.8, fontFamily: 'system-ui, sans-serif' }}>Ele abre pra você em instantes…</div>
      </div>
    </div>
  );
}

class ConsultaBoundary extends Component<{ children: ReactNode }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  render() { return this.state.err ? <ConsultaFallback /> : this.props.children; }
}

const BTN_REV: React.CSSProperties = {
  background: 'rgba(255,255,255,0.14)', color: '#fff',
  border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8,
  padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  fontFamily: 'inherit',
};

export default function Consulta(props: {
  data: ConsultaData; startMs: number; endMs: number; minutes: number; revisao?: boolean;
}) {
  return <ConsultaBoundary><ConsultaInner {...props} /></ConsultaBoundary>;
}
