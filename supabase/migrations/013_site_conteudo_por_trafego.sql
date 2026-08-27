-- Conteúdo com o tráfego que ele realmente traz.
--
-- A home listava produto por data de publicação e acabava destacando a geleia
-- nutritiva (0 cliques em 16 meses) enquanto escondia o óleo de mirra (925
-- cliques, 298 mil impressões). Ordenar por data faz sentido num blog que
-- publica toda semana; num catálogo de afiliado o que importa é o que a
-- leitora procura.
--
-- ⚠️ A view filtra status='publish' explicitamente. Views no Postgres 15+
-- rodam com os privilégios do dono e NÃO aplicam a RLS das tabelas de base,
-- então sem este filtro ela publicaria rascunho.
create or replace view site_conteudo_trafego as
  select c.*,
         coalesce(b.gsc_clicks, 0)      as gsc_clicks,
         coalesce(b.gsc_impressions, 0) as gsc_impressions
  from site_content c
  left join site_seo_baseline b on b.path = c.path
  where c.status = 'publish';

grant select on site_conteudo_trafego to anon, authenticated;

notify pgrst, 'reload schema';
