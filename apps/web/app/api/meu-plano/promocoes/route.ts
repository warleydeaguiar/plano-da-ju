import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/meu-plano/promocoes
 * Retorna:
 *  - promotions: promoções TEMPORÁRIas ativas agora (active + dentro da janela de datas)
 *  - recommendations: produtos INDICADOS pra ela (do plano, com motivo). Fallback:
 *    produtos do catálogo que casam com o tipo de cabelo, se ainda não tem indicações.
 */
export async function GET(req: NextRequest) {
  try {
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    const anon = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } },
    );
    const { data: { user }, error: authErr } = await anon.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const sb = await createServiceClient();
    const now = new Date().toISOString();

    // ── Promoções temporárias ativas ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: promos } = await (sb.from('promotions') as any)
      .select('id,title,description,image_url,cta_url,discount_label,starts_at,ends_at')
      .eq('active', true)
      .lte('starts_at', now)
      .or(`ends_at.is.null,ends_at.gte.${now}`)
      .order('starts_at', { ascending: false });

    // ── Indicações personalizadas ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: prof } = await (sb.from('profiles') as any)
      .select('recommended_products, hair_type')
      .eq('id', user.id)
      .maybeSingle();

    const stored: Array<{ produto_id?: string; motivo?: string; alternativa_id?: string | null }> =
      Array.isArray(prof?.recommended_products) ? prof.recommended_products : [];

    // baseRecs: produto principal + motivo (+ alternativa sugerida pela IA, fallback)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let baseRecs: { p: any; reason: string | null; aiAltId: string | null }[] = [];
    const PROD_FIELDS = 'id,name,brand,category,image_url,affiliate_url,is_ybera,alternative_product_id';

    if (stored.length) {
      const mainIds = [...new Set(stored.map(r => r.produto_id).filter(Boolean))] as string[];
      if (mainIds.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: mains } = await (sb.from('products') as any).select(PROD_FIELDS).in('id', mainIds).eq('active', true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mainMap = new Map((mains ?? []).map((p: any) => [p.id, p]));
        baseRecs = stored
          .map(r => { const p = mainMap.get(r.produto_id); return p ? { p, reason: r.motivo ?? null, aiAltId: r.alternativa_id ?? null } : null; })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter(Boolean) as any[];
      }
    }

    // Fallback: sem indicações salvas → produtos que casam com o tipo de cabelo
    let recommendationsFallback = false;
    if (baseRecs.length === 0 && prof?.hair_type) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: prods } = await (sb.from('products') as any)
        .select(PROD_FIELDS)
        .eq('active', true)
        .contains('hair_types', [prof.hair_type])
        // exclui produtos específicos de cor/tom que não casam (ex: loiro p/ crespo)
        .not('name', 'ilike', '%loiro%')
        .not('name', 'ilike', '%platinad%')
        .not('name', 'ilike', '%matizad%')
        .not('name', 'ilike', '%ruiv%')
        .not('name', 'ilike', '%blond%')
        // combos não aparecem como item principal — eles são variação de outro
        .is('parent_product_id', null)
        .order('is_ybera', { ascending: false })
        .limit(5);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      baseRecs = (prods ?? []).map((p: any) => ({ p, reason: null, aiAltId: null }));
      recommendationsFallback = baseRecs.length > 0;
    }

    // Resolve alternativa (PREFERE a cadastrada no produto) + combos relacionados
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let recommendations: any[] = [];
    if (baseRecs.length) {
      const mainIds = baseRecs.map(b => b.p.id);
      const altIds = [...new Set(baseRecs.map(b => b.p.alternative_product_id || b.aiAltId).filter(Boolean))] as string[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let altMap = new Map<string, any>();
      if (altIds.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: alts } = await (sb.from('products') as any).select('id,name,brand,affiliate_url').in('id', altIds).eq('active', true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        altMap = new Map((alts ?? []).map((p: any) => [p.id, p]));
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: combosRaw } = await (sb.from('products') as any)
        .select('id,name,brand,affiliate_url,image_url,parent_product_id').in('parent_product_id', mainIds).eq('active', true);
      const combosByParent = new Map<string, unknown[]>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const c of (combosRaw ?? []) as any[]) {
        const arr = combosByParent.get(c.parent_product_id) || [];
        arr.push({ id: c.id, name: c.name, brand: c.brand, affiliate_url: c.affiliate_url, image_url: c.image_url });
        combosByParent.set(c.parent_product_id, arr);
      }
      recommendations = baseRecs.map(({ p, reason, aiAltId }) => {
        const aid = p.alternative_product_id || aiAltId;
        const alt = aid ? altMap.get(aid) : null;
        return {
          id: p.id, name: p.name, brand: p.brand, category: p.category,
          image_url: p.image_url, affiliate_url: p.affiliate_url,
          reason,
          alternative: alt ? { id: alt.id, name: alt.name, brand: alt.brand, affiliate_url: alt.affiliate_url } : null,
          combos: combosByParent.get(p.id) || [],
        };
      });
    }

    return NextResponse.json({
      promotions: promos ?? [],
      recommendations,
      recommendationsFallback,
    });
  } catch (err) {
    console.error('[api/meu-plano/promocoes]', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
