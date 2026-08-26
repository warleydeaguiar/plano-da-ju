#!/usr/bin/env node
/**
 * Revisão do FAQ em duas passadas, antes de qualquer pergunta ir ao ar.
 *
 * PASSADA 1 — regra mecânica. Barata, determinística, roda em tudo: promessa
 * de resultado, orientação médica, referência ao próprio texto ("o artigo
 * diz") e resposta que na verdade não responde ("não é especificado").
 *
 * PASSADA 2 — checagem contra a fonte. Um segundo modelo recebe o artigo e as
 * perguntas e tem uma tarefa só: achar afirmação que o artigo NÃO sustenta.
 * É adversarial de propósito — ele procura erro, não confirma acerto. Quem
 * gerou não é quem aprova.
 *
 * Só passa quem sobrevive às duas. O resto fica com o motivo registrado.
 *
 *   node scripts/revisar-faq-site.mjs --dry     # relata sem gravar
 *   node scripts/revisar-faq-site.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODELO = 'anthropic/claude-sonnet-4-6';
const DRY = process.argv.includes('--dry');

function carregarEnv() {
  for (const f of ['apps/web/.env.local', '.env.local']) {
    const p = path.join(RAIZ, f);
    if (!fs.existsSync(p)) continue;
    for (const linha of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}
carregarEnv();
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const IA_KEY = process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY;

async function supa(caminho, opcoes = {}) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${caminho}`, {
    ...opcoes,
    headers: {
      apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json', ...(opcoes.headers || {}),
    },
  });
  if (!r.ok) throw new Error(`Supabase ${caminho}: ${r.status} ${(await r.text()).slice(0, 250)}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

const semTags = (html) =>
  String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// ------------------------------------------------------- passada 1: mecânica
/**
 * As regras precisam ser CIRÚRGICAS.
 *
 * A primeira versão pegava "garantindo que os ativos sejam absorvidos" como
 * promessa de resultado (é só gerúndio) e reprovava "recomendo buscar
 * orientação médica" e "a alopecia androgenética não tem cura" por conterem
 * palavra médica — justamente as respostas mais responsáveis do conjunto.
 * Regra que reprova o comportamento certo é pior que regra nenhuma: ensina a
 * ignorar o alerta.
 *
 * Então: promessa é promessa feita À LEITORA sobre o resultado DELA, e o
 * problema médico é PRESCREVER, não mencionar medicina. Mandar procurar
 * médico é exatamente o que queremos que a resposta faça.
 */
const REGRAS = [
  {
    nome: 'promete resultado à leitora',
    re: /\b(resultado[s]? garantid\w+|garant(?:o|imos) que (?:voc[êe]|seu|sua)|com certeza (?:vai|voc[êe]|seu)|100\s?% de (?:efic|garant|result|sucesso)|funciona em (?:todos os|qualquer) (?:casos?|tipos?|cabelos?)|nunca falha|sem risco (?:nenhum|algum))\b/i,
  },
  {
    nome: 'prescreve tratamento',
    re: /\b(receito|prescrevo|prescre[vc]\w* para voc[êe]|tome \d|tomar \d+\s?(?:mg|ml|comprimid)|dose de \d|posologia|dispensa (?:a )?(?:consulta|avalia[çc][ãa]o) m[ée]dic|n[ãa]o precisa (?:de |ir ao )?m[ée]dic)\b/i,
  },
  {
    nome: 'refere-se ao próprio texto',
    re: /\b(o artigo|no artigo|deste artigo|a lista acima|como vimos|neste texto|mencionad\w+ acima|citad\w+ acima|no post)\b/i,
  },
  {
    nome: 'não responde',
    re: /\b(n[ãa]o (?:[ée] )?(?:especifica\w*|menciona\w*|informa\w*|detalha\w*|deixa claro)|n[ãa]o h[áa] informa[çc])\b/i,
  },
  { nome: 'resposta curta demais', teste: (q) => q.resposta.trim().length < 60 },
];

function passada1(q) {
  for (const r of REGRAS) {
    if (r.teste ? r.teste(q) : r.re.test(q.resposta) || r.re.test(q.pergunta)) return r.nome;
  }
  return null;
}

// --------------------------------------------- passada 2: checagem na fonte
const PROMPT = `Você audita perguntas frequentes de um blog de cuidados capilares.

Recebe o ARTIGO original e uma lista de PERGUNTAS com respostas escritas a partir dele.

Sua tarefa é UMA só: encontrar resposta que o artigo não sustenta. Você não está aqui para confirmar que está bom — está aqui para achar problema. Na dúvida, reprove.

Reprove a resposta que:
- afirme fato, marca, ingrediente, prazo ou preço que não esteja no artigo
- dê orientação médica, prometa resultado ou generalize além do que o texto diz
- contradiga o artigo
- não responda de verdade à pergunta

Aprove apenas o que estiver claramente apoiado no artigo.

Responda APENAS com JSON, sem cerca de código:
{"veredito":[{"i":0,"ok":true},{"i":1,"ok":false,"motivo":"cita prazo de 3 meses que não está no artigo"}]}`;

