// Testa o MÓDULO REAL de produção (plan-generator.ts) com um stub de Supabase.
// Rode: node --experimental-strip-types scripts/pdf/harness.ts <userId>
import { readFileSync } from 'node:fs';
import { generatePlanWithClaude } from '../../apps/web/lib/plan-generator.ts';

const BASE = 'https://db.planodaju.julianecost.com';
const env = readFileSync(new URL('../../apps/web/.env.local', import.meta.url).pathname, 'utf8');
const SK = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)![1].trim().replace(/^["']|["']$/g, '');
process.env.OPENROUTER_API_KEY = env.match(/OPENROUTER_API_KEY=(.+)/)![1].trim().replace(/^["']|["']$/g, '');

const userId = process.argv[2];
if (!userId) { console.error('uso: harness.ts <userId>'); process.exit(1); }

async function rest(path: string) {
  const r = await fetch(`${BASE}/rest/v1/${path}`, { headers: { apikey: SK, Authorization: `Bearer ${SK}` } });
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json();
}

// Catálogo real (mesma query do loadCatalog).
const catalog = await rest('products?active=eq.true&parent_product_id=is.null&select=id,name,brand,category,hair_types,is_priority,is_ybera&order=is_priority.desc&limit=50');

// Stub mínimo de Supabase: só precisa responder ao .from('products')... com {data}.
const thenable = (data: any) => {
  const o: any = {};
  for (const m of ['select', 'eq', 'is', 'order', 'not', 'update', 'delete', 'insert']) o[m] = () => o;
  o.limit = () => Promise.resolve({ data });
  o.then = (res: any) => res({ data });
  return o;
};
const sb: any = { from: (t: string) => thenable(t === 'products' ? catalog : []) };

const [prof] = await rest(`profiles?id=eq.${userId}&select=full_name,quiz_answers,hair_type,photo_url,photo_back_url,photo_root_url`);
const fotos = [prof.photo_url, prof.photo_back_url, prof.photo_root_url].filter(Boolean);
console.log(`\n▶ Gerando (código de produção) para ${prof.full_name} · ${fotos.length} foto(s)\n`);

const t0 = Date.now();
const plan = await generatePlanWithClaude(sb, {
  email: 'teste@teste.com',
  hairType: prof.hair_type,
  quizAnswers: prof.quiz_answers,
  photo: { photoUrl: prof.photo_url ?? undefined, extraPhotoUrls: [prof.photo_back_url, prof.photo_root_url].filter(Boolean) },
}, { onUsage: (u) => console.log('[usage]', JSON.stringify(u)) });
console.log(`\n⏱  ${((Date.now() - t0) / 1000).toFixed(1)}s`);

console.log('\n═══ RETORNO GeneratedPlan ═══');
console.log('tipo_cabelo:', plan.tipo_cabelo, '| incômodo:', plan.incomodo_principal, '| âncora:', plan.produto_ancora);
console.log('analise_foto:', JSON.stringify(plan.analise_foto));
console.log('diarios:', JSON.stringify(plan.diarios));
console.log('produtos_indicados:', JSON.stringify(plan.produtos_indicados?.map(p => ({ id: p.produto_id.slice(0, 8), alt: p.alternativa_id?.slice(0, 8) ?? null, motivo: p.motivo.slice(0, 60) })), null, 1));
console.log('produtos_essenciais:', JSON.stringify(plan.produtos_essenciais));
console.log('\nDIAGNÓSTICO:', plan.diagnostico);
console.log('\nCARTA:\n' + plan.carta_ju);
console.log('\nMENSAGEM:', plan.mensagem_juliane);
console.log('\n═══ SEMANAS (montadas por template) ═══');
console.log('total:', plan.semanas.length);
console.log('S1 foco:', plan.semanas[0].foco);
console.log('S1 tarefas:', plan.semanas[0].tarefas.map(t => `d${t.dia} ${t.titulo}`).join(' / '));
console.log('S1 produtos:', JSON.stringify(plan.semanas[0].produtos));
console.log('S4 foco:', plan.semanas[3].foco);
console.log('S12 foco:', plan.semanas[11].foco);
