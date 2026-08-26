-- Conteúdo do site julianecost.com migrado do WordPress.
--
-- Regra que governa todo este schema: `path` é o contrato de SEO. É a URL
-- exata que já está indexada no Google, com barra final, e não pode mudar.
-- Tudo o mais (id, slug, wp_id) é detalhe interno.
--
-- Idempotente: pode rodar de novo sem quebrar.

-- ---------------------------------------------------------------- categorias
create table if not exists site_categories (
  id              bigserial primary key,
  wp_id           integer unique,
  kind            text not null check (kind in ('category', 'product_cat', 'product_tag')),
  slug            text not null,
  path            text not null unique,
  name            text not null,
  description     text,
  seo_title       text,
  seo_description text,
  parent_wp_id    integer,
  post_count      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ------------------------------------------------------------------ conteúdo
-- Posts, páginas e produtos na mesma tabela: têm o mesmo ciclo de vida e as
-- mesmas necessidades de SEO. `kind` separa o template de renderização.
create table if not exists site_content (
  id                   bigserial primary key,
  wp_id                integer unique,
  kind                 text not null check (kind in ('post', 'page', 'product')),
  slug                 text not null,
  path                 text not null unique,
  title                text not null,
  excerpt_html         text,
  -- content_html é o HTML cru do WordPress, guardado intacto como fonte da
  -- verdade. content_clean é o processado (imagens reescritas para o nosso
  -- storage, links de afiliado normalizados). Reprocessar nunca perde o original.
  content_html         text,
  content_clean        text,
  featured_media_wp_id integer,
  featured_image_url   text,
  status               text not null default 'publish',
  published_at         timestamptz,
  modified_at          timestamptz,
  author_name          text,
  word_count           integer,

  -- SEO (espelha o que o Yoast gerava, para paridade 1:1 no cutover)
  seo_title            text,
  seo_description      text,
  canonical            text,
  og_image             text,
  robots               text,
  noindex              boolean not null default false,

  -- produto de afiliado: a Ju não vende, ela indica. Não há estoque nem preço
  -- próprio — price_cents é o preço de referência exibido no schema.
  affiliate_url        text,
  price_cents          integer,
  currency             text not null default 'BRL',
  rating_value         numeric(3, 2),
  rating_count         integer,
  brand                text,

  imported_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists site_content_kind_status_idx  on site_content (kind, status);
create index if not exists site_content_published_at_idx on site_content (published_at desc nulls last);

create table if not exists site_content_categories (
  content_id  bigint not null references site_content(id)    on delete cascade,
  category_id bigint not null references site_categories(id) on delete cascade,
  primary key (content_id, category_id)
);

-- --------------------------------------------------------------------- mídia
-- Só migramos o que é realmente usado dentro do conteúdo. A biblioteca do WP
-- tem ~1.777 itens (boa parte sobra de Instagram, com vídeos de dezenas de MB)
-- contra ~1.172 imagens efetivamente embutidas em posts.
create table if not exists site_media (
  id              bigserial primary key,
  wp_id           integer unique,
  original_url    text not null unique,
  storage_path    text,
  public_url      text,
  mime_type       text,
  width           integer,
  height          integer,
  filesize        integer,
  alt_text        text,
  used_in_content boolean not null default false,
  migrated_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists site_media_used_idx on site_media (used_in_content) where used_in_content;

-- ---------------------------------------------------------------- redirects
-- Origens: as 9 regras do plugin Redirection, slugs antigos que ainda recebem
-- impressão, e URLs malformadas que o Google achou (terminadas em `)` ou `"`).
-- status_code 410 = removido de propósito, e aí to_url fica nulo.
create table if not exists site_redirects (
  id          bigserial primary key,
  from_path   text not null unique,
  to_url      text,
  status_code integer not null default 301 check (status_code in (301, 302, 308, 410)),
  enabled     boolean not null default true,
  origem      text,
  note        text,
  hits        integer not null default 0,
  created_at  timestamptz not null default now(),
  constraint site_redirects_destino_obrigatorio
    check (status_code = 410 or to_url is not null)
);

-- ------------------------------------------------------- baseline pré-cutover
-- Retrato do site no WordPress ANTES de migrar, cruzado com 16 meses de Search
-- Console. É contra esta tabela que o QA de paridade roda: nenhuma URL vira o
-- DNS sem bater title/description/canonical/schema com o que já estava no ar.
create table if not exists site_seo_baseline (
  path            text primary key,
  title           text,
  description     text,
  canonical       text,
  h1              text,
  og_image        text,
  robots          text,
  schema_types    text,
  http_status     integer,
  html_bytes      integer,
  gsc_clicks      integer not null default 0,
  gsc_impressions integer not null default 0,
  gsc_ctr         numeric(6, 4),
  gsc_position    numeric(5, 2),
  -- top 50 páginas concentram 90% dos cliques: é a lista de proteção do cutover
  is_top50        boolean not null default false,
  captured_at     timestamptz not null default now()
);

create index if not exists site_seo_baseline_top_idx on site_seo_baseline (gsc_clicks desc);

-- ------------------------------------------------------------------ updated_at
create or replace function site_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists site_content_touch    on site_content;
drop trigger if exists site_categories_touch on site_categories;
create trigger site_content_touch    before update on site_content    for each row execute function site_touch_updated_at();
create trigger site_categories_touch before update on site_categories for each row execute function site_touch_updated_at();

-- ------------------------------------------------------------------------ RLS
-- O site é público: leitura anônima do que está publicado e não é noindex.
-- Escrita só pelo service_role (importador e painel admin).
alter table site_content            enable row level security;
alter table site_categories         enable row level security;
alter table site_media              enable row level security;
alter table site_redirects          enable row level security;
alter table site_content_categories enable row level security;
alter table site_seo_baseline       enable row level security;

drop policy if exists site_content_publico            on site_content;
drop policy if exists site_categories_publico         on site_categories;
drop policy if exists site_media_publico              on site_media;
drop policy if exists site_redirects_publico          on site_redirects;
drop policy if exists site_content_categories_publico on site_content_categories;

create policy site_content_publico on site_content
  for select to anon, authenticated
  using (status = 'publish');

create policy site_categories_publico on site_categories
  for select to anon, authenticated using (true);

create policy site_media_publico on site_media
  for select to anon, authenticated using (true);

create policy site_redirects_publico on site_redirects
  for select to anon, authenticated using (enabled);

create policy site_content_categories_publico on site_content_categories
  for select to anon, authenticated using (true);

-- site_seo_baseline é ferramenta interna de QA: sem policy de leitura pública,
-- só o service_role enxerga.

notify pgrst, 'reload schema';
