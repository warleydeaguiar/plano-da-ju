import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/plan-preview?user=<id|email>&k=<PLAN_PREVIEW_SECRET>
 *
 * Devolve o plano de QUALQUER cliente montado do mesmo jeito que a tela dela
 * (profile + semanas + produtos personalizados com combos). Serve pro admin
 * pré-visualizar "como o cliente vê" sem resetar senha / logar como ela.
 * Read-only, protegido por segredo compartilhado (admin ↔ web).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.PLAN_PREVIEW_SECRET;
  const k = req.nextUrl.searchParams.get('k');
  if (!secret || k !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const userParam = (req.nextUrl.searchParams.get('user') ?? '').trim();
  if (!userParam) return NextResponse.json({ error: 'missing user' }, { status: 400 });

  const sb = await createServiceClient();

  // Resolve por id (uuid) ou e-mail.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userParam);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = (sb.from('profiles') as any)
    .select('id,full_name,hair_type,porosity,chemical_history,main_problems,hair_length_cm,quiz_answers,plan_released_at,plan_requested_at,plan_status,plan_feedback_rating,plan_revision_due_at,recommended_products,daily_rituals,photo_url,photo_back_url,photo_root_url');
  const { data: profile } = isUuid
    ? await q.eq('id', userParam).maybeSingle()
    : await q.eq('email', userParam.toLowerCase()).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 });

  const uid = profile.id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: plans } = await (sb.from('hair_plans') as any)
    .select('week_number,focus,tasks,products,tips,juliane_notes')
    .eq('user_id', uid).order('week_number');

  // Produtos personalizados (mesma montagem da tela do cliente: âncora + alternativa
  // + motivo, e os combos de cada produto-base).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rec: any[] = Array.isArray(profile.recommended_products) ? profile.recommended_products : [];
  let products: unknown[] = [];
  if (rec.length) {
    const ids = [...new Set(rec.flatMap(r => [r?.produto_id, r?.alternativa_id]).filter(Boolean))];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: recProds } = await (sb.from('products') as any)
      .select('id,name,brand,category,affiliate_url,image_url,is_ybera').in('id', ids);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byId = new Map<string, any>((recProds ?? []).map((x: any) => [x.id, x]));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list: any[] = [];
    for (const r of rec) {
      const main = byId.get(r?.produto_id);
      if (main && !list.find(x => x.id === main.id)) list.push({ ...main, motivo: r?.motivo ?? null });
      const alt = r?.alternativa_id ? byId.get(r.alternativa_id) : null;
      if (alt && !list.find(x => x.id === alt.id)) list.push({ ...alt, motivo: null });
    }
    if (list.length) {
      const baseIds = list.map(x => x.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: comboRows } = await (sb.from('products') as any)
        .select('id,name,affiliate_url,parent_product_id').eq('active', true).in('parent_product_id', baseIds);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const byParent = new Map<string, any[]>();
      for (const c of (comboRows ?? [])) {
        const arr = byParent.get(c.parent_product_id) ?? [];
        arr.push({ id: c.id, name: c.name, affiliate_url: c.affiliate_url });
        byParent.set(c.parent_product_id, arr);
      }
      for (const x of list) { const cs = byParent.get(x.id); if (cs?.length) x.combos = cs; }
    }
    products = list;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pr } = await (sb.from('products') as any)
      .select('id,name,brand,category,affiliate_url,image_url,is_ybera').eq('active', true).limit(8);
    products = pr ?? [];
  }

  // Análise do cabelo (foto do onboarding) — texto + scores.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: analysis } = await (sb.from('photo_analyses') as any)
    .select('avaliacao_texto,frizz_score,brilho_score,hidratacao_score,pontas_score,raw_response')
    .eq('user_id', uid).order('analyzed_at', { ascending: true }).limit(1).maybeSingle();

  return NextResponse.json({ userId: uid, profile, plans: plans ?? [], products, analysis: analysis ?? null });
}
