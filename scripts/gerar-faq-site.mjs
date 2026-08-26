#!/usr/bin/env node
/**
 * Gera as perguntas frequentes de cada artigo a partir do próprio texto dele.
 *
 * A regra é rígida: a resposta só pode usar o que o artigo já afirma. O modelo
 * não inventa recomendação de química capilar — se o texto não responde, a
 * pergunta não entra. E nada é publicado como revisado: quem valida conteúdo
 * sobre cabelo é a tricologista, não este script.
 *
 * Retomável: pula quem já tem FAQ.
 *
 *   node scripts/gerar-faq-site.mjs --limite=5    # testar em poucos
 *   node scripts/gerar-faq-site.mjs               # todos os posts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODELO = 'anthropic/claude-sonnet-4-6';
const LIMITE = Number((process.argv.find((a) => a.startsWith('--limite=')) || '').slice(9)) || 0;

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

const PROMPT = `Você recebe um artigo de um blog brasileiro sobre cuidados capilares, escrito por uma tricologista.

Escreva de 3 a 5 perguntas frequentes que uma leitora faria DEPOIS de ler o artigo — dúvidas práticas que o texto não responde de forma direta, mas cuja resposta pode ser deduzida do que ele afirma.

Regras que não podem ser quebradas:
- A resposta usa SOMENTE informação contida no artigo. Não acrescente fato, marca, preço ou recomendação que não esteja lá.
- Se o artigo não der base para responder, não faça a pergunta. Menos perguntas é melhor que pergunta inventada.
- Nunca dê orientação médica nem prometa resultado.
- Pergunta em linguagem de busca real, como a leitora digitaria no Google.
- Resposta de 2 a 4 frases, direta, na voz da própria autora (primeira pessoa quando couber).
- NUNCA se refira ao texto ("o artigo diz", "a lista acima", "como vimos"). Quem responde é a
  autora falando com a leitora, e ela não comenta o próprio artigo. Se a única resposta possível
  fosse "o artigo não especifica", então simplesmente NÃO faça essa pergunta.
- Português do Brasil, sem travessão.

Responda APENAS com JSON válido, sem cerca de código:
{"perguntas":[{"pergunta":"...","resposta":"..."}]}`;

async function gerar(titulo, texto) {
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${IA_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODELO,
      max_tokens: 1600,
      temperature: 0.3,
      messages: [
        { role: 'system', content: PROMPT },
        { role: 'user', content: `TÍTULO: ${titulo}\n\nARTIGO:\n${texto.slice(0, 14000)}` },
      ],
    }),
  });
  if (!r.ok) throw new Error(`IA ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  const bruto = d.choices?.[0]?.message?.content || '';
  // O modelo às vezes responde em prosa ("O artigo fala sobre...") em vez de
  // JSON. Pescar o primeiro bloco {...} evita perder o item inteiro por isso.
  const limpo = bruto.replace(/```(?:json)?/g, '').trim();
  const inicio = limpo.indexOf('{');
  const fim = limpo.lastIndexOf('}');
  if (inicio < 0 || fim <= inicio) return [];
  const parsed = JSON.parse(limpo.slice(inicio, fim + 1));
  return Array.isArray(parsed.perguntas) ? parsed.perguntas : [];
}

(async () => {
  if (!IA_KEY) { console.error('Faltou OPENROUTER_API_KEY.'); process.exit(1); }

  const jaTem = await supa('site_faq?select=content_id');
  const comFaq = new Set((jaTem || []).map((f) => f.content_id));

  const posts = await supa(
    `site_content?kind=eq.post&select=id,title,path,content_clean&order=id&limit=${LIMITE || 500}`,
  );
  const pendentes = posts.filter((p) => !comFaq.has(p.id) && (p.content_clean || '').length > 800);

  console.log(`\nGerando FAQ  |  posts sem FAQ: ${pendentes.length}\n`);
  let ok = 0, vazios = 0, erros = 0;

  for (const [i, p] of pendentes.entries()) {
    try {
      const perguntas = await gerar(p.title, semTags(p.content_clean));
      if (!perguntas.length) { vazios++; continue; }
      await supa('site_faq?on_conflict=content_id,pergunta', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(
          perguntas.slice(0, 5).map((q, n) => ({
            content_id: p.id,
            pergunta: String(q.pergunta || '').trim().slice(0, 300),
            resposta: String(q.resposta || '').trim().slice(0, 1200),
            ordem: n,
          })).filter((q) => q.pergunta && q.resposta),
        ),
      });
      ok++;
    } catch (e) {
      erros++;
      console.log(`  erro em ${p.path.slice(0, 50)}: ${e.message.slice(0, 90)}`);
    }
    if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${pendentes.length}  (${ok} ok, ${vazios} sem base, ${erros} erro)`);
  }

  console.log(`\n  com FAQ: ${ok} | sem base para responder: ${vazios} | erros: ${erros}`);
  console.log('  Todas entram como NÃO revisadas — a Juliane valida antes de publicar.\n');
})().catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