async function passada2(artigo, perguntas) {
  const lista = perguntas.map((q, i) => `[${i}] P: ${q.pergunta}\n    R: ${q.resposta}`).join('\n\n');
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${IA_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODELO,
      max_tokens: 1500,
      temperature: 0,
      messages: [
        { role: 'system', content: PROMPT },
        { role: 'user', content: `ARTIGO:\n${artigo.slice(0, 14000)}\n\nPERGUNTAS:\n${lista}` },
      ],
    }),
  });
  if (!r.ok) throw new Error(`IA ${r.status}`);
  const d = await r.json();
  const bruto = (d.choices?.[0]?.message?.content || '').replace(/```(?:json)?/g, '').trim();
  const ini = bruto.indexOf('{');
  const fim = bruto.lastIndexOf('}');
  if (ini < 0 || fim <= ini) throw new Error('resposta sem JSON');
  const parsed = JSON.parse(bruto.slice(ini, fim + 1));
  return Array.isArray(parsed.veredito) ? parsed.veredito : [];
}

// ------------------------------------------------------------------ execução
(async () => {
  if (!IA_KEY) { console.error('Faltou OPENROUTER_API_KEY.'); process.exit(1); }

  const faqs = await supa('site_faq?revisao_status=eq.pendente&select=id,content_id,pergunta,resposta,ordem&order=content_id,ordem&limit=2000');
  if (!faqs.length) { console.log('\nNada pendente.\n'); return; }

  const ids = [...new Set(faqs.map((f) => f.content_id))];
  const posts = await supa(`site_content?id=in.(${ids.join(',')})&select=id,title,path,content_clean`);
  const porId = new Map(posts.map((p) => [p.id, p]));

  console.log(`\nRevisão dupla do FAQ  |  ${faqs.length} perguntas em ${ids.length} posts${DRY ? '  [DRY-RUN]' : ''}\n`);

  const reprovadas = new Map();          // id -> motivo
  const porMotivo = {};

  // ---- passada 1
  let barradas1 = 0;
  for (const q of faqs) {
    const motivo = passada1(q);
    if (motivo) {
      reprovadas.set(q.id, `regra: ${motivo}`);
      porMotivo[motivo] = (porMotivo[motivo] || 0) + 1;
      barradas1++;
    }
  }
  console.log(`  passada 1 (regra mecânica): ${barradas1} reprovadas`);
  for (const [m, n] of Object.entries(porMotivo)) console.log(`      ${n.toString().padStart(3)}  ${m}`);

  // ---- passada 2: só no que sobreviveu
  let barradas2 = 0, erros = 0, auditados = 0;
  for (const [n, cid] of ids.entries()) {
    const post = porId.get(cid);
    const doPost = faqs.filter((f) => f.content_id === cid && !reprovadas.has(f.id));
    if (!post || !doPost.length) continue;
    try {
      const veredito = await passada2(semTags(post.content_clean), doPost);
      for (const v of veredito) {
        const q = doPost[v.i];
        if (!q) continue;
        if (v.ok === false) {
          reprovadas.set(q.id, `fonte: ${String(v.motivo || 'não sustentado pelo artigo').slice(0, 200)}`);
          barradas2++;
        }
      }
      auditados++;
    } catch (e) {
      // Falha de auditoria não pode virar aprovação por omissão.
      for (const q of doPost) reprovadas.set(q.id, `auditoria falhou: ${e.message.slice(0, 80)}`);
      erros++;
    }
    if ((n + 1) % 20 === 0) console.log(`  passada 2: ${n + 1}/${ids.length} posts auditados`);
  }
  console.log(`  passada 2 (checagem na fonte): ${barradas2} reprovadas  |  ${auditados} posts auditados  |  ${erros} falhas`);

  // ---- gravação
  const aprovadas = faqs.filter((f) => !reprovadas.has(f.id));
  console.log(`\n  APROVADAS:  ${aprovadas.length}`);
  console.log(`  REPROVADAS: ${reprovadas.size}`);

  if (!DRY) {
    const agora = new Date().toISOString();
    for (const f of aprovadas) {
      await supa(`site_faq?id=eq.${f.id}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ revisado: true, revisao_status: 'aprovada', revisado_em: agora }),
      });
    }
    for (const [id, motivo] of reprovadas) {
      await supa(`site_faq?id=eq.${id}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ revisado: false, revisao_status: 'reprovada', revisao_motivo: motivo, revisado_em: agora }),
      });
    }
    console.log('\n  gravado.');
  }

  const amostra = [...reprovadas.entries()].slice(0, 10);
  if (amostra.length) {
    console.log('\n  amostra do que foi barrado:');
    for (const [id, motivo] of amostra) {
      const q = faqs.find((f) => f.id === id);
      console.log(`    "${q.pergunta.slice(0, 58)}"\n       ${motivo.slice(0, 110)}`);
    }
  }
  console.log('');
})().catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
