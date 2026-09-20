-- A view site_conteudo_trafego lista as colunas uma a uma e ficou para trás
-- quando `revisado_em` entrou em site_content. A /loja/ e a home pedem essa
-- coluna, o PostgREST respondia 400 e o site tratava o erro como "lista vazia":
-- a loja inteira (47 produtos) e os destaques da home sumiram sem aviso.
-- `create or replace` não aceita coluna nova no meio da lista; a view é
-- recriada. Nada depende dela além do site.
drop view if exists public.site_conteudo_trafego;

create view public.site_conteudo_trafego as
  select c.id, c.wp_id, c.kind, c.slug, c.path, c.title, c.excerpt_html,
         c.content_html, c.content_clean, c.featured_media_wp_id, c.featured_image_url,
         c.status, c.published_at, c.modified_at, c.revisado_em, c.author_name,
         c.word_count, c.seo_title, c.seo_description, c.canonical, c.og_image,
         c.robots, c.noindex, c.affiliate_url, c.price_cents, c.price_original_cents,
         c.currency, c.rating_value, c.rating_count, c.brand,
         c.imported_at, c.created_at, c.updated_at,
         coalesce(b.gsc_clicks, 0) as gsc_clicks,
         coalesce(b.gsc_impressions, 0) as gsc_impressions
    from public.site_content c
    left join public.site_seo_baseline b on b.path = c.path
   where c.status = 'publish';

grant select on public.site_conteudo_trafego to anon, authenticated, service_role;
