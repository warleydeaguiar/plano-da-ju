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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let recommendations: any[] = [];
    if (stored.length) {
      const ids = [...new Set(
        stored.flatMap(r => [r.produto_id, r.alternativa_id]).filter(Boolean),
      )] as string[];
      if (ids.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: prods } = await (sb.from('products') as any)
          .select('id,name,brand,category,image_url,affiliate_url,is_ybera')
          .in('id', ids)
          .eq('active', true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const map = new Map((prods ?? []).map((p: any) => [p.id, p]));
        recommendations = stored
          .map(r => {
            const p = map.get(r.produto_id);
            if (!p) return null;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const alt: any = r.alternativa_id ? map.get(r.alternativa_id) : null;
            return {
              ...p,
              reason: r.motivo ?? null,
              alternative: alt
                ? { id: alt.id, name: alt.name, brand: alt.brand, affiliate_url: alt.affiliate_url }
                : null,
            };
          })
          .filter(Boolean);
      }
    }

    // Fallback: sem indicações salvas → produtos que casam com o tipo de cabelo
    let recommendationsFallback = false;
    if (recommendations.length === 0 && prof?.hair_type) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: prods } = await (sb.from('products') as any)
        .select('id,name,brand,category,image_url,affiliate_url')
        .eq('active', true)
        .contains('hair_types', [prof.hair_type])
        .limit(6);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recommendations = (prods ?? []).map((p: any) => ({ ...p, reason: null }));
      recommendationsFallback = recommendations.length > 0;
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
