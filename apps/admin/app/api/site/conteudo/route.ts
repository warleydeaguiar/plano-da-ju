import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/** Campos que o editor pode alterar. Nada fora desta lista é aceito. */
const EDITAVEIS = [
  'title', 'content_html', 'content_clean', 'excerpt_html', 'seo_title',
  'seo_description', 'og_image', 'featured_image_url', 'status', 'noindex',
  'published_at', 'affiliate_url', 'price_cents', 'price_original_cents',
] as const;

/**
 * PATCH: salva a edição de um conteúdo.
 *
 * `path` fica de fora de propósito: é a URL já indexada no Google e mudá-la
 * pelo editor quebraria o SEO em silêncio. Trocar de endereço exige criar o
 * redirect junto, e isso é operação consciente, não campo de formulário.
 */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: 'Faltou o id.' }, { status: 400 });

  const campos: Record<string, unknown> = {};
  for (const k of EDITAVEIS) {
    if (k in body) campos[k] = body[k];
  }
  if (!Object.keys(campos).length) {
    return NextResponse.json({ error: 'Nada para salvar.' }, { status: 400 });
  }

  // Quem escreve no editor não escreve HTML do WordPress: o texto digitado é a
  // versão que vai ao ar. Manter os dois campos iguais evita que uma edição
  // "suma" porque o site lê content_clean e o editor salvou em content_html.
  if (typeof campos.content_clean === 'string') campos.content_html = campos.content_clean;

  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('site_content')
    .update(campos)
    .eq('id', body.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** POST: cria post novo. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const titulo = String(body?.title || '').trim();
  if (!titulo) return NextResponse.json({ error: 'Informe o título.' }, { status: 400 });

  const slug = (body?.slug ? String(body.slug) : titulo)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
  if (!slug) return NextResponse.json({ error: 'Não consegui gerar o endereço a partir do título.' }, { status: 400 });

  const supabase = createAdminClient();
  const path = `/${slug}/`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existe } = await (supabase as any)
    .from('site_content').select('id').eq('path', path).maybeSingle();
  if (existe) {
    return NextResponse.json({ error: `Já existe conteúdo em ${path}` }, { status: 409 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('site_content')
    .insert({
      kind: 'post', slug, path, title: titulo,
      content_clean: '', content_html: '',
      // Nasce como rascunho: a RLS do site só publica status='publish', então
      // nada aparece antes de a Juliane mandar publicar.
      status: 'draft',
      seo_title: titulo,
      word_count: 0,
    })
    .select('id, path')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id, path: data.path });
}
